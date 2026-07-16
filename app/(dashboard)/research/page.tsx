'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpenCheck, ChevronRight, ExternalLink, FileText, Gavel, Lightbulb, Search, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { indianKanoonSearchUrl, parseResearchMetadata, type ResearchType } from '@/lib/research'
import { useLanguage } from '@/components/LanguageProvider'

const GUEST_CASES_STORAGE_KEY = 'vakil_guest_cases_v2'
interface ResearchCase { id: string; case_number: string; case_title?: string | null; notes?: string | null; clients?: { full_name?: string | null } | null }
const TYPES: Record<ResearchType, { icon: typeof Gavel; en: string; hi: string; color: string }> = {
  judgment: { icon: Gavel, en: 'Judgment', hi: 'निर्णय', color: 'bg-indigo-50 text-indigo-700' },
  section: { icon: FileText, en: 'Act / Section', hi: 'अधिनियम / धारा', color: 'bg-emerald-50 text-emerald-700' },
  argument: { icon: Lightbulb, en: 'Argument', hi: 'दलील', color: 'bg-amber-50 text-amber-700' },
  note: { icon: StickyNote, en: 'Research Note', hi: 'शोध टिप्पणी', color: 'bg-sky-50 text-sky-700' },
}

export default function ResearchPage() {
  const { isHindi, tr } = useLanguage()
  const [cases, setCases] = useState<ResearchCase[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [publicQuery, setPublicQuery] = useState('')
  const [filter, setFilter] = useState<'all' | ResearchType>('all')

  const loadCases = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      try { const stored = window.sessionStorage.getItem(GUEST_CASES_STORAGE_KEY); setCases(stored ? JSON.parse(stored) as ResearchCase[] : []) } catch { setCases([]) }
      setLoading(false); return
    }
    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
    if (!advocate) { setLoading(false); return }
    const { data } = await supabase.from('cases').select('id, case_number, case_title, notes, clients(full_name)').eq('advocate_id', advocate.id).order('created_at', { ascending: false })
    setCases((data ?? []) as unknown as ResearchCase[]); setLoading(false)
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCases()
  }, [loadCases])

  const library = useMemo(() => cases.flatMap(caseItem => (parseResearchMetadata(caseItem.notes).research_library ?? []).map(entry => ({ ...entry, caseId: caseItem.id, caseNumber: caseItem.case_number, caseTitle: caseItem.case_title, client: caseItem.clients?.full_name }))), [cases])
  const visible = useMemo(() => library.filter(item => {
    const q = search.trim().toLowerCase()
    return (filter === 'all' || item.type === filter) && (!q || [item.title, item.citation, item.court, item.proposition, item.advocate_note, item.caseNumber, item.caseTitle, item.client, ...item.tags].some(value => String(value || '').toLowerCase().includes(q)))
  }).sort((a, b) => b.created_at.localeCompare(a.created_at)), [library, search, filter])
  const count = (type: ResearchType) => library.filter(item => item.type === type).length

  function openPublicSearch(event: React.FormEvent) { event.preventDefault(); if (publicQuery.trim()) window.open(indianKanoonSearchUrl(publicQuery), '_blank', 'noopener,noreferrer') }

  return <div className="space-y-5">
    <div><h1 className="text-xl font-bold text-gray-900">{tr('Legal Research Library', 'कानूनी शोध संग्रह')}</h1><p className="mt-1 text-sm text-gray-500">{tr('Case-wise judgments, sections, legal propositions and argument notes', 'केस के अनुसार निर्णय, धाराएँ, कानूनी सिद्धांत और दलीलें')}</p></div>

    <section className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-900 p-5 text-white shadow-lg">
      <div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-indigo-300" /><h2 className="font-bold">{tr('Find Indian case law', 'भारतीय केस कानून खोजें')}</h2></div>
      <p className="mt-1 text-xs text-indigo-100/70">{tr('Search the public Indian Kanoon website, verify the result, then save it inside the relevant case.', 'सार्वजनिक इंडियन कानून वेबसाइट पर खोजें, परिणाम सत्यापित करें और संबंधित केस में सेव करें।')}</p>
      <form onSubmit={openPublicSearch} className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={publicQuery} onChange={e => setPublicQuery(e.target.value)} placeholder={tr('Judgment, section, party name or legal issue...', 'निर्णय, धारा, पक्षकार या कानूनी मुद्दा...')} className="w-full rounded-xl border-0 bg-white py-3 pl-9 pr-3 text-sm text-gray-900" /></div><button disabled={!publicQuery.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-50">{tr('Search Indian Kanoon', 'इंडियन कानून खोजें')}<ExternalLink className="h-4 w-4" /></button></form>
      <p className="mt-2 text-[10px] text-indigo-100/60">{tr('Public search only — not an official court record or legal opinion.', 'केवल सार्वजनिक खोज — यह आधिकारिक न्यायालय रिकॉर्ड या कानूनी राय नहीं है।')}</p>
    </section>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['judgment', count('judgment')], ['section', count('section')], ['argument', count('argument')], ['note', count('note')]] as [ResearchType, number][]).map(([type, value]) => { const item = TYPES[type]; const Icon = item.icon; return <button key={type} type="button" onClick={() => setFilter(filter === type ? 'all' : type)} className={`rounded-xl border bg-white p-3 text-left shadow-sm ${filter === type ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-100'}`}><span className={`inline-flex rounded-lg p-2 ${item.color}`}><Icon className="h-4 w-4" /></span><p className="mt-2 text-xl font-extrabold text-gray-900">{value}</p><p className="text-[11px] text-gray-500">{isHindi ? item.hi : item.en}</p></button>})}</div>

    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('Search saved research, citation, tag, case or client...', 'सेव शोध, उद्धरण, टैग, केस या मुवक्किल खोजें...')} className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-3 text-sm" /></div>

    {loading ? <div className="py-16 text-center text-sm text-gray-400">{tr('Loading research library...', 'शोध संग्रह लोड हो रहा है...')}</div> : !visible.length ? <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center"><BookOpenCheck className="mx-auto h-11 w-11 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-600">{library.length ? tr('No matching research found', 'कोई संबंधित शोध नहीं मिला') : tr('No legal research saved yet', 'अभी कोई कानूनी शोध सेव नहीं है')}</p><p className="mt-1 text-xs text-gray-400">{tr('Open a case and use “Save Research” to build its research file.', 'केस खोलें और उसका शोध रिकॉर्ड बनाने के लिए “शोध सेव करें” का उपयोग करें।')}</p><Link href="/dashboard/cases" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-indigo-700">{tr('Open Case Reports', 'केस रिपोर्ट खोलें')}<ChevronRight className="h-4 w-4" /></Link></div> : <div className="space-y-3">{visible.map(item => { const style = TYPES[item.type]; const Icon = style.icon; return <article key={`${item.caseId}-${item.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:border-indigo-200"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${style.color}`}><Icon className="h-3 w-3" />{isHindi ? style.hi : style.en}</span><h3 className="mt-2 font-bold text-gray-900">{item.title}</h3><p className="mt-1 text-xs text-gray-500">{[item.citation, item.court, item.decision_date].filter(Boolean).join(' · ')}</p>{item.proposition && <p className="mt-2 text-xs leading-5 text-gray-600">{item.proposition}</p>}<div className="mt-2 flex flex-wrap gap-1">{item.tags.map(tag => <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-500">#{tag}</span>)}</div></div><div className="flex flex-shrink-0 flex-col items-start gap-2 sm:items-end"><p className="text-xs font-bold text-indigo-700">{item.caseNumber}</p><p className="max-w-[220px] truncate text-[11px] text-gray-400">{item.caseTitle || item.client}</p><Link href={`/dashboard/cases/${item.caseId}#research`} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white">{tr('Open Case Research', 'केस शोध खोलें')}<ChevronRight className="h-3.5 w-3.5" /></Link></div></div></article>})}</div>}
  </div>
}
