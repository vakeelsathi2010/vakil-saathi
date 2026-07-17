/**
 * Creates client-facing communication drafts. Messages are never sent here;
 * the advocate must review and approve them in the app first.
 */

const CASE_GUIDANCE = {
  Bail: ['Please keep the surety documents ready.', 'Be available for bail-related formalities if required.'],
  Property: ['Please keep the relevant property documents ready.', 'Share any additional ownership or registry papers with us.'],
  Criminal: ['Please keep yourself available for witness preparation if needed.', 'Please share any new information relevant to the hearing.'],
  Civil: ['Please keep the required documents ready for submission.', 'We will prepare for the next arguments.'],
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(value) {
  const date = parseDate(value)
  if (!date) return null
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(date)
}

function getDeadline(caseData) {
  const explicitDeadline = formatDate(caseData.deadline)
  if (explicitDeadline) return explicitDeadline
  const nextDate = parseDate(caseData.nextDate)
  if (!nextDate) return null
  nextDate.setDate(nextDate.getDate() - 1)
  return formatDate(nextDate)
}

function getActions(caseData) {
  const supplied = Array.isArray(caseData.actions)
    ? caseData.actions.map(action => String(action).trim()).filter(Boolean)
    : []
  return supplied.length ? supplied : (CASE_GUIDANCE[caseData.caseType] || ['Please contact our office for the next steps.'])
}

/**
 * @param {{ clientName: string, caseStatus?: string, nextDate: string|Date, mainIssue?: string, actions?: string[], caseType?: string, courtName?: string, advocateName?: string, advocateContact?: string, deadline?: string|Date }} caseData
 * @returns {{ success: boolean, messages?: object, copyable?: boolean, readyToSend?: boolean, warnings?: string[], error?: string }}
 */
function generateClientMessages(caseData) {
  if (!caseData || typeof caseData !== 'object') return { success: false, error: 'Case data is required' }

  const clientName = cleanName(caseData.clientName)
  if (!clientName) return { success: false, error: 'Client name is required' }

  const caseType = cleanName(caseData.caseType) || 'Legal'
  const status = cleanName(caseData.caseStatus || caseData.status) || 'Updated'
  const issue = String(caseData.mainIssue || '').trim()
  const courtName = cleanName(caseData.courtName) || 'the concerned court'
  const advocateName = cleanName(caseData.advocateName) || 'Your Advocate'
  const advocateContact = String(caseData.advocateContact || '').trim()
  const nextDate = formatDate(caseData.nextDate)
  const deadline = getDeadline(caseData)
  const actions = getActions({ ...caseData, caseType })
  const warnings = []

  if (!nextDate) warnings.push('Next hearing date needs advocate review before sending.')
  if (!issue) warnings.push('Main issue was not provided; review the action items before sending.')

  const actionLines = actions.map(action => `• ${action}`).join('\n')
  const emailActionLines = actions.map((action, index) => `${index + 1}. ${action}`).join('\n')
  const dateText = nextDate || '[Please confirm date]'
  const deadlineText = deadline || '[Please confirm deadline]'
  const primaryAction = actions[0]

  const whatsapp = `Namaste ${clientName},\n\nAaj court ki hearing hui.\nStatus: ${status}\nAgli date: ${dateText}\n\nAb kya karna hai:\n${actionLines}\n\nDeadline: ${deadlineText}\nHum iske baad court mein submit kar denge.${issue ? `\n\nMatter: ${issue}` : ''}\n\nKoi sawaal ho to batana.\n- ${advocateName}${advocateContact ? `\n${advocateContact}` : ''}`

  const sms = `${clientName}, case ${status}. Next date ${dateText}. ${primaryAction} - ${advocateName}`
  const smsWords = sms.split(/\s+/)
  const shortSms = smsWords.length <= 20 ? sms : `${clientName}, case ${status}. Next: ${dateText}. ${primaryAction} - ${advocateName}`.split(/\s+/).slice(0, 20).join(' ')

  const emailSubject = `Your Case Update - ${caseType}`
  const emailBody = `Dear ${clientName},\n\nRe: Your ${caseType} Case\n\nFollowing the court hearing today, I am writing to update you on the status of your case.\n\nCASE STATUS\nCurrent Status: ${status}\nNext Hearing: ${dateText}\nCourt: ${courtName}\n\nREQUIRED ACTIONS\n${emailActionLines}\nDeadline: ${deadlineText}\n\nI will ensure the required work is prepared and filed by ${deadlineText}.\n\nPlease feel free to reach out if you have any questions.\n\nBest regards,\n${advocateName}${advocateContact ? `\n${advocateContact}` : ''}`

  return {
    success: true,
    messages: { whatsapp, sms: shortSms, email: { subject: emailSubject, body: emailBody } },
    copyable: true,
    readyToSend: warnings.length === 0,
    warnings,
  }
}

module.exports = { generateClientMessages }
