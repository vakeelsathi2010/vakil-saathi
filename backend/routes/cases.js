/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * VakilSaathi Express route for creating a case from structured voice data.
 *
 * Required environment variables (set by the project owner):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const express = require('express')
const { createClient } = require('@supabase/supabase-js')

const VALID_CASE_TYPES = new Set(['Bail', 'Property', 'Criminal', 'Civil'])
const VALID_URGENCY = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

function errorResponse(res, error, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error, statusCode })
}

function todayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function parseNotes(notes) {
  if (!notes) return {}
  try {
    return JSON.parse(notes)
  } catch {
    return { legacy_notes: notes }
  }
}

async function generateCrn(supabase, year) {
  const prefix = `${year}-CC-`
  const { data, error } = await supabase
    .from('cases')
    .select('case_number')
    .like('case_number', `${prefix}%`)
    .order('case_number', { ascending: false })
    .limit(1)

  if (error) throw error
  const latest = data?.[0]?.case_number
  const latestSequence = latest ? Number(latest.split('-').pop()) : 0
  return `${prefix}${String(Number.isFinite(latestSequence) ? latestSequence + 1 : 1).padStart(4, '0')}`
}

async function findOrCreateClient(supabase, advocateId, clientName, clientPhone) {
  const { data: clientRows, error: findError } = await supabase
    .from('clients')
    .select('id, full_name')
    .eq('advocate_id', advocateId)
    .ilike('full_name', clientName)
    .limit(10)

  if (findError) throw findError
  const existing = (clientRows || []).find(client => client.full_name.trim().toLowerCase() === clientName.toLowerCase())
  if (existing) return existing

  // The existing database schema requires phone to be non-null. An empty value
  // means the advocate must add the number later; no number is invented.
  const { data: client, error: createError } = await supabase
    .from('clients')
    .insert({
      advocate_id: advocateId,
      full_name: clientName,
      phone: typeof clientPhone === 'string' ? clientPhone.trim() : '',
      consent_given: false,
    })
    .select('id, full_name')
    .single()

  if (createError) throw createError
  return client
}

function buildCaseMetadata(data, existingNotes) {
  const now = new Date().toISOString()
  const metadata = parseNotes(existingNotes)
  const history = Array.isArray(metadata.case_history) ? metadata.case_history : []

  return JSON.stringify({
    ...metadata,
    main_issue: data.mainIssue || null,
    urgency: data.urgency,
    case_history: [{ action: 'Auto-created from voice update', at: now }, ...history],
  })
}

