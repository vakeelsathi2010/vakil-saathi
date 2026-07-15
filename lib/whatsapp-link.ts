type WhatsAppReminderDetails = {
  clientName: string
  phone: string
  caseNumber: string
  courtName: string
  hearingDate: string
  hearingTime?: string
  purpose?: string
}

type WhatsAppCaseUpdateDetails = {
  clientName: string
  phone: string
  caseNumber: string
  courtName: string
  hearingDate: string
  hearingPurpose?: string
  outcome: string
  nextDate?: string
  language?: 'en' | 'hi'
}

export function normalizeIndianWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return digits
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`
}

export function buildWhatsAppReminderUrl(details: WhatsAppReminderDetails) {
  const date = new Date(`${details.hearingDate}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const lines = [
    `Hello ${details.clientName},`,
    '',
    'This is a reminder for your upcoming court hearing:',
    `Case: ${details.caseNumber}`,
    `Court: ${details.courtName}`,
    `Date: ${date}`,
    details.hearingTime ? `Time: ${details.hearingTime}` : '',
    details.purpose ? `Purpose: ${details.purpose}` : '',
    '',
    'Please arrive on time and bring all required documents.',
    '— VakilSaathi (sent by your advocate)',
  ].filter(Boolean)

  return `https://wa.me/${normalizeIndianWhatsAppNumber(details.phone)}?text=${encodeURIComponent(lines.join('\n'))}`
}

export function buildWhatsAppCaseUpdateUrl(details: WhatsAppCaseUpdateDetails) {
  const format = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(
    details.language === 'hi' ? 'hi-IN' : 'en-IN',
    { day: '2-digit', month: 'short', year: 'numeric' },
  )

  const lines = details.language === 'hi'
    ? [
        `नमस्ते ${details.clientName},`,
        '',
        'आपके केस की आज की सुनवाई का अपडेट:',
        `केस: ${details.caseNumber}`,
        `न्यायालय: ${details.courtName}`,
        `सुनवाई की तारीख: ${format(details.hearingDate)}`,
        details.hearingPurpose ? `चरण: ${details.hearingPurpose}` : '',
        `आज की कार्यवाही: ${details.outcome}`,
        details.nextDate ? `अगली तारीख: ${format(details.nextDate)}` : 'अगली तारीख: अभी तय नहीं हुई',
        '',
        'किसी दस्तावेज़ या निर्देश की आवश्यकता होने पर आपका अधिवक्ता अलग से संपर्क करेगा।',
        '— VakilSaathi (आपके अधिवक्ता द्वारा भेजा गया)',
      ]
    : [
        `Hello ${details.clientName},`,
        '',
        "Here is today's update for your case:",
        `Case: ${details.caseNumber}`,
        `Court: ${details.courtName}`,
        `Hearing date: ${format(details.hearingDate)}`,
        details.hearingPurpose ? `Stage: ${details.hearingPurpose}` : '',
        `What happened: ${details.outcome}`,
        details.nextDate ? `Next hearing: ${format(details.nextDate)}` : 'Next hearing: Not fixed yet',
        '',
        'Your advocate will contact you separately if any document or action is required.',
        '— VakilSaathi (sent by your advocate)',
      ]

  return `https://wa.me/${normalizeIndianWhatsAppNumber(details.phone)}?text=${encodeURIComponent(lines.filter(Boolean).join('\n'))}`
}
