'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, ListChecks, MessageCircle, Plus, Trash2, UserRoundCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { localDateKey, normalizedIndianPhone, parseTaskMetadata, taskTiming, taskWhatsAppUrl, type AssigneeRole, type PracticeTask, type TaskMetadata, type TaskPriority, type TaskStatus } from '@/lib/tasks'
import { useLanguage } from '@/components/LanguageProvider'

const STORAGE_KEY = 'vakil_guest_cases_v2'
const ROLES: AssigneeRole[] = ['Junior Advocate', 'Clerk', 'Intern', 'Self', 'Other']
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']
const STATUS_LABELS: Record<TaskStatus, { en: string; hi: string }> = {
  pending: { en: 'Pending', hi: 'लंबित' }, in_progress: { en: 'In Progress', hi: 'प्रगति पर' }, completed: { en: 'Completed', hi: 'पूर्ण' },
}
const PRIORITY_LABELS: Record<TaskPriority, { en: string; hi: string; color: string }> = {
  low: { en: 'Low', hi: 'कम', color: 'bg-gray-100 text-gray-600' }, normal: { en: 'Normal', hi: 'सामान्य', color: 'bg-blue-50 text-blue-700' }, high: { en: 'High', hi: 'उच्च', color: 'bg-orange-50 text-orange-700' }, urgent: { en: 'Urgent', hi: 'अत्यावश्यक', color: 'bg-red-50 text-red-700' },
}
const ROLE_HI: Record<AssigneeRole, string> = { 'Junior Advocate': 'जूनियर अधिवक्ता', Clerk: 'क्लर्क', Intern: 'इंटर्न', Self: 'स्वयं', Other: 'अन्य' }
const EMPTY_FORM = { title: '', description: '', assignee_name: '', assignee_role: 'Junior Advocate' as AssigneeRole, assignee_phone: '', due_date: localDateKey(), priority: 'normal' as TaskPriority }

interface Props { caseId: string; caseNumber: string; initialNotes?: string | null; isGuest?: boolean }

