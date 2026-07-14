import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureAdvocateProfile } from '@/lib/supabase/ensure-advocate'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 })
  }

  const { advocate, error } = await ensureAdvocateProfile(supabase, user)

  if (error || !advocate) {
    return NextResponse.json(
      { error: error || 'Profile could not be created' },
      { status: 500 }
    )
  }

  return NextResponse.json({ advocate })
}
