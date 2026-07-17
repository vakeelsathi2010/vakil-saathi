/**
 * Extracts structured case information from Hindi, English, and Hinglish voice text.
 * This file is intentionally standalone: no API route or database integration is included.
 */

const MONTHS = {
  january: 0, jan: 0, 'जनवरी': 0,
  february: 1, feb: 1, 'फरवरी': 1,
  march: 2, mar: 2, 'मार्च': 2,
  april: 3, apr: 3, 'अप्रैल': 3,
  may: 4, 'मई': 4,
  june: 5, jun: 5, 'जून': 5,
  july: 6, jul: 6, 'जुलाई': 6,
  august: 7, aug: 7, 'अगस्त': 7,
  september: 8, sep: 8, sept: 8, 'सितंबर': 8, 'सितम्बर': 8,
  october: 9, oct: 9, 'अक्टूबर': 9,
  november: 10, nov: 10, 'नवंबर': 10, 'नवम्बर': 10,
  december: 11, dec: 11, 'दिसंबर': 11, 'दिसम्बर': 11,
}

const KEYWORD_MAP = {
  'याचिका': 'Petition/Application',
  'दर्ज': 'Filed',
  'अगली तारीख': 'Next date',
  'जमानत': 'Bail',
  'फीस': 'Charges/Fees',
  'आरोप': 'Charges/Accusations',
  'तहसील': 'Court/Revenue office',
  'न्यायालय': 'Court',
  'अदालत': 'Court',
  'अगला हफ्ता': 'Next week',
  'अगले हफ्ते': 'Next week',
  'आने वाली तारीख': 'Coming date',
  'तत्काल': 'Urgent/Immediate',
  'जल्दी': 'Urgent',
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[।,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text))
}

function detectLanguage(text) {
  const hasHindi = /[\u0900-\u097F]/.test(text)
  const hasEnglish = /[a-zA-Z]/.test(text)
  if (hasHindi && hasEnglish) return 'Hinglish'
  if (hasHindi) return 'Hindi'
  if (hasEnglish) return 'Hinglish'
  return 'Unknown'
}

function detectClientName(rawText) {
  const match = rawText.match(/\b([A-Z][a-z]{1,30})\s+(?:ke|ka|ki|की|के|का)\b/i)
  if (!match) return null
  return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
}

function detectCaseType(text) {
  if (includesAny(text, [/\b(bail|bael|baill|jamanat|jam[aā]nat)\b/i, /जमानत/])) return 'Bail'
  if (includesAny(text, [/\b(property|proparty|property dispute)\b/i, /प्रॉपर्टी|संपत्ति/])) return 'Property'
  if (includesAny(text, [/\b(ipc|criminal|crimnal)\b/i, /क्रिमिनल|आपराधिक/])) return 'Criminal'
  if (includesAny(text, [/\b(civil|sivil)\b/i, /सिविल/])) return 'Civil'
  return null
}

function detectStatus(text) {
  if (includesAny(text, [/\b(adjourned|adjourn|adjorned|adjournment)\b/i, /स्थगित|टली/])) return 'Adjourned'
  if (includesAny(text, [/\b(filed|filed|d[aā]khil)\b/i, /दर्ज|दाखिल/])) return 'Filed'
  if (includesAny(text, [/\b(disposed|decided)\b/i, /निस्तारित|निर्णीत/])) return 'Disposed'
  if (includesAny(text, [/\b(stayed|stay)\b/i, /स्थगन/])) return 'Stayed'
  if (includesAny(text, [/\b(pending)\b/i, /लंबित/])) return 'Pending'
  return null
}

