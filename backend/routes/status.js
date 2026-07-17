/* eslint-disable @typescript-eslint/no-require-imports */

const express = require('express')
const { createClient } = require('@supabase/supabase-js')
const { generateClientMessages } = require('../functions/messageGenerator')

const STATUSES = ['Filed', 'Pending', 'Hearing', 'Adjourned', 'Hearing Completed', 'Judgment Awaited', 'Judgment Received', 'Appeal', 'Closed']

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function parseNotes(value) { try { return value ? JSON.parse(value) : {} } catch { return { legacy_notes: value } } }
function dateOffset(date, days) { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() - days); return value.toISOString().slice(0, 10) }

async function updateCaseStatus(supabase, userId, caseId, body) {
  const status = String(body.status || '').trim()
  const nextDate = body.date ? String(body.date).trim() : ''
  const statusNotes = String(body.notes || '').trim()
  if (!STATUSES.includes(status)) throw Object.assign(new Error('Invalid case status'), { statusCode: 400 })
  if (nextDate && !validDate(nextDate)) throw Object.assign(new Error('Date must use YYYY-MM-DD format'), { statusCode: 400 })

  const { data: advocate, error: advocateError } = await supabase.from('advocates').select('id, full_name, phone').eq('user_id', userId).single()
  if (advocateError || !advocate) throw Object.assign(new Error('Advocate profile not found'), { statusCode: 404 })
  const { data: caseRecord, error: caseError } = await supabase
    .from('cases')
    .select('id, case_number, case_title, case_type, status, court_name, notes, client_id, clients(full_name, phone, consent_given)')
    .eq('id', caseId).eq('advocate_id', advocate.id).single()
  if (caseError || !caseRecord) throw Object.assign(new Error('Case not found'), { statusCode: 404 })

  const beforeStatus = caseRecord.status
  const nextNotes = { ...parseNotes(caseRecord.notes), status_updated_at: new Date().toISOString(), status_notes: statusNotes || undefined }
  const { error: updateError } = await supabase.from('cases').update({ status, notes: JSON.stringify(nextNotes) }).eq('id', caseId)
  if (updateError) throw updateError

  if (nextDate) {
    const { data: sameDay } = await supabase.from('hearings').select('id').eq('case_id', caseId).eq('hearing_date', nextDate).maybeSingle()
    const hearingPayload = { advocate_id: advocate.id, hearing_date: nextDate, hearing_purpose: statusNotes || `Status: ${status}`, outcome: status }
    const hearingResult = sameDay ? await supabase.from('hearings').update(hearingPayload).eq('id', sameDay.id) : await supabase.from('hearings').insert({ ...hearingPayload, case_id: caseId })
    if (hearingResult.error) throw hearingResult.error
    const { error: removeRemindersError } = await supabase.from('case_reminders').delete().eq('case_id', caseId).eq('recipient_type', 'advocate')
    if (removeRemindersError && removeRemindersError.code !== '42P01') throw removeRemindersError
    const reminderRows = [7, 1, 0].map(days => ({ case_id: caseId, advocate_id: advocate.id, recipient_type: 'advocate', reminder_date: dateOffset(nextDate, days), status: 'planned' }))
    const { error: reminderError } = await supabase.from('case_reminders').insert(reminderRows)
    if (reminderError && reminderError.code !== '42P01') throw reminderError
  }

  const client = caseRecord.clients || {}
  const messages = generateClientMessages({ clientName: client.full_name || 'Client', caseStatus: status, nextDate: nextDate || new Date().toISOString().slice(0, 10), mainIssue: statusNotes, actions: statusNotes ? [statusNotes] : undefined, caseType: caseRecord.case_type, courtName: caseRecord.court_name, advocateName: advocate.full_name, advocateContact: advocate.phone })
  const historyDetails = { previous_status: beforeStatus, new_status: status, next_date: nextDate || null, notes: statusNotes || null, changed_by: 'Advocate', client_notification: { status: client.phone && client.consent_given ? 'pending_approval' : 'not_ready', whatsapp: messages.success ? messages.messages.whatsapp : null } }
  const { data: history, error: historyError } = await supabase.from('case_history').insert({ case_id: caseId, advocate_id: advocate.id, event_type: 'status_changed', details: historyDetails }).select('id, created_at, event_type, details').single()
  if (historyError && historyError.code !== '42P01') throw historyError
  return { success: true, caseId, previousStatus: beforeStatus, status, nextDate: nextDate || null, history, clientNotification: historyDetails.client_notification, messageDraft: messages.success ? messages.messages : null }
}

function createStatusRoute() {
  const router = express.Router()
  router.put('/api/cases/:caseId/status', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
      if (!token) return res.status(401).json({ success: false, error: 'Sign in is required', statusCode: 401 })
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return res.status(401).json({ success: false, error: 'Invalid session', statusCode: 401 })
      const result = await updateCaseStatus(supabase, user.id, req.params.caseId, req.body || {})
      return res.status(200).json(result)
    } catch (error) { return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Unable to update case status', statusCode: error.statusCode || 500 }) }
  })
  return router
}

module.exports = { STATUSES, updateCaseStatus, createStatusRoute }
