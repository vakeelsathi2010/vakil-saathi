type WhatsAppReminderDetails = {
  clientName: string
  phone: string
  caseNumber: string
  courtName: string
  hearingDate: string
  hearingTime?: string
  purpose?: string
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
    `Namaste ${details.clientName},`,
    '',
    'Yeh aapki court hearing ka reminder hai:',
    `Case: ${details.caseNumber}`,
    `Court: ${details.courtName}`,
    `Date: ${date}`,
    details.hearingTime ? `Time: ${details.hearingTime}` : '',
    details.purpose ? `Purpose: ${details.purpose}` : '',
    '',
    'Kripya samay par pahunchiye aur zaruri documents saath laiye.',
    '— VakilSaathi (aapke advocate dwara bheja gaya)',
  ].filter(Boolean)

  return `https://wa.me/${normalizeIndianWhatsAppNumber(details.phone)}?text=${encodeURIComponent(lines.join('\n'))}`
}
