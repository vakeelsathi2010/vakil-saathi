import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdvocate() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Sign in is required.')
  const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
  if (!advocate) throw new Error('Advocate profile not found.')
  return { supabase, advocateId: advocate.id }
}

export async function GET() {
  try {
    const { supabase, advocateId } = await getAdvocate()
    const { data, error } = await supabase.from('bail_details').select('*, cases(case_number, case_title, court_name, clients(full_name))').eq('advocate_id', advocateId).order('updated_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ success: true, bailDetails: data || [] })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Could not load bail details.' }, { status: 401 }) }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, advocateId } = await getAdvocate()
    const data = await request.json() as Record<string, unknown>
    const caseId = String(data.caseId || '')
    if (!caseId) return NextResponse.json({ success: false, error: 'Select a bail case.' }, { status: 400 })
    const { data: caseData } = await supabase.from('cases').select('id, case_type').eq('id', caseId).eq('advocate_id', advocateId).single()
    if (!caseData) return NextResponse.json({ success: false, error: 'Case not found.' }, { status: 404 })
    if (String(caseData.case_type).toLowerCase() !== 'bail') return NextResponse.json({ success: false, error: 'Bail details can only be saved for a Bail case.' }, { status: 400 })
    const record = { case_id: caseId, advocate_id: advocateId, bail_amount: data.bailAmount ? Number(data.bailAmount) : null, payment_status: String(data.paymentStatus || 'Pending'), surety_name: String(data.suretyName || ''), surety_phone: String(data.suretyPhone || ''), surety_address: String(data.suretyAddress || ''), release_order_received: Boolean(data.releaseOrderReceived), release_order_number: String(data.releaseOrderNumber || ''), release_date: data.releaseDate || null, notes: String(data.notes || ''), updated_at: new Date().toISOString() }
    const { data: saved, error } = await supabase.from('bail_details').upsert(record, { onConflict: 'case_id' }).select('*').single()
    if (error) throw error
    return NextResponse.json({ success: true, bail: saved })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Could not save bail details.' }, { status: 400 }) }
}
