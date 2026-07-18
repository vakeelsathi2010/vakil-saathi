import { notFound } from 'next/navigation'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import ClientPortalView from '@/src/components/ClientPortalView'

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[a-zA-Z0-9-]{32,150}$/.test(token)) notFound()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const supabase = await createClient()
  const { data } = await supabase.rpc('client_portal_data', { portal_token_hash: tokenHash })
  if (!data) notFound()
  return <ClientPortalView portal={data} token={token} />
}
