'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronRight, CircleDashed, Clock3, ListChecks, Search, UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { localDateKey, parseTaskMetadata, taskTiming, type TaskPriority, type TaskStatus } from '@/lib/tasks'
import { useLanguage } from '@/components/LanguageProvider'

const STORAGE_KEY = 'vakil_guest_cases_v2'
interface TaskCase { id: string; case_number: string; case_title?: string | null; notes?: string | null; clients?: { full_name?: string | null } | null }
type Filter = 'active' | 'today' | 'overdue' | 'completed' | 'all'
const PRIORITY: Record<TaskPriority, { en: string; hi: string; color: string }> = {
  low: { en: 'Low', hi: 'कम', color: 'bg-gray-100 text-gray-600' }, normal: { en: 'Normal', hi: 'सामान्य', color: 'bg-blue-50 text-blue-700' }, high: { en: 'High', hi: 'उच्च', color: 'bg-orange-50 text-orange-700' }, urgent: { en: 'Urgent', hi: 'अत्यावश्यक', color: 'bg-red-50 text-red-700' },
}
const STATUS: Record<TaskStatus, { en: string; hi: string }> = { pending: { en: 'Pending', hi: 'लंबित' }, in_progress: { en: 'In Progress', hi: 'प्रगति पर' }, completed: { en: 'Completed', hi: 'पूर्ण' } }

