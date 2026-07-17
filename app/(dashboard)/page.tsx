import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Dashboard from '@/src/components/Dashboard'
import { createClient } from '@/lib/supabase/server'
import { ensureAdvocateProfile } from '@/lib/supabase/ensure-advocate'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const cookieStore = await cookies()
  const isGuest = cookieStore.get('vakil_guest')?.value === '1'
  if (!session?.user && !isGuest) redirect('/login')
  if (!session?.user) return <Dashboard isGuest />

  const { advocate, error } = await ensureAdvocateProfile(supabase, session.user)
  if (!advocate) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700"><h1 className="font-semibold">Profile could not be prepared</h1><p className="mt-1 text-sm">Please refresh once. {error || ''}</p></div>
  return <Dashboard advocateId={advocate.id} advocateName={advocate.full_name} />
}