function offsetDate(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function createRelatedRecords(supabase, caseId, advocateId, data, isNewCase) {
  const { error: historyError } = await supabase.from('case_history').insert({
    case_id: caseId,
    advocate_id: advocateId,
    event_type: isNewCase ? 'voice_case_created' : 'voice_case_updated',
    details: { status: data.status, nextDate: data.nextDate, mainIssue: data.mainIssue, urgency: data.urgency },
  })
  if (historyError) throw historyError

  if (!isNewCase) return true

  const { error: actionError } = await supabase.from('case_action_items').insert({
    case_id: caseId,
    advocate_id: advocateId,
    title: data.mainIssue ? `Review: ${data.mainIssue}` : 'Review case update',
    due_date: data.nextDate,
    status: 'open',
  })
  if (actionError) throw actionError

  const { error: reminderError } = await supabase.from('case_reminders').insert([
    { case_id: caseId, advocate_id: advocateId, recipient_type: 'advocate', reminder_date: offsetDate(data.nextDate, 7), status: 'planned' },
    { case_id: caseId, advocate_id: advocateId, recipient_type: 'advocate', reminder_date: offsetDate(data.nextDate, 1), status: 'planned' },
    { case_id: caseId, advocate_id: advocateId, recipient_type: 'client', reminder_date: offsetDate(data.nextDate, 1), status: 'planned' },
  ])
  if (reminderError) throw reminderError
  return true
}

async function upsertHearing(supabase, caseId, advocateId, data) {
  const { data: existing, error: findError } = await supabase
    .from('hearings')
    .select('id')
    .eq('case_id', caseId)
    .eq('hearing_date', data.nextDate)
    .maybeSingle()
  if (findError) throw findError

  const hearingPayload = {
    advocate_id: advocateId,
    hearing_date: data.nextDate,
    hearing_purpose: data.mainIssue || 'Case update',
    outcome: data.status,
  }
  if (existing) {
    const { error } = await supabase.from('hearings').update(hearingPayload).eq('id', existing.id)
    if (error) throw error
    return existing.id
  }

  const { data: created, error } = await supabase
    .from('hearings')
    .insert({ ...hearingPayload, case_id: caseId })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

function createCasesRouter({ supabase } = {}) {
  const router = express.Router()
  const database = supabase || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  router.post('/api/cases/auto-create', async (req, res) => {
    try {
      const body = req.body || {}
      const advocateId = String(body.advocateId || '').trim()
      const clientName = String(body.clientName || '').trim()
      const caseType = String(body.caseType || '').trim()
      const status = String(body.status || '').trim()
      const nextDate = String(body.nextDate || '').trim()
      const mainIssue = String(body.mainIssue || '').trim()
      const urgency = String(body.urgency || 'MEDIUM').trim().toUpperCase()

      if (!advocateId) return errorResponse(res, 'Advocate ID required')
      if (!clientName) return errorResponse(res, 'Client name required')
      if (!VALID_CASE_TYPES.has(caseType)) return errorResponse(res, 'Invalid case type')
      if (!isValidDate(nextDate) || nextDate < todayKey()) return errorResponse(res, 'Next date must be today or a future date')
      if (!VALID_URGENCY.has(urgency)) return errorResponse(res, 'Invalid urgency')

      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (!token) return errorResponse(res, 'Authentication required', 401)
      const { data: authData, error: authError } = await database.auth.getUser(token)
      if (authError || !authData.user) return errorResponse(res, 'Invalid authentication token', 401)

      const { data: advocate, error: advocateError } = await database
        .from('advocates')
        .select('id')
        .eq('id', advocateId)
        .eq('user_id', authData.user.id)
        .maybeSingle()
      if (advocateError) throw advocateError
      if (!advocate) return errorResponse(res, 'Advocate not found')

      const client = await findOrCreateClient(database, advocateId, clientName, body.clientPhone)
      const { data: possibleDuplicates, error: duplicateError } = await database
        .from('cases')
        .select('id, case_number, case_title, case_type, status, notes, created_at, clients(full_name)')
        .eq('advocate_id', advocateId)
        .eq('case_type', caseType)
      if (duplicateError) throw duplicateError

      const duplicate = (possibleDuplicates || []).find(item =>
        item.clients?.full_name?.trim().toLowerCase() === clientName.toLowerCase()
      )
      const now = new Date().toISOString()
      const casePayload = {
        client_id: client.id,
        case_title: `${clientName} — ${caseType}`,
        court_name: 'Not assigned',
        case_type: caseType,
        status: status || 'Active',
      }

      let caseRecord
      let updated = false
      if (duplicate) {
        const notes = buildCaseMetadata({ mainIssue, urgency, nextDate }, duplicate.notes)
        const { data, error } = await database
          .from('cases')
          .update({ ...casePayload, notes, updated_at: now })
          .eq('id', duplicate.id)
          .select('id, case_number, case_title, case_type, created_at')
          .single()
        if (error) throw error
        caseRecord = data
        updated = true
      } else {
        const crn = await generateCrn(database, Number(nextDate.slice(0, 4)))
        const notes = buildCaseMetadata({ mainIssue, urgency, nextDate })
        const { data, error } = await database
          .from('cases')
          .insert({ ...casePayload, advocate_id: advocateId, case_number: crn, notes, created_at: now, updated_at: now })
          .select('id, case_number, case_title, case_type, created_at')
          .single()
        if (error) throw error
        caseRecord = data
      }

      await upsertHearing(database, caseRecord.id, advocateId, { status, nextDate, mainIssue })
      const remindersSet = await createRelatedRecords(
        database,
        caseRecord.id,
        advocateId,
        { status, nextDate, mainIssue, urgency },
        !updated
      )

      return res.status(updated ? 200 : 201).json({
        success: true,
        updated,
        caseId: caseRecord.id,
        crn: caseRecord.case_number,
        message: `${clientName} का ${caseType.toLowerCase()} case add हो गया!`,
        case: {
          id: caseRecord.id,
          crn: caseRecord.case_number,
          clientName,
          caseType,
          nextDate,
          urgency,
          createdAt: caseRecord.created_at,
        },
        remindersSet,
        messageGenerated: true,
      })
    } catch (error) {
      return errorResponse(res, error instanceof Error ? error.message : 'Unable to auto-create case', 500)
    }
  })

  return router
}

module.exports = { createCasesRouter }
