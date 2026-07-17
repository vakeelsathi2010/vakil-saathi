'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { AlertTriangle, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'

const DAY = 86_400_000

function dateKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function addDays(key, amount) {
  const value = new Date(`${key}T00:00:00+05:30`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function dateDifference(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / DAY)
}

function safeArray(result) { return result?.data || [] }

function Skeleton() {
  return <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5"><div className="h-5 w-24 rounded bg-gray-200" /><div className="mt-3 h-8 w-16 rounded bg-gray-100" /></div>
}

export default function Dashboard({ advocateId, advocateName, isGuest }) {
  const { tr } = useLanguage()
  const [filter, setFilter] = useState('today')
  const [data, setData] = useState({ active: 0, pending: 0, next7: 0, overdue: 0, remindersToday: 0, schedule: [], actions: [], overdueCases: [], today: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(5)
  const [refreshing, setRefreshing] = useState(false)

  const range = useMemo(() => {
    const today = dateKey(new Date())
    return filter === 'today' ? { from: today, to: today } : filter === 'week' ? { from: today, to: addDays(today, 6) } : { from: today, to: addDays(today, 29) }
  }, [filter])

  const loadDashboard = useCallback(async (manual = false) => {
    if (isGuest || !advocateId) {
      setData({ active: 0, pending: 0, next7: 0, overdue: 0, remindersToday: 0, schedule: [], actions: [], overdueCases: [], today: '' })
      setLoading(false)
      return
    }
    if (manual) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const today = dateKey(new Date())
      const sevenDays = addDays(today, 6)
      const [activeRes, upcomingRes, scheduleRes, actionsRes, olderCasesRes, remindersRes] = await Promise.all([
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('advocate_id', advocateId).neq('status', 'Disposed'),
        supabase.from('hearings').select('id', { count: 'exact', head: true }).eq('advocate_id', advocateId).gte('hearing_date', today).lte('hearing_date', sevenDays),
        supabase.from('hearings').select('id, hearing_date, hearing_time, hearing_purpose, cases(id, case_number, case_title, court_name, case_type)').eq('advocate_id', advocateId).gte('hearing_date', range.from).lte('hearing_date', range.to).order('hearing_date').order('hearing_time').limit(limit),
        supabase.from('case_action_items').select('id, title, due_date, status, cases(id, case_number, case_title)').eq('advocate_id', advocateId).eq('status', 'open').order('due_date').limit(5),
        supabase.from('cases').select('id, case_number, case_title, case_type, created_at').eq('advocate_id', advocateId).neq('status', 'Disposed').order('created_at').limit(100),
        supabase.from('reminder_logs').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00+05:30`).lte('created_at', `${today}T23:59:59+05:30`),
      ])
      if (activeRes.error || upcomingRes.error || scheduleRes.error || olderCasesRes.error) throw new Error(activeRes.error?.message || upcomingRes.error?.message || scheduleRes.error?.message || olderCasesRes.error?.message || 'Unable to load dashboard data')
      const now = new Date()
      const overdueCases = safeArray(olderCasesRes)
        .map(item => ({ ...item, ageMonths: Math.floor((now.getTime() - new Date(item.created_at).getTime()) / DAY / 30) }))
        .filter(item => item.ageMonths > 3)
      setData({
        active: activeRes.count || 0,
        pending: actionsRes.error ? 0 : safeArray(actionsRes).length,
        next7: upcomingRes.count || 0,
        overdue: overdueCases.length,
        remindersToday: remindersRes.error ? 0 : remindersRes.count || 0,
        schedule: safeArray(scheduleRes),
        actions: actionsRes.error ? [] : safeArray(actionsRes),
        overdueCases,
        today,
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data load nahi ho paya')
    } finally { setLoading(false); setRefreshing(false) }
  }, [advocateId, isGuest, limit, range])

  useEffect(() => {
    // This effect intentionally populates dashboard state from Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    if (!advocateId || isGuest) return undefined
    const supabase = createClient()
    const channel = supabase.channel(`dashboard-${advocateId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases', filter: `advocate_id=eq.${advocateId}` }, () => loadDashboard(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hearings', filter: `advocate_id=eq.${advocateId}` }, () => loadDashboard(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'case_action_items', filter: `advocate_id=eq.${advocateId}` }, () => loadDashboard(true))
      .subscribe()
    const interval = window.setInterval(() => loadDashboard(true), 5 * 60 * 1000)
    return () => { window.clearInterval(interval); supabase.removeChannel(channel) }
  }, [advocateId, isGuest, loadDashboard])

  const title = isGuest ? tr('Welcome, Guest!', 'स्वागत है, अतिथि!') : `${tr('Welcome', 'स्वागत है')}, ${advocateName || 'Advocate'}!`
  const stats = [
    { label: tr('Active Cases', 'सक्रिय मामले'), value: data.active, icon: BriefcaseBusiness, color: 'blue', href: '/dashboard/cases' },
    { label: tr('Pending Actions', 'लंबित कार्य'), value: data.pending, icon: ClipboardList, color: 'yellow', href: '/dashboard/tasks' },
    { label: tr('Next 7 Days', 'अगले 7 दिन'), value: data.next7, icon: CalendarDays, color: 'green', href: '/dashboard/hearings' },
    { label: tr('Overdue', 'बकाया'), value: data.overdue, icon: AlertTriangle, color: 'red', href: '/dashboard/cases' },
  ]
  const colors = { blue: 'border-blue-100 bg-blue-50 text-blue-700', yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700', green: 'border-green-200 bg-green-50 text-green-700', red: 'border-red-200 bg-red-50 text-red-700' }

  if (loading) return <div className="space-y-5"><p className="text-sm text-gray-500">{tr('Data is loading...', 'डेटा लोड हो रहा है...')}</p><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map(item => <Skeleton key={item} />)}</div><Skeleton /><Skeleton /></div>
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><AlertTriangle className="mx-auto h-7 w-7 text-red-600" /><h1 className="mt-3 font-bold text-red-900">{tr('Data could not be loaded', 'डेटा लोड नहीं हो पाया')}</h1><p className="mt-1 text-sm text-red-700">{error}</p><button type="button" onClick={() => loadDashboard()} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">{tr('Try again', 'फिर से कोशिश करें')}</button></div>

  return <div className="space-y-5 pb-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">{title} 👋</h1><p className="mt-1 text-sm text-gray-500">{tr('Your workday at a glance', 'आपके काम का पूरा सार एक नज़र में')}</p></div><button type="button" onClick={() => loadDashboard(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{tr('Refresh', 'रीफ्रेश')}</button></header>
    {isGuest && <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">{tr('Start by adding your first case. Sign in to save your workspace permanently.', 'अपना पहला केस जोड़कर शुरुआत करें। स्थायी रूप से सेव करने के लिए साइन इन करें।')}</div>}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(stat => { const Icon = stat.icon; return <Link key={stat.label} href={stat.href} className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${colors[stat.color]}`}><Icon className="h-5 w-5" /><p className="mt-3 text-2xl font-bold text-gray-900">{stat.value}</p><p className="text-sm text-gray-600">{stat.label}</p></Link> })}</section>
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4"><div><h2 className="font-bold text-gray-900">{tr("Today's Schedule", 'आज का शेड्यूल')}</h2><p className="text-xs text-gray-500">{data.remindersToday} {tr('reminders sent today', 'रिमाइंडर आज भेजे गए')}</p></div><div className="flex rounded-lg bg-gray-100 p-1 text-xs font-semibold">{[['today', tr('Today', 'आज')], ['week', tr('This week', 'यह सप्ताह')], ['month', tr('This month', 'यह महीना')]].map(([key, label]) => <button type="button" key={key} onClick={() => { setFilter(key); setLimit(5) }} className={`rounded-md px-3 py-2 ${filter === key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{label}</button>)}</div></div>{data.schedule.length ? <div className="divide-y divide-gray-100">{data.schedule.map(item => { const caseItem = item.cases; const date = new Date(`${item.hearing_date}T00:00:00`); const priority = item.hearing_date === data.today ? '🔴' : '🟡'; return <Link key={item.id} href={caseItem?.id ? `/dashboard/cases/${caseItem.id}` : '/dashboard/hearings'} className="flex items-center gap-3 p-4 transition hover:bg-gray-50"><span className="text-lg">{priority}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{caseItem?.case_title || caseItem?.case_number || tr('Case hearing', 'केस सुनवाई')}</p><p className="truncate text-xs text-gray-500">{caseItem?.court_name || tr('Court not added', 'न्यायालय नहीं जोड़ा')} · {item.hearing_purpose || tr('Hearing', 'सुनवाई')}</p></div><span className="text-xs font-semibold text-gray-500">{item.hearing_time?.slice(0, 5) || date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span><ChevronRight className="h-4 w-4 text-gray-400" /></Link> })}</div> : <div className="p-8 text-center text-sm text-gray-500"><CalendarDays className="mx-auto mb-2 h-7 w-7 text-green-600" />{tr('All clear for this period! 🎉', 'इस अवधि के लिए सब ठीक है! 🎉')}</div>}{data.schedule.length >= limit && <button type="button" onClick={() => setLimit(value => value + 5)} className="w-full border-t border-gray-100 py-3 text-sm font-semibold text-blue-700">{tr('Load more', 'और देखें')}</button>}</section>
    <section className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="border-b border-gray-100 p-4"><h2 className="font-bold text-gray-900">{tr('Action Items', 'कार्य सूची')}</h2></div>{data.actions.length ? <ol className="divide-y divide-gray-100">{data.actions.map((item, index) => { const due = item.due_date && data.today ? dateDifference(data.today, item.due_date) : null; const mark = due !== null && due <= 0 ? '🔴' : due !== null && due <= 3 ? '🟡' : '🟢'; return <Link key={item.id} href={item.cases?.id ? `/dashboard/cases/${item.cases.id}` : '/dashboard/tasks'} className="flex gap-3 p-4 hover:bg-gray-50"><span className="font-bold text-gray-400">{index + 1}.</span><div><p className="text-sm font-semibold text-gray-900">{mark} {item.title}</p><p className="mt-1 text-xs text-gray-500">{item.cases?.case_number || tr('Case', 'केस')} {item.due_date ? `· ${item.due_date}` : ''}</p></div></Link> })}</ol> : <div className="p-8 text-center text-sm text-green-700"><CheckCircle2 className="mx-auto mb-2 h-7 w-7" />{tr('All clear! 🎉', 'सब कुछ ठीक है! 🎉')}</div>}</div><div className="rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="border-b border-gray-100 p-4"><h2 className="font-bold text-gray-900">{tr('Overdue Cases', 'बकाया मामले')}</h2></div>{data.overdueCases.length ? <div className="divide-y divide-gray-100">{data.overdueCases.slice(0, 5).map(item => <Link key={item.id} href={`/dashboard/cases/${item.id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50"><AlertTriangle className="h-5 w-5 text-red-600" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{item.case_title || item.case_number}</p><p className="text-xs text-red-600">{item.ageMonths} {tr('months pending', 'महीने से लंबित')}</p></div></Link>)}</div> : <div className="p-8 text-center text-sm text-green-700"><CheckCircle2 className="mx-auto mb-2 h-7 w-7" />{tr('No overdue cases', 'कोई बकाया नहीं')}</div>}</div></section>
  </div>
}

Dashboard.propTypes = { advocateId: PropTypes.string, advocateName: PropTypes.string, isGuest: PropTypes.bool }
Dashboard.defaultProps = { advocateId: '', advocateName: '', isGuest: false }
