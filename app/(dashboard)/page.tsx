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
import { Clock3, Gavel, Landmark } from 'lucide-react'
import CauseListNotifications, { type CauseAlertCase } from '@/components/CauseListNotifications'

interface CauseListHearing {
  id: string
  hearing_date: string
  hearing_time?: string | null
  hearing_purpose?: string | null
  cases: {
    id: string
    case_number: string
    case_title?: string | null
    court_name: string
    judge_name?: string | null
    notes?: string | null
  } | null
}

function indiaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function courtNumberFromNotes(notes?: string | null) {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes) as { court_number?: string }
    return parsed.court_number?.trim() || null
  } catch {
    return null
  }
}

function deadlineDaysFromToday(value: string, todayKey: string) {
  const [year, month, day] = value.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number)
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86_400_000)
}

function deadlinesFromCase(caseItem: { id: string; case_number: string; notes?: string | null }, todayKey: string) {
  if (!caseItem.notes) return []
  try {
    const metadata = JSON.parse(caseItem.notes) as {
      limitation_date?: string
      limitation_type?: string
      next_action?: string
      next_action_deadline?: string
    }
    return [
      metadata.limitation_date ? { id: `${caseItem.id}-limitation`, caseId: caseItem.id, caseNumber: caseItem.case_number, label: metadata.limitation_type || 'Limitation deadline', date: metadata.limitation_date, daysLeft: deadlineDaysFromToday(metadata.limitation_date, todayKey) } : null,
      metadata.next_action_deadline ? { id: `${caseItem.id}-action`, caseId: caseItem.id, caseNumber: caseItem.case_number, label: metadata.next_action || 'Next action', date: metadata.next_action_deadline, daysLeft: deadlineDaysFromToday(metadata.next_action_deadline, todayKey) } : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item && /^\d{4}-\d{2}-\d{2}$/.test(item.date)))
  } catch {
    return []
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const cookieStore = await cookies()
  const isGuest = cookieStore.get('vakil_guest')?.value === '1'
  const isHindi = cookieStore.get('vakil_language_v3')?.value === 'hi'
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

  const today = indiaDateKey()
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = indiaDateKey(tomorrowDate)

  const [casesRes, clientsRes, hearingsRes, upcomingRes, remindersRes, causeListRes, deadlineCasesRes] =
    await Promise.all([
      supabase
        .from('cases')
        .select('id', { count: 'exact' })
        .eq('advocate_id', advocate.id)
        .neq('status', 'Disposed'),
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
      supabase
        .from('hearings')
        .select(`
          id, hearing_date, hearing_time, hearing_purpose,
          cases(id, case_number, case_title, court_name, judge_name, notes)
        `)
        .eq('advocate_id', advocate.id)
        .gte('hearing_date', today)
        .lte('hearing_date', tomorrow)
        .order('hearing_date', { ascending: true })
        .order('hearing_time', { ascending: true }),
      supabase
        .from('cases')
        .select('id, case_number, notes')
        .eq('advocate_id', advocate.id)
        .neq('status', 'Disposed'),
    ])

  const stats = [
    {
      label: isHindi ? 'सक्रिय केस' : 'Active Cases',
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
      label: isHindi ? 'आगामी सुनवाई' : 'Upcoming Hearings',
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
  const causeList = (causeListRes.data ?? []) as unknown as CauseListHearing[]
  const todayCauseList = causeList.filter((hearing) => hearing.hearing_date === today)
  const tomorrowCauseList = causeList.filter((hearing) => hearing.hearing_date === tomorrow)
  const criticalDeadlines = (deadlineCasesRes.data ?? [])
    .flatMap(caseItem => deadlinesFromCase(caseItem, today))
    .filter(item => item.daysLeft <= 7)
    .sort((first, second) => first.daysLeft - second.daysLeft)
  const toAlertCases = (hearings: CauseListHearing[]): CauseAlertCase[] => hearings.map(hearing => ({
    caseNumber: hearing.cases?.case_number || (isHindi ? 'केस' : 'Case'),
    court: hearing.cases?.court_name || (isHindi ? 'न्यायालय नहीं जोड़ा' : 'Court not added'),
    courtNumber: courtNumberFromNotes(hearing.cases?.notes),
    judge: hearing.cases?.judge_name,
    stage: hearing.hearing_purpose,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isHindi ? 'स्वागत है' : 'Welcome'}, Adv. {advocate.full_name.split(' ')[0]}! 👋
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
          {isHindi ? 'नई सुनवाई' : 'New Hearing'}
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-purple-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-indigo-600" />
              <h2 className="font-bold text-gray-900">{isHindi ? 'आज और कल की वाद सूची' : "Today & Tomorrow's Cause List"}</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">{isHindi ? 'न्यायालय, न्यायाधीश और केस की स्थिति एक नजर में' : 'Court, judge and case stage at one glance'}</p>
          </div>
          <CauseListNotifications userId={user.id} todayCases={toAlertCases(todayCauseList)} tomorrowCases={toAlertCases(tomorrowCauseList)} />
        </div>
        <div className="grid divide-y divide-gray-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <CauseListDay title={isHindi ? 'आज' : 'Today'} dateKey={today} hearings={todayCauseList} accent="red" isHindi={isHindi} />
          <CauseListDay title={isHindi ? 'कल' : 'Tomorrow'} dateKey={tomorrow} hearings={tomorrowCauseList} accent="orange" isHindi={isHindi} />
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-500">
          {isHindi ? 'VakilSaathi खुलने पर डिवाइस अलर्ट दिखाई देंगे। पूरी तरह स्वचालित बैकग्राउंड पुश बाद में सशुल्क सूचना सेवा का हिस्सा होगा।' : 'Device alerts appear when VakilSaathi is opened. Fully automatic background push will be part of the paid notification service later.'}
        </div>
      </section>

      {criticalDeadlines.length > 0 && (
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100"><AlertCircle className="h-5 w-5 text-orange-700" /></div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">{isHindi ? `${criticalDeadlines.length} महत्वपूर्ण समय-सीमा पर ध्यान दें` : `${criticalDeadlines.length} critical deadline${criticalDeadlines.length === 1 ? '' : 's'} need attention`}</h2>
                <div className="mt-2 space-y-1.5">
                  {criticalDeadlines.slice(0, 3).map(item => (
                    <Link key={item.id} href={`/dashboard/cases/${item.caseId}`} className="flex flex-wrap items-center gap-x-2 text-xs text-gray-700 hover:text-blue-700">
                      <strong>{item.caseNumber}</strong>
                      <span>· {item.label}</span>
                      <span className={`rounded-full px-2 py-0.5 font-bold ${item.daysLeft <= 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {item.daysLeft < 0 ? (isHindi ? `${Math.abs(item.daysLeft)} दिन विलंबित` : `${Math.abs(item.daysLeft)}d overdue`) : item.daysLeft === 0 ? (isHindi ? 'आज अंतिम दिन' : 'Due today') : (isHindi ? `${item.daysLeft} दिन शेष` : `${item.daysLeft}d left`)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/dashboard/reminders" className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700">{isHindi ? 'सुरक्षा केंद्र खोलें' : 'Open Safety Center'}</Link>
          </div>
        </section>
      )}

      {/* Today's hearing alert */}
      {todayHearings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-700 text-sm">
              {isHindi ? `⚠️ आज ${todayHearings.length} सुनवाई है!` : `⚠️ ${todayHearings.length} hearing${todayHearings.length === 1 ? '' : 's'} today!`}
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
              {isHindi ? 'आगामी सुनवाई' : 'Upcoming Hearings'}
            </h2>
          </div>
          <Link
            href="/dashboard/hearings"
            className="text-blue-600 text-xs hover:underline"
          >
            {isHindi ? 'सभी देखें →' : 'View all →'}
          </Link>
        </div>

        {upcomingHearings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{isHindi ? 'कोई आगामी सुनवाई नहीं' : 'No upcoming hearings'}</p>
            <Link
              href="/dashboard/hearings"
              className="text-orange-500 text-xs mt-2 inline-block hover:underline"
            >
              {isHindi ? '+ सुनवाई जोड़ें' : '+ Add a hearing'}
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
          { href: '/dashboard/cases', label: isHindi ? '+ नया केस' : '+ New Case', color: 'bg-blue-600' },
          { href: '/dashboard/clients', label: isHindi ? '+ नया मुवक्किल' : '+ New Client', color: 'bg-green-600' },
          { href: '/dashboard/hearings', label: isHindi ? '+ नई सुनवाई' : '+ New Hearing', color: 'bg-orange-500' },
          { href: '/dashboard/reminders', label: isHindi ? 'रिमाइंडर' : 'Reminders', color: 'bg-purple-600' },
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

function CauseListDay({
  title,
  dateKey,
  hearings,
  accent,
  isHindi,
}: {
  title: string
  dateKey: string
  hearings: CauseListHearing[]
  accent: 'red' | 'orange'
  isHindi: boolean
}) {
  const color = accent === 'red'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-orange-200 bg-orange-50 text-orange-700'

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900">{title}</p>
          <p className="text-xs text-gray-400">{new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', weekday: 'short' })}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${color}`}>{hearings.length} {isHindi ? 'केस' : 'cases'}</span>
      </div>

      {hearings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-7 text-center">
          <CheckCauseListEmpty isHindi={isHindi} />
        </div>
      ) : (
        <div className="space-y-2.5">
          {hearings.map((hearing) => {
            const caseData = hearing.cases
            const courtNumber = courtNumberFromNotes(caseData?.notes)
            return (
              <Link key={hearing.id} href={caseData?.id ? `/dashboard/cases/${caseData.id}` : '/dashboard/hearings'} className="block rounded-xl border border-gray-100 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{caseData?.case_number || (isHindi ? 'केस' : 'Case')}</p>
                    {caseData?.case_title && <p className="mt-0.5 truncate text-xs text-gray-500">{caseData.case_title}</p>}
                  </div>
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                    <Clock3 className="h-3 w-3" /> {hearing.hearing_time?.slice(0, 5) || (isHindi ? 'समय बाकी' : 'Time pending')}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5 text-gray-400" />{caseData?.court_name || (isHindi ? 'न्यायालय बाकी' : 'Court pending')}{courtNumber ? ` • ${isHindi ? 'कक्ष' : 'Court'} ${courtNumber}` : ''}</span>
                  <span className="inline-flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5 text-gray-400" />{caseData?.judge_name || (isHindi ? 'न्यायाधीश नहीं जोड़ा' : 'Judge not added')} • {hearing.hearing_purpose || (isHindi ? 'स्थिति नहीं जोड़ी' : 'Stage not added')}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CheckCauseListEmpty({ isHindi }: { isHindi: boolean }) {
  return (
    <>
      <Calendar className="mx-auto h-7 w-7 text-gray-300" />
      <p className="mt-2 text-sm font-medium text-gray-500">{isHindi ? 'कोई केस सूचीबद्ध नहीं' : 'No case listed'}</p>
    </>
  )
}

function GuestDashboard({ isHindi }: { isHindi: boolean }) {
  const emptyStats = [
    { label: isHindi ? 'सक्रिय केस' : 'Active Cases', value: 0, icon: Briefcase, bg: 'bg-blue-500', href: '/dashboard/cases' },
    { label: isHindi ? 'कुल मुवक्किल' : 'Total Clients', value: 0, icon: Users, bg: 'bg-green-500', href: '/dashboard/clients' },
    { label: isHindi ? 'आगामी सुनवाई' : 'Upcoming Hearings', value: 0, icon: Calendar, bg: 'bg-orange-500', href: '/dashboard/hearings' },
    { label: isHindi ? 'भेजे गए रिमाइंडर' : 'Reminders Sent', value: 0, icon: Bell, bg: 'bg-purple-500', href: '/dashboard/reminders' },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <p className="font-semibold text-purple-800">{isHindi ? 'आप अतिथि मोड में हैं' : 'You are exploring Guest Mode'}</p>
        <p className="mt-1 text-sm text-purple-600">
          {isHindi ? 'यह एक खाली अस्थायी कार्यक्षेत्र है। अपना डेटा स्थायी रूप से सुरक्षित करने के लिए मुफ़्त खाता बनाएँ।' : 'This is an empty temporary workspace. Create a free account to save your data permanently.'}
        </p>
        <Link href="/register" className="mt-3 inline-flex rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
          {isHindi ? 'मुफ़्त खाता बनाएँ' : 'Create Free Account'}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{isHindi ? 'स्वागत है, अतिथि!' : 'Welcome, Guest!'} 👋</h1>
        <p className="mt-0.5 text-sm text-gray-500">{isHindi ? 'अपना पहला केस या मुवक्किल जोड़कर शुरू करें' : 'Start by adding your first case or client'}</p>
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
        <h2 className="font-semibold text-gray-900">{isHindi ? 'आपका कार्यक्षेत्र खाली है' : 'Your workspace is empty'}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          {isHindi ? 'अपना पहला रिकॉर्ड जोड़ने के लिए केस रिपोर्ट या मुवक्किल खोलें।' : 'Open Case Reports or Clients to add your first record.'}
        </p>
      </div>
    </div>
  )
}
