'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, CheckCircle2, ChevronRight, Download, IndianRupee, Search, TrendingUp, WalletCards } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currency, feeNumbers, parseFeeMetadata } from '@/lib/fees'
import { useLanguage } from '@/components/LanguageProvider'

const GUEST_CASES_STORAGE_KEY = 'vakil_guest_cases_v2'

interface FeeCase {
  id: string
  case_number: string
  case_title?: string | null
  status?: string | null
  notes?: string | null
  clients?: { full_name?: string | null } | null
}

type FeeFilter = 'all' | 'outstanding' | 'paid' | 'followup'

function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

export default function FeesPage() {
  const { isHindi, tr } = useLanguage()
  const [cases, setCases] = useState<FeeCase[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FeeFilter>('all')

  const loadCases = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      try {
        const stored = window.sessionStorage.getItem(GUEST_CASES_STORAGE_KEY)
        setCases(stored ? JSON.parse(stored) as FeeCase[] : [])
      } catch {
        setCases([])
      }
      setLoading(false)
      return
    }

    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
    if (!advocate) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('cases')
      .select('id, case_number, case_title, status, notes, clients(full_name)')
      .eq('advocate_id', advocate.id)
      .order('created_at', { ascending: false })
    setCases((data ?? []) as unknown as FeeCase[])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCases()
  }, [loadCases])

  const feeCases = useMemo(() => cases.map(caseItem => {
    const metadata = parseFeeMetadata(caseItem.notes)
    return { caseItem, metadata, totals: feeNumbers(metadata) }
  }).filter(item => item.totals.agreed > 0 || item.totals.received > 0), [cases])

  const summary = useMemo(() => feeCases.reduce((total, item) => ({
    agreed: total.agreed + item.totals.agreed,
    received: total.received + item.totals.received,
    due: total.due + item.totals.due,
  }), { agreed: 0, received: 0, due: 0 }), [feeCases])

  const visibleCases = feeCases.filter(({ caseItem, metadata, totals }) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || caseItem.case_number.toLowerCase().includes(query) || caseItem.case_title?.toLowerCase().includes(query) || caseItem.clients?.full_name?.toLowerCase().includes(query)
    const matchesFilter = filter === 'all' || (filter === 'outstanding' && totals.due > 0) || (filter === 'paid' && totals.agreed > 0 && totals.due === 0) || (filter === 'followup' && Boolean(metadata.fee_follow_up_date))
    return matchesSearch && matchesFilter
  }).sort((first, second) => second.totals.due - first.totals.due)

  function exportCsv() {
    const headers = ['Case Number', 'Case Title', 'Client', 'Status', 'Agreed Fee', 'Received', 'Outstanding', 'Follow-up Date', 'Payment Entries']
    const rows = feeCases.map(({ caseItem, metadata, totals }) => [
      caseItem.case_number,
      caseItem.case_title || '',
      caseItem.clients?.full_name || '',
      caseItem.status || '',
      totals.agreed,
      totals.received,
      totals.due,
      metadata.fee_follow_up_date || '',
      (metadata.payment_history ?? []).length + (totals.openingAdvance > 0 ? 1 : 0),
    ])
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `vakil-saathi-fees-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const collectionRate = summary.agreed > 0 ? Math.min(Math.round((summary.received / summary.agreed) * 100), 100) : 0
  const formatDate = (value: string) => dateFromKey(value).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">{tr('Fees & Payments', 'फीस और भुगतान')}</h1><p className="mt-0.5 text-sm text-gray-500">{tr('Case-wise collections, outstanding balance and payment follow-up', 'केस के अनुसार वसूली, बकाया राशि और भुगतान फॉलो-अप')}</p></div>
        <button type="button" onClick={exportCsv} disabled={!feeCases.length} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />{tr('Export Accounts CSV', 'खाता CSV डाउनलोड करें')}</button>
      </div>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-900 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-emerald-300" /><h2 className="font-bold">{tr('Practice Fee Overview', 'प्रैक्टिस फीस सारांश')}</h2></div><p className="mt-2 text-xs text-emerald-100/70">{tr('Figures are calculated from all case ledgers.', 'सभी केस खातों से गणना की गई राशि।')}</p></div>
          <div className="min-w-[180px]"><div className="flex justify-between text-xs"><span>{tr('Collection rate', 'वसूली दर')}</span><strong>{collectionRate}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${collectionRate}%` }} /></div></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">{tr('Agreed', 'तय फीस')}</p><p className="mt-1 text-base font-extrabold sm:text-2xl">{currency(summary.agreed)}</p></div>
          <div className="rounded-xl bg-emerald-400/10 p-3 ring-1 ring-emerald-300/20"><p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200">{tr('Collected', 'प्राप्त')}</p><p className="mt-1 text-base font-extrabold text-emerald-300 sm:text-2xl">{currency(summary.received)}</p></div>
          <div className="rounded-xl bg-orange-400/10 p-3 ring-1 ring-orange-300/20"><p className="text-[10px] font-semibold uppercase tracking-wide text-orange-200">{tr('Outstanding', 'बकाया')}</p><p className="mt-1 text-base font-extrabold text-orange-300 sm:text-2xl">{currency(summary.due)}</p></div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={tr('Search case or client...', 'केस या मुवक्किल खोजें...')} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-emerald-500" /></div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">{([
          ['all', tr('All', 'सभी')], ['outstanding', tr('Outstanding', 'बकाया')], ['paid', tr('Paid', 'पूर्ण भुगतान')], ['followup', tr('Follow-up', 'फॉलो-अप')],
        ] as [FeeFilter, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${filter === value ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>{label}</button>)}</div>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-gray-400">{tr('Loading fee ledgers...', 'फीस खाते लोड हो रहे हैं...')}</div> : visibleCases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center"><IndianRupee className="mx-auto h-11 w-11 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-600">{feeCases.length ? tr('No matching fee record', 'कोई संबंधित फीस रिकॉर्ड नहीं मिला') : tr('No case fee recorded yet', 'अभी किसी केस की फीस दर्ज नहीं है')}</p><p className="mt-1 text-xs text-gray-400">{tr('Add agreed fee while creating a case to start its ledger.', 'केस बनाते समय तय फीस जोड़कर खाता शुरू करें।')}</p><Link href="/dashboard/cases" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-700">{tr('Open Case Reports', 'केस रिपोर्ट खोलें')} <ChevronRight className="h-4 w-4" /></Link></div>
      ) : (
        <div className="space-y-3">
          {visibleCases.map(({ caseItem, metadata, totals }) => {
            const paid = totals.agreed > 0 && totals.due === 0
            const percentage = totals.agreed > 0 ? Math.min(Math.round((totals.received / totals.agreed) * 100), 100) : 0
            return (
              <article key={caseItem.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-gray-900">{caseItem.case_number}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${paid ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                        {paid ? tr('Paid', 'पूर्ण भुगतान') : tr('Payment Due', 'भुगतान बाकी')}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {caseItem.case_title || tr('Untitled matter', 'बिना शीर्षक का मामला')}{caseItem.clients?.full_name ? ` · ${caseItem.clients.full_name}` : ''}
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${paid ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percentage}%` }} /></div>
                  </div>
                  <div className="sm:min-w-[320px]">
                    <div className="grid grid-cols-3 gap-3 text-right">
                      <div><p className="text-[10px] text-gray-400">{tr('Agreed', 'तय')}</p><p className="text-sm font-bold text-gray-800">{currency(totals.agreed)}</p></div>
                      <div><p className="text-[10px] text-emerald-600">{tr('Received', 'प्राप्त')}</p><p className="text-sm font-bold text-emerald-700">{currency(totals.received)}</p></div>
                      <div><p className="text-[10px] text-orange-500">{tr('Due', 'बकाया')}</p><p className="text-sm font-bold text-orange-600">{currency(totals.due)}</p></div>
                    </div>
                    {metadata.fee_follow_up_date && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-blue-700 sm:justify-end"><CalendarClock className="h-3.5 w-3.5" />{tr('Follow-up', 'फॉलो-अप')}: {formatDate(String(metadata.fee_follow_up_date))}</div>}
                    <Link href={`/dashboard/cases/${caseItem.id}#fees`} className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 sm:float-right">
                      {paid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}{tr('Open Ledger', 'खाता खोलें')}
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <p className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-[11px] leading-5 text-gray-500">{tr('This ledger is an internal practice record. Verify cash, bank and tax records independently before issuing a formal invoice or filing returns.', 'यह खाता आंतरिक प्रैक्टिस रिकॉर्ड है। औपचारिक बिल जारी करने या रिटर्न दाखिल करने से पहले नकद, बैंक और कर रिकॉर्ड की स्वतंत्र रूप से जाँच करें।')}</p>
    </div>
  )
}
