import axios from 'axios'

interface SendSMSParams {
  to: string    // 10-digit Indian mobile number
  message: string
}

export async function sendSMS({ to, message }: SendSMSParams) {
  const cleanPhone = to.replace(/\D/g, '').slice(-10) // last 10 digits

  try {
    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: process.env.FAST2SMS_API_KEY,
        message,
        language: 'english',
        route: 'q',   // Quick/Transactional route
        numbers: cleanPhone,
      },
    })
    return { success: true, data: response.data }
  } catch (error: unknown) {
    const axiosError = error as { response?: { data: unknown }; message?: string }
    console.error('SMS send error:', axiosError?.response?.data || axiosError?.message)
    return { success: false, error: axiosError?.response?.data }
  }
}

export function buildAdvocateSMS(params: {
  caseNumber: string
  clientName: string
  courtName: string
  hearingDate: string
}) {
  return `VakilSaathi: Hearing tomorrow - Case ${params.caseNumber}, ${params.clientName}, ${params.courtName}, ${params.hearingDate}.`
}

export function buildClientSMS(params: {
  caseNumber: string
  advocateName: string
  courtName: string
  hearingDate: string
}) {
  return `VakilSaathi: Your court hearing is tomorrow. Case ${params.caseNumber}, Adv. ${params.advocateName}, ${params.courtName}, ${params.hearingDate}. Please arrive on time.`
}
