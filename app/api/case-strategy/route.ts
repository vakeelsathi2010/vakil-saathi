import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SYSTEM_PROMPT = `You support an Indian advocate with case-preparation analysis. Return valid JSON only with keys: successProbability (integer 0-100), riskFactors (string array), nextSteps (string array), strategySummary (string), reviewNotice (string). Do not make guarantees, cite invented law, or present output as legal advice. State that the advocate must verify facts, law, limitation, court practice and filings.`

export async function POST(request: NextRequest) {
  try {
    const { caseId } = await request.json() as { caseId?: string }
    if (!caseId) return NextResponse.json({ error: 'Case is required.' }, { status: 400 })
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })
    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
    if (!advocate) return NextResponse.json({ error: 'Advocate profile not found.' }, { status: 404 })
    const { data: subscription } = await supabase.from('advocate_subscriptions').select('plan, status, expires_at').eq('advocate_id', advocate.id).maybeSingle()
    const allowed = subscription?.plan === 'strategy_monthly' && subscription.status === 'active' && (!subscription.expires_at || new Date(subscription.expires_at) > new Date())
    if (!allowed) return NextResponse.json({ error: 'Case Strategy is available with the ₹300/month plan.', upgradeRequired: true }, { status: 402 })
    const { data: caseData } = await supabase.from('cases').select('case_number, case_title, court_name, judge_name, case_type, opposite_party, status, notes').eq('id', caseId).eq('advocate_id', advocate.id).single()
    if (!caseData) return NextResponse.json({ error: 'Case not found.' }, { status: 404 })
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Case Strategy AI is not configured yet.' }, { status: 503 })
    const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514', max_tokens: 900, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: `Analyse these case details for internal preparation only:\n${JSON.stringify(caseData)}` }] }) })
    if (!response.ok) return NextResponse.json({ error: 'Strategy service could not generate a response.' }, { status: 502 })
    const claude = await response.json() as { content?: Array<{ text?: string }> }
    const text = claude.content?.find(item => item.text)?.text || ''
    const strategy = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''))
    const { error: saveError } = await supabase.from('case_strategies').insert({ case_id: caseId, advocate_id: advocate.id, strategy })
    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })
    return NextResponse.json({ success: true, strategy })
  } catch { return NextResponse.json({ error: 'Could not generate a case strategy. Review the case details and try again.' }, { status: 500 }) }
}
