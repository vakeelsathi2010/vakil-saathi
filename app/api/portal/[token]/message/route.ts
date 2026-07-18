import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const { message } = await request.json() as { message?: string }
    if (!message?.trim() || message.trim().length > 2000) return NextResponse.json({ success: false, error: 'Message must be between 1 and 2000 characters.' }, { status: 400 })
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('client_portal_add_message', { portal_token_hash: createHash('sha256').update(token).digest('hex'), client_message: message.trim() })
    if (error || !data) return NextResponse.json({ success: false, error: 'This portal link is no longer active.' }, { status: 403 })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ success: false, error: 'Invalid message request.' }, { status: 400 }) }
}
