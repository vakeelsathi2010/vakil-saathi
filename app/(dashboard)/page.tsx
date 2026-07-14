import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ensureAdvocateProfile } from '@/lib/supabase/ensure-advocate'
import {
  getHearingUrgency,
  urgencyColor,
  urgencyLabel,
  daysUntilHearing,
} from '@/lib/utils'
import { Briefcase, Users, Calendar, Bell, Plus, AlertCircle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const cookieStore = await cookies()
  const isGuest = cookieStore.get('vakil_guest')?.value === '1'
  const isHindi = cookieStore.get('vakil_language_v2')?.value === 'hi'
  if (!user && !isGuest) redirect('/login')
  if (!user && isGuest) return <GuestDashboard isHindi={isHindi} />
  if (!user) redirect('/login')

  const { advocate, error: profileError } = await ensureAdvocateProfile(
    supabase,
    user
  )

  if (!advocate) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        <h1 className="font-semibold">Profile could not be prepared</h1>
        <p className="mt-1 text-sm">
          Please refresh once. {profileError ? `Error: ${profileError}` : ''}
        </p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const [casesRes, clientsRes, hearingsRes, upcomingRes, remindersRes] =
    await Promise.all([
      supabase
        .from('cases')
        .select('id', { count: 'exact' })
        .eq('advocate_id', advocate.id)
        .eq('status', 'Active'),
      supabase
        .from('clients')
        .select('id', { count: 'exact' })
        .eq('advocate_id', advocate.id),
      supabase
        .from('hearings')
        .select('id', { count: 'exact' })
        .eq('advocate_id', advocate.id)
        .gte('hearing_date', today),
      supabase
        .from('hearings')
        .select(
          `id, hearing_date, hearing_purpose,
           cases(case_number, case_title, court_name)`
        )
        .eq('advocate_id', advocate.id)
        .gte('hearing_date', today)
        .order('hearing_date', { ascending: true })
        .limit(6),
      supabase
        .from('reminder_logs')
        .select('id', { count: 'exact' }),
    ])

  const stats = [
    {
      label: isHindi ? 'सक्रिय मुकदमे' : 'Active Cases',
      value: casesRes.count ?? 0,
      icon: Briefcase,
      bg: 'bg-blue-500',
      href: '/dashboard/cases',
    },
    {
      label: isHindi ? 'कुल मुवक्किल' : 'Total Clients',
      value: clientsRes.count ?? 0,
      icon: Users,
      bg: 'bg-green-500',
      href: '/dashboard/clients',
    },
    {
      label: isHindi ? 'आने वाली पेशियाँ' : 'Upcoming Hearings',
      value: hearingsRes.count ?? 0,
      icon: Calendar,
      bg: 'bg-orange-500',
      href: '/dashboard/hearings',
    },
    {
      label: isHindi ? 'भेजे गए रिमाइंडर' : 'Reminders Sent',
      value: remindersRes.count ?? 0,
      icon: Bell,
      bg: 'bg-purple-500',
      href: '/dashboard/reminders',
    },
  ]

  const upcomingHearings = upcomingRes.data ?? []
  const todayHearings = upcomingHearings.filter(
    (h) => daysUntilHearing(h.hearing_date) === 0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isHindi ? 'प्रणाम' : 'Welcome'}, Adv. {advocate.full_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('hi-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Link
          href="/dashboard/hearings"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nai Peshi
        </Link>
      </div>

      {/* Aaj ki hearing alert */}
      {todayHearings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-700 text-sm">
              ⚠️ Aaj {todayHearings.length} peshi hai!
            </p>
            {todayHearings.map((h) => (
              <p key={h.id} className="text-red-600 text-sm mt-1">
                {(h.cases as unknown as { case_number: string } | null)?.case_number} —{' '}
                {(h.cases as unknown as { court_name: string } | null)?.court_name}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, bg, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 hover:shadow-md transition"
          >
            <div className={`${bg} p-2.5 rounded-xl flex-shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-gray-500 text-xs leading-tight">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Upcoming Hearings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-gray-900 text-sm">
              Aane Wali Peshian
            </h2>
          </div>
          <Link
            href="/dashboard/hearings"
            className="text-blue-600 text-xs hover:underline"
          >
            Sab dekho →
          </Link>
        </div>

        {upcomingHearings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Koi upcoming peshi nahi</p>
            <Link
              href="/dashboard/hearings"
              className="text-orange-500 text-xs mt-2 inline-block hover:underline"
            >
              + Nai peshi daalo
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {upcomingHearings.map((h) => {
              const urgency = getHearingUrgency(h.hearing_date)
              const caseData = h.cases as unknown as {
                case_number: string
                case_title?: string
                court_name: string
              } | null
              return (
                <div
                  key={h.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[40px] bg-gray-50 rounded-lg py-1.5 px-2">
                      <p className="text-lg font-bold text-gray-900 leading-none">
                        {new Date(h.hearing_date).getDate()}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase">
                        {new Date(h.hearing_date).toLocaleDateString('en', {
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {caseData?.case_number}
                        {caseData?.case_title ? ` — ${caseData.case_title}` : ''}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {caseData?.court_name}
                      </p>
                      {h.hearing_purpose && (
                        <p className="text-gray-400 text-xs">{h.hearing_purpose}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium ${urgencyColor(urgency)}`}
                  >
                    {urgencyLabel(urgency)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/dashboard/cases', label: '+ Naya Case', color: 'bg-blue-600' },
          { href: '/dashboard/clients', label: '+ Naya Client', color: 'bg-green-600' },
          { href: '/dashboard/hearings', label: '+ Nai Peshi', color: 'bg-orange-500' },
          { href: '/dashboard/reminders', label: 'Reminders', color: 'bg-purple-600' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`${action.color} text-white text-center py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition`}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function GuestDashboard({ isHindi }: { isHindi: boolean }) {
  const emptyStats = [
    { label: isHindi ? 'सक्रिय मुकदमे' : 'Active Cases', value: 0, icon: Briefcase, bg: 'bg-blue-500', href: '/dashboard/cases' },
    { label: isHindi ? 'कुल मुवक्किल' : 'Total Clients', value: 0, icon: Users, bg: 'bg-green-500', href: '/dashboard/clients' },
    { label: isHindi ? 'आने वाली पेशियाँ' : 'Upcoming Hearings', value: 0, icon: Calendar, bg: 'bg-orange-500', href: '/dashboard/hearings' },
    { label: isHindi ? 'भेजे गए रिमाइंडर' : 'Reminders Sent', value: 0, icon: Bell, bg: 'bg-purple-500', href: '/dashboard/reminders' },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <p className="font-semibold text-purple-800">{isHindi ? 'आप गेस्ट मोड में हैं' : 'You are exploring Guest Mode'}</p>
        <p className="mt-1 text-sm text-purple-600">
          {isHindi ? 'यह एक खाली अस्थायी workspace है। स्थायी रूप से डेटा सेव करने के लिए मुफ़्त अकाउंट बनाएँ।' : 'This is an empty temporary workspace. Create a free account to save your data permanently.'}
        </p>
        <Link href="/register" className="mt-3 inline-flex rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
          {isHindi ? 'मुफ़्त अकाउंट बनाएँ' : 'Create Free Account'}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{isHindi ? 'प्रणाम, गेस्ट जी!' : 'Welcome, Guest!'} 👋</h1>
        <p className="mt-0.5 text-sm text-gray-500">{isHindi ? 'अपना पहला मुकदमा या मुवक्किल जोड़कर शुरू करें' : 'Start by adding your first case or client'}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {emptyStats.map(({ label, value, icon: Icon, bg, href }) => (
          <Link key={label} href={href} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className={`${bg} flex-shrink-0 rounded-xl p-2.5`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs leading-tight text-gray-500">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <Calendar className="mx-auto mb-3 h-10 w-10 text-purple-400" />
        <h2 className="font-semibold text-gray-900">{isHindi ? 'आपका workspace अभी खाली है' : 'Your workspace is empty'}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          {isHindi ? 'Cases Diary या Clients में जाकर अपना पहला रिकॉर्ड जोड़ें।' : 'Open Cases Diary or Clients to add your first record.'}
        </p>
      </div>
    </div>
  )
}