function parseDate(text, baseDate) {
  const dateBase = new Date(baseDate)
  if (Number.isNaN(dateBase.getTime())) return null
  dateBase.setHours(0, 0, 0, 0)

  if (includesAny(text, [/\b(tomorrow|kal)\b/i, /कल/])) {
    const tomorrow = new Date(dateBase)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return formatDate(tomorrow)
  }

  if (includesAny(text, [/\b(next week|agle hafte|agle hafta)\b/i, /अगले हफ्ते|अगला हफ्ता/])) {
    const nextWeek = new Date(dateBase)
    nextWeek.setDate(nextWeek.getDate() + 7)
    return formatDate(nextWeek)
  }

  // A fuzzy phrase does not contain an auditable calendar date.
  if (includesAny(text, [/\b(coming date|aane wali tarikh)\b/i, /आने वाली तारीख/])) return null

  const monthNames = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')
  const match = text.match(new RegExp(`(?:^|\\s)(0?[1-9]|[12]\\d|3[01])\\s+(${monthNames})(?:\\s+(20\\d{2}))?(?:$|\\s)`, 'i'))
  if (!match) return null

  const day = Number(match[1])
  const month = MONTHS[match[2].toLowerCase()]
  if (month === undefined) return null
  let year = match[3] ? Number(match[3]) : dateBase.getFullYear()
  let parsed = new Date(year, month, day)

  // If the spoken date has no year and has already passed this year, use next year.
  if (!match[3] && parsed < dateBase) {
    year += 1
    parsed = new Date(year, month, day)
  }

  // Reject invalid dates such as 31 February.
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) return null
  return formatDate(parsed)
}

function detectMainIssue(text) {
  if (includesAny(text, [/\b(fir|f i r|first information report)\b/i, /एफआईआर/])) return 'FIR Filing'
  if (includesAny(text, [/\b(bail application|bail)\b/i, /जमानत/])) return 'Bail Application'
  if (includesAny(text, [/\b(property|partition|injunction)\b/i, /प्रॉपर्टी|संपत्ति|बंटवारा/])) return 'Property Dispute'
  if (includesAny(text, [/\b(fees?|payment|charges?)\b/i, /फीस|भुगतान/])) return 'Fees / Payment'
  if (includesAny(text, [/\b(petition|application)\b/i, /याचिका/])) return 'Petition / Application'
  return null
}

function detectUrgency(text) {
  if (includesAny(text, [/\b(bohot|bahut|very|extremely)\s+(urgent|urgnt)\b/i, /बहुत\s*(तत्काल|जरूरी)|कोई समय नहीं/])) return 'CRITICAL'
  if (includesAny(text, [/\b(urgent|urgnt|asap|immediate)\b/i, /तत्काल/])) return 'HIGH'
  if (includesAny(text, [/\b(jaldi|jaldi se|soon)\b/i, /जल्दी/])) return 'HIGH'
  return 'MEDIUM'
}

function suggestedActions({ mainIssue, nextDate }) {
  const actions = []
  if (mainIssue === 'FIR Filing' && nextDate) {
    const deadline = new Date(`${nextDate}T00:00:00`)
    deadline.setDate(deadline.getDate() - 1)
    actions.push(`File FIR by ${formatDate(deadline)}`)
  } else if (mainIssue === 'FIR Filing') {
    actions.push('Prepare and file FIR')
  }
  return actions
}

function confidenceFor(details) {
  const coreFields = [details.clientName, details.caseType, details.status, details.nextDate, details.mainIssue]
  const present = coreFields.filter(Boolean).length
  if (present === 5) return 95
  if (present >= 3) return 82
  if (present >= 1) return 65
  return 50
}

/**
 * @param {string} text Hinglish, Hindi, or English voice transcription.
 * @param {{ baseDate?: Date | string }} options Optional deterministic date for testing.
 * @returns {{ clientName: string | null, caseType: string | null, status: string | null, nextDate: string | null, mainIssue: string | null, urgency: string, confidence: number, suggestedActions: string[], language: string } | { error: string }}
 */
function extractCaseDetails(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Input text is required' }

  const cleanedText = normalise(text)
  const details = {
    clientName: detectClientName(text),
    caseType: detectCaseType(cleanedText),
    status: detectStatus(cleanedText),
    nextDate: parseDate(cleanedText, options.baseDate || new Date()),
    mainIssue: detectMainIssue(cleanedText),
    urgency: detectUrgency(cleanedText),
    confidence: 0,
    suggestedActions: [],
    language: detectLanguage(text),
  }

  details.suggestedActions = suggestedActions(details)
  details.confidence = confidenceFor(details)
  return details
}

module.exports = { extractCaseDetails, KEYWORD_MAP }
