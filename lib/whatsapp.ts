import axios from 'axios'

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

interface SendWhatsAppParams {
  to: string      // Phone number with country code: 919876543210
  message: string
}

export async function sendWhatsApp({ to, message }: SendWhatsAppParams) {
  // Keep digits only before applying the Indian country code.
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

// Reminder for the advocate
export function buildAdvocateReminderMsg(params: {
  advocateName: string
  clientName: string
  caseNumber: string
  courtName: string
  hearingDate: string
  hearingTime?: string
}) {
  return `⚖️ *VakilSaathi Reminder*

Hello Adv. ${params.advocateName},

Your hearing is tomorrow:
📋 Case: ${params.caseNumber}
👤 Client: ${params.clientName}
🏛️ Court: ${params.courtName}
📅 Date: ${params.hearingDate}${params.hearingTime ? `\n⏰ Time: ${params.hearingTime}` : ''}

Please review the case notes in VakilSaathi today.

— VakilSaathi`
}

// Reminder for the client
export function buildClientReminderMsg(params: {
  clientName: string
  advocateName: string
  caseNumber: string
  courtName: string
  hearingDate: string
  hearingTime?: string
}) {
  return `⚖️ *VakilSaathi — Court Reminder*

Hello ${params.clientName},

Your court hearing is tomorrow:
📋 Case No: ${params.caseNumber}
👨‍⚖️ Advocate: Adv. ${params.advocateName}
🏛️ Court: ${params.courtName}
📅 Date: ${params.hearingDate}${params.hearingTime ? `\n⏰ Time: ${params.hearingTime}` : ''}

⚠️ Please arrive on time. Contact your advocate if you have any questions.

*Reply STOP if you no longer wish to receive reminders.*

— VakilSaathi`
}
