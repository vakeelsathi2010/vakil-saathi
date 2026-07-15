import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ensureAdvocateProfile } from '@/lib/supabase/ensure-advocate'
import Sidebar from '@/components/Sidebar'
import AdvocateProfileSetup from '@/components/AdvocateProfileSetup'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const isGuest = (await cookies()).get('vakil_guest')?.value === '1'

  if (!user && !isGuest) redirect('/login')

  const advocate = user
    ? (await ensureAdvocateProfile(supabase, user)).advocate
    : null
  const metadata = user?.user_metadata ?? {}
  const savedPhone = String(metadata.whatsapp_number || metadata.phone || advocate?.phone || '')
  const hasValidPhone = /^[6-9]\d{9}$/.test(savedPhone.replace(/\D/g, '').slice(-10))
  const phoneStatus = String(metadata.phone_verification_status || '')
  const hasAcceptedPhoneStatus = phoneStatus === 'user_confirmed_unverified' || phoneStatus === 'otp_verified'
  const profileSetupComplete = metadata.profile_setup_completed === true && metadata.whatsapp_opt_in === true && hasValidPhone && hasAcceptedPhoneStatus

  if (user && advocate && !profileSetupComplete) {
    return (
      <AdvocateProfileSetup
        advocateId={advocate.id}
        initialName={advocate.full_name}
      />
    )
  }

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
