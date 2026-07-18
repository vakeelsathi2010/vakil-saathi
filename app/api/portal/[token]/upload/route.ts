import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || !ALLOWED_TYPES.includes(file.type) || file.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, error: 'Only PDF, image, DOC or DOCX files up to 10 MB are allowed.' }, { status: 400 })
    const supabase = await createClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const { data: portal } = await supabase.rpc('client_portal_data', { portal_token_hash: tokenHash })
    if (!portal?.linkId) return NextResponse.json({ success: false, error: 'This portal link is no longer active.' }, { status: 403 })
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) return NextResponse.json({ success: false, error: 'Portal document upload is not configured yet.' }, { status: 503 })
    const admin = createSupabaseClient(url, serviceRoleKey)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${portal.linkId}/${randomUUID()}-${safeName}`
    const { error: uploadError } = await admin.storage.from('client-portal-uploads').upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { error: recordError } = await admin.from('client_portal_documents').insert({ portal_link_id: portal.linkId, storage_path: storagePath, file_name: file.name, mime_type: file.type, file_size: file.size })
    if (recordError) { await admin.storage.from('client-portal-uploads').remove([storagePath]); throw recordError }
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ success: false, error: 'Document upload failed.' }, { status: 500 }) }
}
