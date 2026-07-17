import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface VoiceUpdate {
  id: string
  transcript: string
  language: string
  captured_at: string
}

function parseMetadata(notes?: string | null): Record<string, unknown> {
  if (!notes) return {}
  try { return JSON.parse(notes) as Record<string, unknown> } catch { return { legacy_notes: notes } }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { transcript?: unknown; language?: unknown; caseId?: unknown; capturedAt?: unknown }
    const transcript = String(body.transcript || '').trim()
    const caseId = String(body.caseId || '').trim()
    const language = String(body.language || 'hi-IN')
    const capturedAt = String(body.capturedAt || new Date().toISOString())

    if (!caseId || !transcript) return NextResponse.json({ error: 'caseId and transcript are required' }, { status: 400 })
    if (transcript.length > 5000) return NextResponse.json({ error: 'Transcript is too long' }, { status: 400 })

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Sign in is required to save a voice update' }, { status: 401 })

    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
    if (!advocate) return NextResponse.json({ error: 'Advocate profile not found' }, { status: 404 })

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, notes')
      .eq('id', caseId)
      .eq('advocate_id', advocate.id)
      .single()
    if (caseError || !caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    const metadata = parseMetadata(caseData.notes)
    const existing = Array.isArray(metadata.voice_updates) ? metadata.voice_updates as VoiceUpdate[] : []
    const update: VoiceUpdate = { id: `voice-${Date.now()}`, transcript, language, captured_at: capturedAt }
    const { error: updateError } = await supabase
      .from('cases')
      .update({ notes: JSON.stringify({ ...metadata, voice_updates: [update, ...existing] }) })
      .eq('id', caseId)
      .eq('advocate_id', advocate.id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ success: true, update })
  } catch {
    return NextResponse.json({ error: 'Invalid voice update request' }, { status: 400 })
  }
}

