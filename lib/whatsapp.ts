import axios from 'axios'

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

interface SendWhatsAppParams {
  to: string      // Phone number with country code: 919876543210
  message: string
}

export async function sendWhatsApp({ to, message }: SendWhatsAppParams) {
  // Phone number clean karo — sirf digits rakho
  const cleanPhone = to.replace(/\D/g, '')
  const phoneWithCC = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`

  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phoneWithCC,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )
    return { success: true, data: response.data }
  } catch (error: unknown) {
    const axiosError = error as { response?: { data: unknown }; message?: string }
    console.error('WhatsApp send error:', axiosError?.response?.data || axiosError?.message)
    return { success: false, error: axiosError?.response?.data }
  }
}

// Advocate ko reminder
export function buildAdvocateReminderMsg(params: {
  advocateName: string
  clientName: string
  caseNumber: string
  courtName: string
  hearingDate: string
  hearingTime?: string
}) {
  return `⚖️ *VakilSaathi Reminder*

Pranam Adv. ${params.advocateName} Ji,

Kal aapki peshi hai:
📋 Case: ${params.caseNumber}
👤 Murakkil: ${params.clientName}
🏛️ Court: ${params.courtName}
📅 Tarikh: ${params.hearingDate}${params.hearingTime ? `\n⏰ Samay: ${params.hearingTime}` : ''}

VakilSaathi app par jaake aaj hi notes update karein.

— VakilSaathi 🙏`
}

// Client ko reminder
export function buildClientReminderMsg(params: {
  clientName: string
  advocateName: string
  caseNumber: string
  courtName: string
  hearingDate: string
  hearingTime?: string
}) {
  return `⚖️ *VakilSaathi — Court Reminder*

Pranam ${params.clientName} Ji,

Aapki court hearing kal hai:
📋 Case No: ${params.caseNumber}
👨‍⚖️ Vakeel: Adv. ${params.advocateName}
🏛️ Court: ${params.courtName}
📅 Tarikh: ${params.hearingDate}${params.hearingTime ? `\n⏰ Samay: ${params.hearingTime}` : ''}

⚠️ Samay par pahunchein. Koi sawal ho toh apne vakeel se sampark karein.

*STOP likhein agar reminder nahi chahiye.*

— VakilSaathi 🙏`
}
