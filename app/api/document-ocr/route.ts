/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const { extractCourtOrder } = require('../../../backend/services/claudeOcr') as { extractCourtOrder: (args: { buffer: Buffer; mimeType: string; apiKey: string | undefined; model: string | undefined }) => Promise<Record<string, unknown>> }
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

async function access() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Sign in is required.')
  const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
  if (!advocate) throw new Error('Advocate profile not found.')
  const { data: subscription } = await supabase.from('advocate_subscriptions').select('plan, status, expires_at').eq('advocate_id', advocate.id).maybeSingle()
  const paid = ['ocr_monthly', 'pro_monthly'].includes(subscription?.plan || '') && subscription?.status === 'active' && (!subscription?.expires_at || new Date(subscription.expires_at) > new Date())
  if (!paid) throw new Error('OCR is available with the ₹200/month plan.')
  return { supabase, advocateId: advocate.id }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, advocateId } = await access()
    const form = await request.formData()
    const caseId = String(form.get('caseId') || '')
    const file = form.get('file')
    if (!caseId || !(file instanceof File) || !ALLOWED.includes(file.type) || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Use a PDF, JPG, PNG or WebP court order up to 8 MB.' }, { status: 400 })
    const { data: caseData } = await supabase.from('cases').select('id').eq('id', caseId).eq('advocate_id', advocateId).single()
    if (!caseData) return NextResponse.json({ error: 'Case not found.' }, { status: 404 })
    const extraction = await extractCourtOrder({ buffer: Buffer.from(await file.arrayBuffer()), mimeType: file.type, apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL })
    await supabase.from('case_ocr_runs').insert({ case_id: caseId, advocate_id: advocateId, source_file_name: file.name, extraction })
    return NextResponse.json({ success: true, extraction })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'OCR could not process this document.' }, { status: 403 }) }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, advocateId } = await access()
    const { caseId, extraction } = await request.json() as { caseId?: string; extraction?: { status?: string; nextDate?: string; actionItems?: Array<{ title?: string; dueDate?: string | null }> } }
    if (!caseId || !extraction) return NextResponse.json({ error: 'Case and extraction are required.' }, { status: 400 })
    const { error } = await supabase.from('cases').update({ status: extraction.status || 'Active', updated_at: new Date().toISOString() }).eq('id', caseId).eq('advocate_id', advocateId)
    if (error) throw error
    if (extraction.nextDate) await supabase.from('hearings').insert({ case_id: caseId, advocate_id: advocateId, hearing_date: extraction.nextDate, next_date: extraction.nextDate, hearing_purpose: 'OCR extracted next date' })
    const actions = (extraction.actionItems || []).filter(item => item.title).map(item => ({ case_id: caseId, advocate_id: advocateId, title: item.title, due_date: item.dueDate || null, status: 'open' }))
    if (actions.length) await supabase.from('case_action_items').insert(actions)
    return NextResponse.json({ success: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not apply OCR results.' }, { status: 403 }) }
}
