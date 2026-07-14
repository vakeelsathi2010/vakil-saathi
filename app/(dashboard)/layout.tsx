import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isGuest = (await cookies()).get('vakil_guest')?.value === '1'

  if (!user && !isGuest) redirect('/login')

  const { data: advocate } = user
    ? await supabase
        .from('advocates')
        .select('full_name')
        .eq('user_id', user.id)
        .single()
    : { data: null }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar advocateName={isGuest ? 'Guest User' : advocate?.full_name} isGuest={isGuest} />
      <main className="flex-1 overflow-y-auto pt-14 pb-24 lg:pt-0 lg:pb-0">
        <div className="max-w-5xl mx-auto px-5 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