export default function TasksPage() {
  const { isHindi, tr } = useLanguage()
  const [cases, setCases] = useState<TaskCase[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('active')

  const loadCases = useCallback(async () => {
    const supabase = createClient(); const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { try { const stored = window.sessionStorage.getItem(STORAGE_KEY); setCases(stored ? JSON.parse(stored) as TaskCase[] : []) } catch { setCases([]) }; setLoading(false); return }
    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
    if (!advocate) { setLoading(false); return }
    const { data } = await supabase.from('cases').select('id, case_number, case_title, notes, clients(full_name)').eq('advocate_id', advocate.id).order('created_at', { ascending: false })
    setCases((data ?? []) as unknown as TaskCase[]); setLoading(false)
  }, [])
  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCases()
  }, [loadCases])

  const tasks = useMemo(() => cases.flatMap(caseItem => (parseTaskMetadata(caseItem.notes).practice_tasks ?? []).map(task => ({ ...task, caseId: caseItem.id, caseNumber: caseItem.case_number, caseTitle: caseItem.case_title, client: caseItem.clients?.full_name }))), [cases])
  const stats = useMemo(() => ({ active: tasks.filter(t => t.status !== 'completed').length, today: tasks.filter(t => taskTiming(t) === 'today').length, overdue: tasks.filter(t => taskTiming(t) === 'overdue').length, completed: tasks.filter(t => t.status === 'completed').length }), [tasks])
  const visible = useMemo(() => tasks.filter(task => {
    const timing = taskTiming(task); const q = search.trim().toLowerCase()
    const matchesFilter = filter === 'all' || (filter === 'active' && task.status !== 'completed') || filter === timing
    const matchesSearch = !q || [task.title, task.description, task.assignee_name, task.assignee_role, task.caseNumber, task.caseTitle, task.client].some(value => String(value || '').toLowerCase().includes(q))
    return matchesFilter && matchesSearch
  }).sort((a, b) => {
    const order = { overdue: 0, today: 1, upcoming: 2, completed: 3 }
    return order[taskTiming(a)] - order[taskTiming(b)] || a.due_date.localeCompare(b.due_date)
  }), [tasks, search, filter])
  const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const today = localDateKey()

  return <div className="space-y-5">
    <div><h1 className="text-xl font-bold text-gray-900">{tr('Team Tasks', 'टीम कार्य')}</h1><p className="mt-1 text-sm text-gray-500">{tr('Coordinate juniors, clerks and case-linked deadlines from one place', 'जूनियर, क्लर्क और केस से जुड़ी समय-सीमाओं का एक जगह समन्वय करें')}</p></div>
    <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950 to-teal-900 p-5 text-white shadow-lg"><div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-cyan-300" /><h2 className="font-bold">{tr('Practice Coordination', 'प्रैक्टिस समन्वय')}</h2></div><p className="mt-1 text-xs text-cyan-100/70">{tr(`Today: ${new Date(`${today}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`, `आज: ${new Date(`${today}T00:00:00`).toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`)}</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{([['active', stats.active, ListChecks, 'Active', 'सक्रिय'], ['today', stats.today, Clock3, 'Due Today', 'आज अंतिम तिथि'], ['overdue', stats.overdue, AlertTriangle, 'Overdue', 'समय-सीमा पार'], ['completed', stats.completed, CheckCircle2, 'Completed', 'पूर्ण']] as const).map(([value, count, Icon, en, hi]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl p-3 text-left ring-1 ${filter === value ? 'bg-white text-slate-950 ring-white' : 'bg-white/10 text-white ring-white/10'}`}><Icon className={`h-4 w-4 ${value === 'overdue' && count ? 'text-red-400' : filter === value ? 'text-cyan-700' : 'text-cyan-300'}`} /><p className="mt-2 text-xl font-extrabold">{count}</p><p className={`text-[10px] ${filter === value ? 'text-gray-500' : 'text-cyan-100/60'}`}>{isHindi ? hi : en}</p></button>)}</div></section>
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('Search task, assignee, case or client...', 'कार्य, जिम्मेदार व्यक्ति, केस या मुवक्किल खोजें...')} className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-3 text-sm" /></div><select value={filter} onChange={e => setFilter(e.target.value as Filter)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-700"><option value="active">{tr('Active Tasks', 'सक्रिय कार्य')}</option><option value="today">{tr('Due Today', 'आज अंतिम तिथि')}</option><option value="overdue">{tr('Overdue', 'समय-सीमा पार')}</option><option value="completed">{tr('Completed', 'पूर्ण')}</option><option value="all">{tr('All Tasks', 'सभी कार्य')}</option></select></div>
    {loading ? <div className="py-16 text-center text-sm text-gray-400">{tr('Loading team tasks...', 'टीम कार्य लोड हो रहे हैं...')}</div> : !visible.length ? <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center"><ListChecks className="mx-auto h-11 w-11 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-600">{tasks.length ? tr('No matching tasks found', 'कोई संबंधित कार्य नहीं मिला') : tr('No team task assigned yet', 'अभी कोई टीम कार्य नहीं सौंपा गया')}</p><p className="mt-1 text-xs text-gray-400">{tr('Open a case and use “Assign Task” to delegate work.', 'केस खोलें और कार्य सौंपने के लिए “कार्य सौंपें” का उपयोग करें।')}</p><Link href="/dashboard/cases" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-cyan-800">{tr('Open Case Reports', 'केस रिपोर्ट खोलें')}<ChevronRight className="h-4 w-4" /></Link></div> : <div className="space-y-3">{visible.map(task => { const timing = taskTiming(task); return <article key={`${task.caseId}-${task.id}`} className={`rounded-2xl border bg-white p-4 shadow-sm ${timing === 'overdue' ? 'border-red-200' : timing === 'today' ? 'border-amber-200' : 'border-gray-100'}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${PRIORITY[task.priority].color}`}>{isHindi ? PRIORITY[task.priority].hi : PRIORITY[task.priority].en}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">{isHindi ? STATUS[task.status].hi : STATUS[task.status].en}</span>{timing === 'overdue' && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">{tr('Overdue', 'समय-सीमा पार')}</span>}{timing === 'today' && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">{tr('Due Today', 'आज अंतिम तिथि')}</span>}</div><h3 className={`mt-2 font-bold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</h3><p className="mt-1 text-xs font-semibold text-cyan-800">{task.assignee_name} · {task.assignee_role}</p>{task.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{task.description}</p>}</div><div className="flex flex-shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end"><p className={`inline-flex items-center gap-1 text-xs font-bold ${timing === 'overdue' ? 'text-red-600' : timing === 'today' ? 'text-amber-700' : 'text-gray-500'}`}><Clock3 className="h-3.5 w-3.5" />{formatDate(task.due_date)}</p><div className="text-right"><p className="text-xs font-bold text-gray-800">{task.caseNumber}</p><p className="max-w-[190px] truncate text-[10px] text-gray-400">{task.caseTitle || task.client}</p></div><Link href={`/dashboard/cases/${task.caseId}#tasks`} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white">{tr('Open Task', 'कार्य खोलें')}<ChevronRight className="h-3.5 w-3.5" /></Link></div></div></article>})}</div>}
    <p className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-[11px] leading-5 text-gray-500"><CircleDashed className="mr-1 inline h-3.5 w-3.5" />{tr('Task status is updated by the advocate inside the case file. Multi-user junior accounts and automatic notifications can be connected later without changing this workflow.', 'कार्य की स्थिति अधिवक्ता द्वारा केस फ़ाइल में अपडेट की जाती है। मल्टी-यूज़र जूनियर खाते और स्वचालित सूचनाएँ बाद में इसी प्रक्रिया से जोड़ी जा सकती हैं।')}</p>
  </div>
}