export default function CaseTaskBoard({ caseId, caseNumber, initialNotes, isGuest = false }: Props) {
  const { isHindi, tr } = useLanguage()
  const [metadata, setMetadata] = useState<TaskMetadata>(() => parseTaskMetadata(initialNotes))
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active')
  const tasks = useMemo(() => [...(metadata.practice_tasks ?? [])].filter(task => filter === 'all' || (filter === 'active' ? task.status !== 'completed' : task.status === 'completed')).sort((a, b) => a.status.localeCompare(b.status) || a.due_date.localeCompare(b.due_date)), [metadata.practice_tasks, filter])
  const activeCount = (metadata.practice_tasks ?? []).filter(task => task.status !== 'completed').length
  const overdueCount = (metadata.practice_tasks ?? []).filter(task => taskTiming(task) === 'overdue').length

  async function persist(next: TaskMetadata) {
    if (isGuest) {
      try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY)
        const cases = stored ? JSON.parse(stored) as Array<{ id: string; notes?: string }> : []
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cases.map(item => item.id === caseId ? { ...item, notes: JSON.stringify(next) } : item)))
        setMetadata(next); return true
      } catch { toast.error(tr('Task could not be saved', 'कार्य सेव नहीं हो सका')); return false }
    }
    const { error } = await createClient().from('cases').update({ notes: JSON.stringify(next) }).eq('id', caseId)
    if (error) { toast.error(tr(`Task could not be saved: ${error.message}`, `कार्य सेव नहीं हो सका: ${error.message}`)); return false }
    setMetadata(next); return true
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim() || !form.assignee_name.trim() || !form.due_date) { toast.error(tr('Task, assignee and deadline are required', 'कार्य, जिम्मेदार व्यक्ति और अंतिम तिथि आवश्यक हैं')); return }
    if (form.assignee_phone.trim() && !normalizedIndianPhone(form.assignee_phone)) { toast.error(tr('Enter a valid 10-digit Indian mobile number', 'सही 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें')); return }
    const task: PracticeTask = { id: `task-${Date.now()}`, title: form.title.trim(), description: form.description.trim() || undefined, assignee_name: form.assignee_name.trim(), assignee_role: form.assignee_role, assignee_phone: form.assignee_phone.trim() || undefined, due_date: form.due_date, priority: form.priority, status: 'pending', created_at: new Date().toISOString() }
    setSaving(true); const saved = await persist({ ...metadata, practice_tasks: [...(metadata.practice_tasks ?? []), task] }); setSaving(false)
    if (!saved) return
    setForm(EMPTY_FORM); setShowForm(false); toast.success(tr('Task assigned successfully', 'कार्य सफलतापूर्वक सौंपा गया'))
  }

  async function setStatus(task: PracticeTask, status: TaskStatus) {
    const completionNote = status === 'completed' ? window.prompt(tr('Completion note (optional)', 'पूर्णता टिप्पणी (वैकल्पिक)'), task.completion_note || '') : undefined
    if (status === 'completed' && completionNote === null) return
    const updated: PracticeTask = { ...task, status, completed_at: status === 'completed' ? new Date().toISOString() : undefined, completion_note: status === 'completed' ? completionNote?.trim() || undefined : undefined }
    setSaving(true); const saved = await persist({ ...metadata, practice_tasks: (metadata.practice_tasks ?? []).map(item => item.id === task.id ? updated : item) }); setSaving(false)
    if (saved) toast.success(status === 'completed' ? tr('Task marked completed', 'कार्य पूर्ण चिह्नित हुआ') : tr('Task status updated', 'कार्य स्थिति अपडेट हुई'))
  }

  async function deleteTask(task: PracticeTask) {
    if (!window.confirm(tr(`Delete task “${task.title}”?`, `कार्य “${task.title}” हटाएँ?`))) return
    setSaving(true); const saved = await persist({ ...metadata, practice_tasks: (metadata.practice_tasks ?? []).filter(item => item.id !== task.id) }); setSaving(false)
    if (saved) toast.success(tr('Task deleted', 'कार्य हटा दिया गया'))
  }

  const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return <section id="tasks" className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm">
    <div className="bg-gradient-to-r from-slate-950 via-cyan-950 to-teal-900 p-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-cyan-300" /><h2 className="font-bold">{tr('Team Tasks & Delegation', 'टीम कार्य और जिम्मेदारी')}</h2></div><p className="mt-1 text-xs text-cyan-100/70">{tr(`Coordinate juniors and clerks for ${caseNumber}`, `${caseNumber} के लिए जूनियर और क्लर्क समन्वय`)}</p></div><button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-cyan-900"><Plus className="h-4 w-4" />{tr('Assign Task', 'कार्य सौंपें')}</button></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/10 p-3"><p className="text-[10px] uppercase tracking-wide text-cyan-100/60">{tr('Active tasks', 'सक्रिय कार्य')}</p><p className="mt-1 text-xl font-extrabold">{activeCount}</p></div><div className={`rounded-xl p-3 ${overdueCount ? 'bg-red-500/20' : 'bg-white/10'}`}><p className="text-[10px] uppercase tracking-wide text-cyan-100/60">{tr('Overdue', 'समय-सीमा पार')}</p><p className="mt-1 text-xl font-extrabold">{overdueCount}</p></div></div>
    </div>

    {showForm && <form onSubmit={addTask} className="border-b border-cyan-100 bg-cyan-50/40 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-bold text-gray-900">{tr('Assign a case-linked task', 'केस से जुड़ा कार्य सौंपें')}</h3><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-gray-400 hover:bg-white"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-gray-700 sm:col-span-2">{tr('Task *', 'कार्य *')}<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tr('e.g. Collect certified order copy', 'जैसे: आदेश की प्रमाणित प्रति लें')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-semibold text-gray-700">{tr('Assigned To *', 'जिम्मेदार व्यक्ति *')}<input value={form.assignee_name} onChange={e => setForm({ ...form, assignee_name: e.target.value })} placeholder={tr('Junior / clerk name', 'जूनियर / क्लर्क का नाम')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-semibold text-gray-700">{tr('Role', 'भूमिका')}<select value={form.assignee_role} onChange={e => setForm({ ...form, assignee_role: e.target.value as AssigneeRole })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">{ROLES.map(role => <option key={role} value={role}>{isHindi ? ROLE_HI[role] : role}</option>)}</select></label>
      <label className="text-xs font-semibold text-gray-700">{tr('Mobile / WhatsApp', 'मोबाइल / व्हाट्सऐप')}<input inputMode="numeric" value={form.assignee_phone} onChange={e => setForm({ ...form, assignee_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder={tr('Optional 10-digit number', 'वैकल्पिक 10 अंकों का नंबर')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-semibold text-gray-700">{tr('Deadline *', 'अंतिम तिथि *')}<input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-semibold text-gray-700">{tr('Priority', 'प्राथमिकता')}<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">{PRIORITIES.map(priority => <option key={priority} value={priority}>{isHindi ? PRIORITY_LABELS[priority].hi : PRIORITY_LABELS[priority].en}</option>)}</select></label>
      <label className="text-xs font-semibold text-gray-700 sm:col-span-2">{tr('Instructions / Expected Output', 'निर्देश / अपेक्षित परिणाम')}<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={tr('Add clear instructions, court room or document details...', 'स्पष्ट निर्देश, कोर्ट रूम या दस्तावेज़ विवरण जोड़ें...')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
    </div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600">{tr('Cancel', 'रद्द करें')}</button><button disabled={saving} className="rounded-lg bg-cyan-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? tr('Assigning...', 'सौंपा जा रहा है...') : tr('Assign Task', 'कार्य सौंपें')}</button></div></form>}

    <div className="p-4 sm:p-5"><div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">{(['active', 'completed', 'all'] as const).map(value => <button key={value} type="button" onClick={() => setFilter(value)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${filter === value ? 'bg-white text-cyan-800 shadow-sm' : 'text-gray-500'}`}>{value === 'active' ? tr('Active', 'सक्रिय') : value === 'completed' ? tr('Completed', 'पूर्ण') : tr('All', 'सभी')}</button>)}</div>
      {!tasks.length ? <div className="rounded-xl border border-dashed border-gray-200 py-9 text-center"><UserRoundCheck className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-2 text-sm font-semibold text-gray-500">{tr('No tasks in this view', 'इस सूची में कोई कार्य नहीं है')}</p><p className="mt-1 text-xs text-gray-400">{tr('Assign clear work with an owner and deadline.', 'जिम्मेदार व्यक्ति और अंतिम तिथि के साथ स्पष्ट कार्य सौंपें।')}</p></div> : <div className="space-y-3">{tasks.map(task => { const timing = taskTiming(task); const whatsappUrl = taskWhatsAppUrl(task, caseNumber, isHindi); return <article key={task.id} className={`rounded-xl border p-4 ${timing === 'overdue' ? 'border-red-200 bg-red-50/30' : timing === 'today' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${PRIORITY_LABELS[task.priority].color}`}>{isHindi ? PRIORITY_LABELS[task.priority].hi : PRIORITY_LABELS[task.priority].en}</span>{timing === 'overdue' && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700"><AlertTriangle className="h-3 w-3" />{tr('Overdue', 'समय-सीमा पार')}</span>}{timing === 'today' && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">{tr('Due Today', 'आज अंतिम तिथि')}</span>}</div><h3 className={`mt-2 font-bold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</h3><p className="mt-1 text-xs font-medium text-cyan-800">{task.assignee_name} · {isHindi ? ROLE_HI[task.assignee_role] : task.assignee_role}</p><p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500"><Clock3 className="h-3.5 w-3.5" />{formatDate(task.due_date)}</p>{task.description && <p className="mt-2 text-xs leading-5 text-gray-600">{task.description}</p>}{task.completion_note && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><strong>{tr('Completion:', 'पूर्णता:')}</strong> {task.completion_note}</p>}</div><button type="button" onClick={() => deleteTask(task)} disabled={saving} className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 flex flex-wrap items-center gap-2"><select value={task.status} onChange={e => setStatus(task, e.target.value as TaskStatus)} disabled={saving} className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-bold text-gray-700"><option value="pending">{isHindi ? STATUS_LABELS.pending.hi : STATUS_LABELS.pending.en}</option><option value="in_progress">{isHindi ? STATUS_LABELS.in_progress.hi : STATUS_LABELS.in_progress.en}</option><option value="completed">{isHindi ? STATUS_LABELS.completed.hi : STATUS_LABELS.completed.en}</option></select>{whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><MessageCircle className="h-4 w-4" />{tr('Share on WhatsApp', 'व्हाट्सऐप पर भेजें')}</a>}{task.status === 'completed' ? <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" />{tr('Completed', 'पूर्ण')}</span> : <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400"><CircleDashed className="h-4 w-4" />{isHindi ? STATUS_LABELS[task.status].hi : STATUS_LABELS[task.status].en}</span>}</div></article>})}</div>}
      <p className="mt-4 text-[10px] leading-4 text-gray-400">{tr('WhatsApp sharing opens a prepared message; it is sent only after you confirm it in WhatsApp. Automatic team notifications require a future messaging integration.', 'व्हाट्सऐप साझा करने पर तैयार संदेश खुलेगा; संदेश व्हाट्सऐप में आपकी पुष्टि के बाद ही भेजा जाएगा। स्वचालित टीम सूचना के लिए भविष्य में मैसेजिंग इंटीग्रेशन आवश्यक होगा।')}</p>
    </div>
  </section>
}
