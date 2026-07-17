const VALID_CASE_TYPES = new Set(['Bail', 'Property', 'Criminal', 'Civil'])
const VALID_URGENCY = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

class AutoCreateError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

function todayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function offsetDate(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function getClient(supabase, advocateId, clientName, clientPhone) {
  const { data, error } = await supabase.from('clients').select('id, full_name').eq('advocate_id', advocateId).ilike('full_name', clientName).limit(10)
  if (error) throw error
  const existing = (data || []).find(client => client.full_name.trim().toLowerCase() === clientName.toLowerCase())
  if (existing) return existing

  const { data: client, error: createError } = await supabase
    .from('clients')
    .insert({ advocate_id: advocateId, full_name: clientName, phone: typeof clientPhone === 'string' ? clientPhone.trim() : '', consent_given: false })
    .select('id, full_name')
    .single()
  if (createError) throw createError
  return client
}

async function getCrn(supabase, year) {
  const prefix = `${year}-CC-`
  const { data, error } = await supabase.from('cases').select('case_number').like('case_number', `${prefix}%`).order('case_number', { ascending: false }).limit(1)
  if (error) throw error
  const sequence = Number(data?.[0]?.case_number?.split('-').pop()) || 0
  return `${prefix}${String(sequence + 1).padStart(4, '0')}`
}

async function createRelatedRecords(supabase, caseId, advocateId, input, isNew) {
  const { error: historyError } = await supabase.from('case_history').insert({
    case_id: caseId,
    advocate_id: advocateId,
    event_type: isNew ? 'voice_case_created' : 'voice_case_updated',
    details: { status: input.status, nextDate: input.nextDate, mainIssue: input.mainIssue, urgency: input.urgency },
  })
  if (historyError) throw historyError
  if (!isNew) return true

  const { error: actionError } = await supabase.from('case_action_items').insert({
    case_id: caseId,
    advocate_id: advocateId,
    title: input.mainIssue ? `Review: ${input.mainIssue}` : 'Review case update',
    due_date: input.nextDate,
    status: 'open',
  })
  if (actionError) throw actionError

  const { error: reminderError } = await supabase.from('case_reminders').insert([
    { case_id: caseId, advocate_id: advocateId, recipient_type: 'advocate', reminder_date: offsetDate(input.nextDate, 7), status: 'planned' },
    { case_id: caseId, advocate_id: advocateId, recipient_type: 'advocate', reminder_date: offsetDate(input.nextDate, 1), status: 'planned' },
    { case_id: caseId, advocate_id: advocateId, recipient_type: 'client', reminder_date: offsetDate(input.nextDate, 1), status: 'planned' },
  ])
  if (reminderError) throw reminderError
  return true
}

async function upsertHearing(supabase, caseId, advocateId, input) {
  const { data: current, error: findError } = await supabase.from('hearings').select('id').eq('case_id', caseId).eq('hearing_date', input.nextDate).maybeSingle()
  if (findError) throw findError
  const payload = { advocate_id: advocateId, hearing_date: input.nextDate, hearing_purpose: input.mainIssue || 'Case update', outcome: input.status }
  const response = current
    ? await supabase.from('hearings').update(payload).eq('id', current.id)
    : await supabase.from('hearings').insert({ ...payload, case_id: caseId })
  if (response.error) throw response.error
}

async function autoCreateCase(supabase, rawBody, authenticatedUserId) {
  const input = {
    advocateId: String(rawBody.advocateId || '').trim(),
    clientName: String(rawBody.clientName || '').trim(),
    clientPhone: typeof rawBody.clientPhone === 'string' ? rawBody.clientPhone : '',
    caseType: String(rawBody.caseType || '').trim(),
    status: String(rawBody.status || '').trim() || 'Active',
    nextDate: String(rawBody.nextDate || '').trim(),
    mainIssue: String(rawBody.mainIssue || '').trim(),
    urgency: String(rawBody.urgency || 'MEDIUM').trim().toUpperCase(),
  }

  if (!input.advocateId) throw new AutoCreateError('Advocate ID required')
  if (!input.clientName) throw new AutoCreateError('Client name required')
  if (!VALID_CASE_TYPES.has(input.caseType)) throw new AutoCreateError('Invalid case type')
  if (!validDate(input.nextDate) || input.nextDate < todayKey()) throw new AutoCreateError('Next date must be today or a future date')
  if (!VALID_URGENCY.has(input.urgency)) throw new AutoCreateError('Invalid urgency')

  const { data: advocate, error: advocateError } = await supabase.from('advocates').select('id').eq('id', input.advocateId).eq('user_id', authenticatedUserId).maybeSingle()
  if (advocateError) throw advocateError
  if (!advocate) throw new AutoCreateError('Advocate not found', 404)

  const client = await getClient(supabase, input.advocateId, input.clientName, input.clientPhone)
  const { data: matchingCases, error: matchingError } = await supabase
    .from('cases')
    .select('id, case_number, created_at, clients(full_name)')
    .eq('advocate_id', input.advocateId)
    .eq('case_type', input.caseType)
  if (matchingError) throw matchingError
  const duplicate = (matchingCases || []).find(item => item.clients?.full_name?.trim().toLowerCase() === input.clientName.toLowerCase())

  const payload = {
    client_id: client.id,
    case_title: `${input.clientName} — ${input.caseType}`,
    court_name: 'Not assigned',
    case_type: input.caseType,
    status: input.status,
    notes: JSON.stringify({ main_issue: input.mainIssue || null, urgency: input.urgency }),
  }
  let record
  const updated = Boolean(duplicate)
  if (duplicate) {
    const { data, error } = await supabase.from('cases').update(payload).eq('id', duplicate.id).select('id, case_number, created_at').single()
    if (error) throw error
    record = data
  } else {
    const caseNumber = await getCrn(supabase, Number(input.nextDate.slice(0, 4)))
    const { data, error } = await supabase.from('cases').insert({ ...payload, advocate_id: input.advocateId, case_number: caseNumber }).select('id, case_number, created_at').single()
    if (error) throw error
    record = data
  }

  await upsertHearing(supabase, record.id, input.advocateId, input)
  const remindersSet = await createRelatedRecords(supabase, record.id, input.advocateId, input, !updated)

  return {
    success: true,
    updated,
    caseId: record.id,
    crn: record.case_number,
    message: `${input.clientName} का ${input.caseType.toLowerCase()} case add हो गया!`,
    case: { id: record.id, crn: record.case_number, clientName: input.clientName, caseType: input.caseType, nextDate: input.nextDate, urgency: input.urgency, createdAt: record.created_at },
    remindersSet,
    messageGenerated: true,
  }
}

module.exports = { autoCreateCase, AutoCreateError }
