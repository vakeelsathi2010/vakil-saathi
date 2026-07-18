/* eslint-disable @typescript-eslint/no-require-imports */
const axios = require('axios')
const cheerio = require('cheerio')

const CAPTCHA_PATTERN = /captcha|enter the characters|verification code/i

function normalise(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildCauseListUrl(template, date) {
  if (!template) throw new Error('CAUSE_LIST_URL_TEMPLATE is not configured')
  return template.replaceAll('{date}', date)
}

// Parses a published, authorised cause-list HTML response. It does not attempt
// to bypass CAPTCHAs, logins, rate limits, or any other source-site controls.
function parseCauseListHtml(html, { courtName, causeDate } = {}) {
  if (!html || typeof html !== 'string') throw new Error('Cause-list HTML is empty')
  if (CAPTCHA_PATTERN.test(html)) throw new Error('The official cause-list source requires CAPTCHA or verification. Provide an authorised source feed instead.')

  const $ = cheerio.load(html)
  const entries = []
  $('table').each((_, table) => {
    const headers = $(table).find('tr').first().find('th,td').map((__, cell) => normalise($(cell).text())).get()
    $(table).find('tr').slice(1).each((rowIndex, row) => {
      const values = $(row).find('td').map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get()
      if (!values.length) return
      const findValue = keywords => {
        const index = headers.findIndex(header => keywords.some(keyword => header.includes(keyword)))
        return index >= 0 ? values[index] : ''
      }
      const caseNumber = findValue(['caseno', 'casenumber', 'case']) || values.find(value => /\d+\s*[/.-]\s*\d{2,4}/.test(value)) || ''
      if (!caseNumber) return
      entries.push({
        courtName: findValue(['courtname', 'court']) || courtName || 'Kanpur Court',
        causeDate,
        caseNumber,
        partyName: findValue(['party', 'petitioner', 'respondent', 'title']) || '',
        judgeName: findValue(['judge', 'presidingofficer']) || '',
        queuePosition: Number(findValue(['serial', 'sno', 'itemno', 'item']) || rowIndex + 1) || rowIndex + 1,
        rawData: { headers, values },
      })
    })
  })
  return entries
}

async function fetchAndParseCauseList({ urlTemplate, causeDate, courtName }) {
  const sourceUrl = buildCauseListUrl(urlTemplate, causeDate)
  const response = await axios.get(sourceUrl, {
    timeout: 30000,
    headers: { 'User-Agent': 'VakilSaathi Cause List Sync/1.0 (authorised integration)' },
    validateStatus: status => status >= 200 && status < 300,
  })
  return { sourceUrl, entries: parseCauseListHtml(response.data, { causeDate, courtName }) }
}

async function notifyChange(supabase, advocateId, message, data) {
  const { data: advocate } = await supabase.from('advocates').select('user_id').eq('id', advocateId).single()
  if (!advocate?.user_id) return
  await supabase.from('notification_events').insert({
    user_id: advocate.user_id,
    type: 'case_update',
    title: 'Cause list changed',
    body: message,
    data,
    status: 'queued',
  })
}

async function syncCauseList({ supabase, urlTemplate, causeDate, courtName = 'Kanpur Court' }) {
  if (!supabase) throw new Error('A Supabase client is required')
  const { sourceUrl, entries } = await fetchAndParseCauseList({ urlTemplate, causeDate, courtName })
  const { data: cases, error: casesError } = await supabase.from('cases').select('id, advocate_id, case_number, court_name')
  if (casesError) throw casesError

  let matched = 0
  const alerts = []
  for (const entry of entries) {
    const { data: savedEntry, error: entryError } = await supabase.from('cause_list_entries').upsert({
      court_name: entry.courtName,
      cause_date: entry.causeDate,
      case_number: entry.caseNumber,
      party_name: entry.partyName,
      judge_name: entry.judgeName,
      queue_position: entry.queuePosition,
      raw_data: entry.rawData,
      source_url: sourceUrl,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'court_name,cause_date,case_number' }).select('id').single()
    if (entryError) throw entryError

    const caseRows = (cases || []).filter(caseRow => normalise(caseRow.case_number) === normalise(entry.caseNumber))
    for (const caseRow of caseRows) {
      const { data: previous } = await supabase.from('case_cause_list_sync').select('queue_position').eq('case_id', caseRow.id).order('last_seen_at', { ascending: false }).limit(1).maybeSingle()
      const changed = previous && previous.queue_position !== entry.queuePosition
      const { error: syncError } = await supabase.from('case_cause_list_sync').upsert({
        case_id: caseRow.id,
        cause_list_entry_id: savedEntry.id,
        advocate_id: caseRow.advocate_id,
        queue_position: entry.queuePosition,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'case_id,cause_list_entry_id' })
      if (syncError) throw syncError
      matched += 1
      if (changed) {
        const message = `${caseRow.case_number} is now at queue position ${entry.queuePosition}.`
        await notifyChange(supabase, caseRow.advocate_id, message, { caseId: caseRow.id, queuePosition: entry.queuePosition, causeDate })
        alerts.push({ caseId: caseRow.id, message })
      }
    }
  }
  return { success: true, causeDate, sourceUrl, entriesFetched: entries.length, matchedCases: matched, alerts }
}

module.exports = { buildCauseListUrl, parseCauseListHtml, fetchAndParseCauseList, syncCauseList }
