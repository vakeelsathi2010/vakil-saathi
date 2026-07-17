'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { Archive, ChevronLeft, ChevronRight, Download, FileText, Grid2X2, List, Pencil, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'

const PAGE_SIZE = 10
const CACHE_KEY = 'vakil_case_search_cache_v1'
const STATUSES = ['Active', 'Closed', 'Adjourned', 'Pending']
const CASE_TYPES = ['Civil', 'Criminal', 'Bail', 'Property']

function metadata(notes) { try { return notes ? JSON.parse(notes) : {} } catch { return {} } }
function nextDate(item) { return [...(item.hearings || [])].sort((a, b) => String(a.hearing_date).localeCompare(String(b.hearing_date)))[0]?.hearing_date || null }

export default function CaseSearch({ embedded = false }) {
  const { tr } = useLanguage()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState([])
  const [types, setTypes] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [court, setCourt] = useState('')
  const [judge, setJudge] = useState('')
  const [view, setView] = useState('list')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])

  const loadCases = useCallback(async () => {
    setLoading(true); setError('')
    if (!navigator.onLine) {
      setOffline(true)
      try { setRecords(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]')) } catch { setRecords([]) }
      setLoading(false)
      return
    }
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setRecords([]); setLoading(false); return }
      const { data: advocate, error: advocateError } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
      if (advocateError || !advocate) throw new Error('Advocate profile was not found')
      const { data, error: casesError } = await supabase
        .from('cases')
        .select('id, case_number, case_title, court_name, judge_name, case_type, status, notes, created_at, clients(full_name), hearings(hearing_date)')
        .eq('advocate_id', advocate.id)
        .order('created_at', { ascending: false })
      if (casesError) throw casesError
      const normalised = (data || []).map(item => ({ ...item, next_date: nextDate(item), urgency: metadata(item.notes).urgency || 'Normal' }))
      setRecords(normalised); localStorage.setItem(CACHE_KEY, JSON.stringify(normalised)); setOffline(false)
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Data load nahi ho paya') } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // Populate the initial records from the signed-in advocate workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCases()
  }, [loadCases])
  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => { setOffline(false); loadCases() }
    window.addEventListener('offline', goOffline); window.addEventListener('online', goOnline)
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline) }
  }, [loadCases])

  const courts = useMemo(() => [...new Set(records.map(item => item.court_name).filter(Boolean))], [records])
  const judges = useMemo(() => [...new Set(records.map(item => item.judge_name).filter(Boolean))], [records])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const result = records.filter(item => {
      const client = item.clients?.full_name || ''
      const matchesText = !needle || [item.case_title, item.case_number, client, item.case_type, item.status].some(value => String(value || '').toLowerCase().includes(needle))
      const matchesStatus = !status.length || status.includes(item.status)
      const matchesType = !types.length || types.includes(item.case_type)
      const matchesDate = (!fromDate || (item.next_date && item.next_date >= fromDate)) && (!toDate || (item.next_date && item.next_date <= toDate))
      return matchesText && matchesStatus && matchesType && matchesDate && (!court || item.court_name === court) && (!judge || item.judge_name === judge)
    })
    return result.sort((a, b) => {
      if (sort === 'oldest') return String(a.created_at).localeCompare(String(b.created_at))
      if (sort === 'status') return String(a.status).localeCompare(String(b.status))
      if (sort === 'urgency') return ({ Critical: 0, High: 1, Normal: 2, Low: 3 }[a.urgency] ?? 4) - ({ Critical: 0, High: 1, Normal: 2, Low: 3 }[b.urgency] ?? 4)
      if (sort === 'name') return String(a.clients?.full_name || a.case_title).localeCompare(String(b.clients?.full_name || b.case_title))
      return String(b.created_at).localeCompare(String(a.created_at))
    })
  }, [records, query, status, types, fromDate, toDate, court, judge, sort])
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => {
    // A changed filter always starts from the first results page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [query, status, types, fromDate, toDate, court, judge, sort])

  function toggle(setter, values, value) { setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value]) }
  function toggleSelected(id) { setSelected(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]) }
  async function updateStatus(ids, nextStatus) {
    if (!ids.length) return
    const supabase = createClient(); const { error: updateError } = await supabase.from('cases').update({ status: nextStatus }).in('id', ids)
    if (updateError) { toast.error(updateError.message); return }
    toast.success(nextStatus === 'Disposed' ? 'Cases archived' : 'Cases updated'); setSelected([]); loadCases()
  }
  async function removeCases(ids) {
    if (!ids.length || !window.confirm(`Delete ${ids.length} selected case(s)? This cannot be undone.`)) return
    const supabase = createClient(); const { error: deleteError } = await supabase.from('cases').delete().in('id', ids)
    if (deleteError) { toast.error(deleteError.message); return }
    toast.success('Case records deleted'); setSelected([]); loadCases()
  }
  function exportCases(items) {
    const pdf = new jsPDF()
    let y = 18
    pdf.setFontSize(18); pdf.text('VakilSaathi Case Records', 14, y); y += 12
    pdf.setFontSize(10)
    items.forEach((item, index) => {
      const lines = [
        `${index + 1}. ${item.case_title || item.case_number}`,
        `CRN / Case no.: ${item.case_number || 'Not added'}`,
        `Client: ${item.clients?.full_name || 'Not added'} | Type: ${item.case_type || 'Not added'} | Status: ${item.status || 'Not added'}`,
        `Next date: ${item.next_date || 'Not scheduled'} | Court: ${item.court_name || 'Not added'}`,
      ]
      if (y > 260) { pdf.addPage(); y = 18 }
      pdf.text(lines, 14, y); y += 29
    })
    pdf.save(items.length === 1 ? `case-${items[0].case_number || 'record'}.pdf` : 'vakil-saathi-case-records.pdf')
  }
  const StatusBadge = ({ value }) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${value === 'Active' ? 'bg-green-100 text-green-700' : value === 'Adjourned' ? 'bg-yellow-100 text-yellow-800' : value === 'Closed' || value === 'Disposed' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>{value}</span>

  if (loading) return <div className="space-y-4"><div className="h-12 animate-pulse rounded-xl bg-gray-100" />{[1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}</div>
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800"><p className="font-bold">{tr('Data load nahi ho paya', 'डेटा लोड नहीं हो पाया')}</p><p className="mt-1 text-sm">{error}</p><button type="button" onClick={loadCases} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Retry</button></div>

  return <section className={embedded ? 'space-y-4' : 'mx-auto max-w-6xl space-y-4 p-4'}>
    {!embedded && <div><h1 className="text-2xl font-bold text-gray-900">Case Records</h1><p className="mt-1 text-sm text-gray-500">Past aur active cases ek jagah search aur manage karo.</p></div>}
    {offline && <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">Offline mode: saved case records se search ho raha hai.</div>}
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="relative"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Case ya client का नाम likho" className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500" /></div><div className="mt-4 grid gap-3 md:grid-cols-4"><details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer text-sm font-semibold"><SlidersHorizontal className="mr-1 inline h-4 w-4" />Status</summary>{STATUSES.map(value => <label key={value} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={status.includes(value)} onChange={() => toggle(setStatus, status, value)} />{value}</label>)}</details><details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Case Type</summary>{CASE_TYPES.map(value => <label key={value} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={types.includes(value)} onChange={() => toggle(setTypes, types, value)} />{value}</label>)}</details><div className="rounded-lg border border-gray-200 p-3"><p className="text-sm font-semibold">Next date</p><div className="mt-2 flex gap-2"><input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="min-w-0 text-xs" /><input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="min-w-0 text-xs" /></div></div><div className="space-y-2"><select value={court} onChange={event => setCourt(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">All courts</option>{courts.map(value => <option key={value}>{value}</option>)}</select><select value={judge} onChange={event => setJudge(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">All judges</option>{judges.map(value => <option key={value}>{value}</option>)}</select></div></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-500">{filtered.length} case record{filtered.length === 1 ? '' : 's'} found</p><div className="flex items-center gap-2"><select value={sort} onChange={event => setSort(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="status">By status</option><option value="urgency">Critical first</option><option value="name">Client A-Z</option></select><button type="button" onClick={() => setView('list')} className={`rounded-lg p-2 ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`} aria-label="List view"><List className="h-5 w-5" /></button><button type="button" onClick={() => setView('card')} className={`rounded-lg p-2 ${view === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`} aria-label="Card view"><Grid2X2 className="h-5 w-5" /></button></div></div>
    {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><strong>{selected.length} selected</strong><button type="button" onClick={() => exportCases(records.filter(item => selected.includes(item.id)))} className="rounded-lg bg-white px-3 py-2"><Download className="mr-1 inline h-4 w-4" />Export PDF</button><button type="button" onClick={() => updateStatus(selected, 'Disposed')} className="rounded-lg bg-white px-3 py-2"><Archive className="mr-1 inline h-4 w-4" />Archive</button><button type="button" onClick={() => removeCases(selected)} className="rounded-lg bg-red-600 px-3 py-2 text-white"><Trash2 className="mr-1 inline h-4 w-4" />Delete</button></div>}
    {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center"><FileText className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 font-semibold text-gray-700">No matching cases found</p><p className="mt-1 text-sm text-gray-500">Search ya filters change karke try karo.</p></div> : view === 'list' ? <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="p-4"><input type="checkbox" checked={visible.every(item => selected.includes(item.id))} onChange={() => setSelected(visible.every(item => selected.includes(item.id)) ? [] : visible.map(item => item.id))} /></th><th className="p-4">Case name</th><th className="p-4">Type</th><th className="p-4">Status</th><th className="p-4">Next date</th><th className="p-4">Actions</th></tr></thead><tbody>{visible.map(item => <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50"><td className="p-4"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelected(item.id)} /></td><td className="p-4"><p className="font-semibold text-gray-900">{item.case_title || item.case_number}</p><p className="text-xs text-gray-500">{item.case_number} · {item.clients?.full_name || 'Client not added'}</p></td><td className="p-4">{item.case_type}</td><td className="p-4"><StatusBadge value={item.status} /></td><td className="p-4">{item.next_date || 'Not scheduled'}</td><td className="p-4"><CaseActions item={item} onExport={() => exportCases([item])} onArchive={() => updateStatus([item.id], 'Disposed')} onDelete={() => removeCases([item.id])} /></td></tr>)}</tbody></table></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(item => <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="flex justify-between gap-3"><div><h2 className="font-bold text-gray-900">{item.case_title || item.case_number}</h2><p className="mt-1 text-xs text-gray-500">{item.case_number} · {item.clients?.full_name || 'Client not added'}</p></div><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelected(item.id)} /></div><div className="mt-4 space-y-2 text-sm"><p>Type: <strong>{item.case_type}</strong></p><p>Status: <StatusBadge value={item.status} /></p><p>Next: <strong>{item.next_date || 'Not scheduled'}</strong></p></div><div className="mt-5"><CaseActions item={item} onExport={() => exportCases([item])} onArchive={() => updateStatus([item.id], 'Disposed')} onDelete={() => removeCases([item.id])} /></div></article>)}</div>}
    <div className="flex items-center justify-center gap-3"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button><span className="text-sm text-gray-600">Page {page} of {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button></div>
  </section>
}

function CaseActions({ item, onExport, onArchive, onDelete }) {
  return <div className="flex flex-wrap gap-2"><Link href={`/dashboard/cases/${item.id}`} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold">View</Link><Link href={`/dashboard/cases/${item.id}?edit=1`} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold"><Pencil className="mr-1 inline h-3.5 w-3.5" />Edit</Link><button type="button" onClick={onExport} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold"><Download className="mr-1 inline h-3.5 w-3.5" />PDF</button><button type="button" onClick={onArchive} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold"><Archive className="mr-1 inline h-3.5 w-3.5" />Archive</button><button type="button" onClick={onDelete} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Delete</button></div>
}

CaseSearch.propTypes = { embedded: PropTypes.bool }
CaseSearch.defaultProps = { embedded: false }
