import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, buildAdvocateReminderMsg, buildClientReminderMsg } from '@/lib/whatsapp'
import { sendSMS, buildAdvocateSMS, buildClientSMS } from '@/lib/sms'
import { formatDate } from '@/lib/utils'

// Supabase admin client (the service role bypasses RLS).
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================================
// POST /api/send-reminders
// Manual reminder: { hearing_id: string }
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { hearing_id } = await req.json()

    if (!hearing_id) {
      return NextResponse.json({ success: false, error: 'hearing_id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Fetch hearing data.
    const { data: hearing, error } = await supabase
      .from('hearings')
      .select(`
        id, hearing_date, hearing_time,
        cases(
          case_number, court_name,
          clients(full_name, phone, consent_given)
        ),
        advocates(full_name, phone)
      `)
      .eq('id', hearing_id)
      .single()

    if (error || !hearing) {
      return NextResponse.json({ success: false, error: 'Hearing not found' }, { status: 404 })
    }

    const caseData = hearing.cases as unknown as { case_number: string; court_name: string; clients?: { full_name: string; phone: string; consent_given: boolean } }
    const advocateData = hearing.advocates as unknown as { full_name: string; phone: string }
    const clientData = caseData?.clients

    const hearingDateStr = formatDate(hearing.hearing_date)

    const results = { advocate: false, client: false }

    // Send the advocate reminder.
    if (advocateData?.phone) {
      const msg = buildAdvocateReminderMsg({
        advocateName: advocateData.full_name,
        clientName: clientData?.full_name ?? 'N/A',
        caseNumber: caseData.case_number,
        courtName: caseData.court_name,
        hearingDate: hearingDateStr,
        hearingTime: hearing.hearing_time ?? undefined,
      })
      const smsTxt = buildAdvocateSMS({
        caseNumber: caseData.case_number,
        clientName: clientData?.full_name ?? 'N/A',
        courtName: caseData.court_name,
        hearingDate: hearingDateStr,
      })

      // Try WhatsApp first, then fall back to SMS.
      const waRes = await sendWhatsApp({ to: advocateData.phone, message: msg })
      if (!waRes.success) {
        await sendSMS({ to: advocateData.phone, message: smsTxt })
      }

      // Record the reminder attempt.
      await supabase.from('reminder_logs').insert({
        hearing_id,
        recipient_type: 'advocate',
        phone: advocateData.phone,
        channel: waRes.success ? 'whatsapp' : 'sms',
        status: 'sent',
      })

      // Update the hearing.
      await supabase.from('hearings').update({ reminder_sent_advocate: true }).eq('id', hearing_id)
      results.advocate = true
    }

    // Send the client reminder only when consent has been recorded.
    if (clientData?.phone && clientData.consent_given) {
      const msg = buildClientReminderMsg({
        clientName: clientData.full_name,
        advocateName: advocateData.full_name,
        caseNumber: caseData.case_number,
        courtName: caseData.court_name,
        hearingDate: hearingDateStr,
        hearingTime: hearing.hearing_time ?? undefined,
      })
      const smsTxt = buildClientSMS({
        caseNumber: caseData.case_number,
        advocateName: advocateData.full_name,
        courtName: caseData.court_name,
        hearingDate: hearingDateStr,
      })

      const waRes = await sendWhatsApp({ to: clientData.phone, message: msg })
      if (!waRes.success) {
        await sendSMS({ to: clientData.phone, message: smsTxt })
      }

      await supabase.from('reminder_logs').insert({
        hearing_id,
        recipient_type: 'client',
        phone: clientData.phone,
        channel: waRes.success ? 'whatsapp' : 'sms',
        status: 'sent',
      })

      await supabase.from('hearings').update({ reminder_sent_client: true }).eq('id', hearing_id)
      results.client = true
    }

    return NextResponse.json({ success: true, results })

  } catch (err: unknown) {
    console.error('Reminder API error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

// ============================================================
// GET /api/send-reminders
// Scheduled job: send reminders for all hearings tomorrow.
// Call this endpoint daily from Vercel Cron or another scheduler.
// Header: Authorization: Bearer {CRON_SECRET}
// ============================================================
export async function GET(req: NextRequest) {
  // Verify the scheduler secret.
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Find tomorrow's hearings that have not already been reminded.
  const { data: hearings, error } = await supabase
    .from('hearings')
    .select('id')
    .eq('hearing_date', tomorrowStr)
    .eq('reminder_sent_advocate', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = []
  for (const h of hearings ?? []) {
    // Send a reminder for each hearing.
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hearing_id: h.id }),
    })
    const data = await res.json()
    results.push({ hearing_id: h.id, ...data })
  }

  return NextResponse.json({
    success: true,
    date: tomorrowStr,
    total: hearings?.length ?? 0,
    results,
  })
}
