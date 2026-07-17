/* eslint-disable @typescript-eslint/no-require-imports */
const { generateClientMessages } = require('./messageGenerator')

const result = generateClientMessages({
  clientName: 'Rajesh',
  caseStatus: 'Adjourned',
  nextDate: '2026-07-25',
  mainIssue: 'FIR Filing',
  actions: ['File FIR by 24 July'],
  caseType: 'Bail',
  courtName: 'District Court, Kanpur',
  advocateName: 'Adv. Zayen',
  advocateContact: '+91 9876543210',
})

if (!result.success) {
  console.error(result)
  process.exit(1)
}

console.log('\nWhatsApp draft:\n')
console.log(result.messages.whatsapp)
console.log('\nSMS draft:\n')
console.log(result.messages.sms)
console.log('\nEmail draft:\n')
console.log(`Subject: ${result.messages.email.subject}\n\n${result.messages.email.body}`)
