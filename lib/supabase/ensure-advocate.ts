import type { SupabaseClient, User } from '@supabase/supabase-js'

type AdvocateProfile = {
  id: string
  full_name: string
  phone: string
}

export async function ensureAdvocateProfile(
  supabase: SupabaseClient,
  user: User
): Promise<{ advocate: AdvocateProfile | null; error: string | null }> {
  const { data: existing, error: lookupError } = await supabase
    .from('advocates')
    .select('id, full_name, phone')
    .eq('user_id', user.id)
    .maybeSingle()

  if (lookupError) return { advocate: null, error: lookupError.message }
  if (existing) return { advocate: existing, error: null }

  const metadata = user.user_metadata ?? {}
  const emailName = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  const fullName = String(metadata.full_name || emailName || 'Advocate')
  const phone = String(metadata.phone || '0000000000')
  const primaryCourt = String(
    metadata.primary_court || 'District Court, Kanpur Nagar'
  )

  const { data: created, error: createError } = await supabase
    .from('advocates')
    .upsert(
      {
        user_id: user.id,
        full_name: fullName,
        phone,
        bci_number: metadata.bci_number || null,
        bar_association: metadata.bar_association || null,
        courts: Array.isArray(metadata.courts) ? metadata.courts : [primaryCourt],
      },
      { onConflict: 'user_id' }
    )
    .select('id, full_name, phone')
    .single()

  if (createError) return { advocate: null, error: createError.message }
  return { advocate: created, error: null }
}
