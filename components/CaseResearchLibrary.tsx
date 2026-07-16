'use client'

import { useMemo, useState } from 'react'
import { BookOpenCheck, ExternalLink, FileText, Gavel, Lightbulb, Plus, Search, StickyNote, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { indianKanoonSearchUrl, isSafeSourceUrl, parseResearchMetadata, type ResearchEntry, type ResearchMetadata, type ResearchType } from '@/lib/research'
import { useLanguage } from '@/components/LanguageProvider'

const GUEST_CASES_STORAGE_KEY = 'vakil_guest_cases_v2'
const EMPTY_FORM = { type: 'judgment' as ResearchType, title: '', citation: '', court: '', decision_date: '', source_url: '', proposition: '', advocate_note: '', tags: '' }

const TYPE_STYLE: Record<ResearchType, { icon: typeof Gavel; color: string; en: string; hi: string }> = {
  judgment: { icon: Gavel, color: 'bg-indigo-50 text-indigo-700', en: 'Judgment', hi: 'निर्णय' },
  section: { icon: FileText, color: 'bg-emerald-50 text-emerald-700', en: 'Act / Section', hi: 'अधिनियम / धारा' },
  argument: { icon: Lightbulb, color: 'bg-amber-50 text-amber-700', en: 'Argument', hi: 'दलील' },
  note: { icon: StickyNote, color: 'bg-sky-50 text-sky-700', en: 'Research Note', hi: 'शोध टिप्पणी' },
}

interface Props { caseId: string; caseNumber: string; initialNotes?: string | null; isGuest?: boolean }

export default function CaseResearchLibrary({ caseId, caseNumber, initialNotes, isGuest = false }: Props) {
  const { isHindi, tr } = useLanguage()
  const [metadata, setMetadata] = useState<ResearchMetadata>(() => parseResearchMetadata(initialNotes))
  const [query, setQuery] = useState(() => String(parseResearchMetadata(initialNotes).acts_sections || ''))
  const [filter, setFilter] = useState<'all' | ResearchType>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const entries = useMemo(() => [...(metadata.research_library ?? [])]
    .filter(entry => filter === 'all' || entry.type === filter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)), [metadata.research_library, filter])

  async function persist(next: ResearchMetadata) {
    if (isGuest) {
      try {
        const stored = window.sessionStorage.getItem(GUEST_CASES_STORAGE_KEY)
        const cases = stored ? JSON.parse(stored) as Array<{ id: string; notes?: string }> : []
        window.sessionStorage.setItem(GUEST_CASES_STORAGE_KEY, JSON.stringify(cases.map(item => item.id === caseId ? { ...item, notes: JSON.stringify(next) } : item)))
        setMetadata(next)
        return true
      } catch {
        toast.error(tr('Research note could not be saved', 'शोध टिप्पणी सेव नहीं हो सकी'))
        return false
      }
    }
    const { error } = await createClient().from('cases').update({ notes: JSON.stringify(next) }).eq('id', caseId)
    if (error) { toast.error(tr(`Could not save research: ${error.message}`, `शोध सेव नहीं हो सका: ${error.message}`)); return false }
    setMetadata(next)
    return true
  }

  function openSearch(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) { toast.error(tr('Enter a judgment, section or legal issue', 'निर्णय, धारा या कानूनी मुद्दा दर्ज करें')); return }
    window.open(indianKanoonSearchUrl(query), '_blank', 'noopener,noreferrer')
  }

  async function addEntry(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) { toast.error(tr('Title is required', 'शीर्षक आवश्यक है')); return }
    if (!isSafeSourceUrl(form.source_url)) { toast.error(tr('Enter a valid http/https source link', 'सही http/https स्रोत लिंक दर्ज करें')); return }
    const entry: ResearchEntry = {
      id: `research-${Date.now()}`,
      type: form.type,
      title: form.title.trim(), citation: form.citation.trim() || undefined, court: form.court.trim() || undefined,
      decision_date: form.decision_date || undefined, source_url: form.source_url.trim() || undefined,
      proposition: form.proposition.trim() || undefined, advocate_note: form.advocate_note.trim() || undefined,
      tags: [...new Set(form.tags.split(',').map(tag => tag.trim()).filter(Boolean))], created_at: new Date().toISOString(),
    }
    setSaving(true)
    const saved = await persist({ ...metadata, research_library: [...(metadata.research_library ?? []), entry] })
    setSaving(false)
    if (!saved) return
    setForm(EMPTY_FORM); setShowForm(false); toast.success(tr('Research saved to this case', 'शोध इस केस में सेव हो गया'))
  }

  async function removeEntry(entry: ResearchEntry) {
    if (!window.confirm(tr(`Delete “${entry.title}”?`, `“${entry.title}” हटाएँ?`))) return
    setSaving(true)
    const saved = await persist({ ...metadata, research_library: (metadata.research_library ?? []).filter(item => item.id !== entry.id) })
    setSaving(false)
    if (saved) toast.success(tr('Research entry deleted', 'शोध प्रविष्टि हटा दी गई'))
  }

  return (
    <section id="research" className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-900 p-5 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-indigo-300" /><h2 className="font-bold">{tr('Case Legal Research', 'केस कानूनी शोध')}</h2></div><p className="mt-1 text-xs text-indigo-100/75">{tr(`Judgments, sections and argument notes for ${caseNumber}`, `${caseNumber} के निर्णय, धाराएँ और दलीलें`)}</p></div>
          <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-50"><Plus className="h-4 w-4" />{tr('Save Research', 'शोध सेव करें')}</button>
        </div>
        <form onSubmit={openSearch} className="mt-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('Search judgments, acts or sections...', 'निर्णय, अधिनियम या धारा खोजें...')} className="w-full rounded-lg border border-white/15 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none" /></div><button className="rounded-lg bg-orange-500 px-3 text-xs font-bold text-white hover:bg-orange-400">{tr('Search Indian Kanoon', 'इंडियन कानून खोजें')}</button></form>
        <p className="mt-2 text-[10px] leading-4 text-indigo-100/65">{tr('Opens public search in a new tab. Verify the judgment, citation and current legal position before relying on it.', 'नई टैब में सार्वजनिक खोज खुलेगी। उपयोग से पहले निर्णय, उद्धरण और वर्तमान कानूनी स्थिति सत्यापित करें।')}</p>
      </div>

      {showForm && <form onSubmit={addEntry} className="border-b border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-bold text-gray-900">{tr('Add research to this case', 'इस केस में शोध जोड़ें')}</h3><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-gray-400 hover:bg-white"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700">{tr('Research Type', 'शोध प्रकार')}<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ResearchType })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">{Object.entries(TYPE_STYLE).map(([value, item]) => <option key={value} value={value}>{isHindi ? item.hi : item.en}</option>)}</select></label>
          <label className="text-xs font-semibold text-gray-700">{tr('Title / Legal Issue *', 'शीर्षक / कानूनी मुद्दा *')}<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tr('e.g. Bail where investigation is complete', 'जैसे: जाँच पूरी होने पर जमानत')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">{tr('Citation / Section', 'उद्धरण / धारा')}<input value={form.citation} onChange={e => setForm({ ...form, citation: e.target.value })} placeholder="(2024) 2 SCC 123 / Section 420 IPC" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">{tr('Court', 'न्यायालय')}<input value={form.court} onChange={e => setForm({ ...form, court: e.target.value })} placeholder={tr('Supreme Court / High Court', 'सुप्रीम कोर्ट / हाई कोर्ट')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">{tr('Decision Date', 'निर्णय तिथि')}<input type="date" value={form.decision_date} onChange={e => setForm({ ...form, decision_date: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">{tr('Source Link', 'स्रोत लिंक')}<input type="url" value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} placeholder="https://..." className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700 sm:col-span-2">{tr('Legal Proposition / Why Useful', 'कानूनी सिद्धांत / उपयोगिता')}<textarea value={form.proposition} onChange={e => setForm({ ...form, proposition: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700 sm:col-span-2">{tr('Advocate Note / Argument', 'अधिवक्ता टिप्पणी / दलील')}<textarea value={form.advocate_note} onChange={e => setForm({ ...form, advocate_note: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700 sm:col-span-2">{tr('Tags (comma separated)', 'टैग (कॉमा से अलग करें)')}<input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder={tr('bail, evidence, limitation', 'जमानत, साक्ष्य, समय-सीमा')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600">{tr('Cancel', 'रद्द करें')}</button><button disabled={saving} className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? tr('Saving...', 'सेव हो रहा है...') : tr('Save to Case', 'केस में सेव करें')}</button></div>
      </form>}

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex gap-1 overflow-x-auto">{(['all', 'judgment', 'section', 'argument', 'note'] as const).map(value => <button key={value} type="button" onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold ${filter === value ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-500'}`}>{value === 'all' ? tr('All', 'सभी') : (isHindi ? TYPE_STYLE[value].hi : TYPE_STYLE[value].en)}</button>)}</div>
        {!entries.length ? <div className="rounded-xl border border-dashed border-gray-200 py-9 text-center"><BookOpenCheck className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-2 text-sm font-semibold text-gray-500">{tr('No saved research for this case', 'इस केस के लिए कोई शोध सेव नहीं है')}</p><p className="mt-1 text-xs text-gray-400">{tr('Search publicly, verify the source, then save the useful legal point here.', 'सार्वजनिक खोज करें, स्रोत सत्यापित करें और उपयोगी कानूनी बिंदु यहाँ सेव करें।')}</p></div> : <div className="space-y-3">{entries.map(entry => { const style = TYPE_STYLE[entry.type]; const Icon = style.icon; return <article key={entry.id} className="rounded-xl border border-gray-100 p-4 hover:border-indigo-200"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${style.color}`}><Icon className="h-3 w-3" />{isHindi ? style.hi : style.en}</span><h3 className="mt-2 font-bold text-gray-900">{entry.title}</h3><p className="mt-1 text-xs text-gray-500">{[entry.citation, entry.court, entry.decision_date].filter(Boolean).join(' · ')}</p></div><button type="button" onClick={() => removeEntry(entry)} disabled={saving} className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div>{entry.proposition && <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs leading-5 text-indigo-950"><strong>{tr('Legal point:', 'कानूनी बिंदु:')}</strong> {entry.proposition}</p>}{entry.advocate_note && <p className="mt-2 text-xs leading-5 text-gray-600"><strong>{tr('Advocate note:', 'अधिवक्ता टिप्पणी:')}</strong> {entry.advocate_note}</p>}<div className="mt-3 flex flex-wrap items-center gap-2">{entry.tags.map(tag => <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-600">#{tag}</span>)}{entry.source_url && <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-indigo-700">{tr('Open source', 'स्रोत खोलें')}<ExternalLink className="h-3.5 w-3.5" /></a>}</div></article>})}</div>}
      </div>
    </section>
  )
}

