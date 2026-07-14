'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Briefcase, ChevronRight, ChevronLeft, ChevronDown, Trash2, CalendarDays, Clock3, X, FileCheck2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import toast from 'react-hot-toast'
import Link from 'next/link'

const CASE_TYPES = ['Civil', 'Criminal', 'Family', 'Labour', 'Consumer', 'Revenue', 'Writ', 'Other']
const STATUSES = ['Active', 'Disposed', 'Stayed', 'Transferred', 'Withdrawn']
const COURTS_LIST = [
  'District Court, Kanpur Nagar',
  'District Court, Kanpur Dehat',
  'High Court, Allahabad',
  'High Court, Lucknow Bench',
  'Family Court, Kanpur',
  'Labour Court, Kanpur',
  'Consumer Forum, Kanpur',
  'Other',
]

interface Case {
  id: string
  case_number: string
  case_title?: string
  court_name: string
  judge_name?: string
  case_type: string
  opposite_party?: string
  status: string
  notes?: string
  clients?: { full_name: string }
}

interface CaseForm {
  case_number: string
  case_title: string
  case_start_date: string
  party_mobile: string
  court_name: string
  judge_name: string
  case_type: string
  opposite_party: string
  status: string
  documents: string[]
}

interface HearingSchedule {
  id: string
  case_id: string
  hearing_date: string
  hearing_time?: string | null
  hearing_purpose?: string | null
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CASE_DOCUMENTS = [
  'Aadhaar Card',
  'PAN Card',
  'Voter ID Card',
  'Passport',
  'Driving Licence',
  'Passport Size Photographs',
  'Address Proof',
  'Vakalatnama',
  'Affidavit',
  'Court Fee Receipt',
  'FIR Copy',
  'Complaint / Application Copy',
  'Charge Sheet',
  'Bail Order',
  'Notice / Summons',
  'Previous Court Orders',
  'Certified Copy',
  'Agreement / Contract',
  'Sale Deed / Registry',
  'Property Documents',
  'Mutation / Revenue Records',
  'Rent Agreement',
  'Bank Statement',
  'Income Proof / Salary Slip',
  'Medical Report',
  'Marriage Certificate',
  'Birth Certificate',
  'Death Certificate',
  'Correspondence / Emails',
  'Other Supporting Document',
]

const EMPTY_CASE_FORM: CaseForm = {
  case_number: '',
  case_title: '',
  case_start_date: '',
  party_mobile: '',
  court_name: 'District Court, Kanpur Nagar',
  judge_name: '',
  case_type: 'Civil',
  opposite_party: '',
  status: 'Active',
  documents: [],
}

function encodeCaseMetadata(form: CaseForm) {
  return JSON.stringify({
    version: 1,
    case_start_date: form.case_start_date,
    party_mobile: form.party_mobile,
    documents: form.documents,
  })
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatSelectedDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function CasesPage() {
  const { isHindi } = useLanguage()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [advocateId, setAdvocateId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('All')
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [documentSearch, setDocumentSearch] = useState('')
  const [hearings, setHearings] = useState<HearingSchedule[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const [form, setForm] = useState<CaseForm>(EMPTY_CASE_FORM)

  const fetchCases = useCallback(async (advId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cases')
      .select('*, clients(full_name)')
      .eq('advocate_id', advId)
      .order('created_at', { ascending: false })
    if (!error) setCases(data ?? [])
    setLoading(false)
  }, [])

  const fetchHearingSchedule = useCallback(async (advId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('hearings')
      .select('id, case_id, hearing_date, hearing_time, hearing_purpose')
      .eq('advocate_id', advId)
      .order('hearing_date', { ascending: true })
    if (!error) setHearings((data ?? []) as HearingSchedule[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!user) {
        setIsGuest(true)
        setCases([])
        setLoading(false)
        return
      }
      const { data: adv } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
      if (adv) {
        setAdvocateId(adv.id)
        await Promise.all([fetchCases(adv.id), fetchHearingSchedule(adv.id)])
      }
    }
    init()
  }, [fetchCases, fetchHearingSchedule])

  async function handleAddCase(e: React.SyntheticEvent) {
    e.preventDefault()

    if (!form.case_number.trim()) {
      toast.error('Case number zaroori hai')
      return
    }
    if (!form.case_title.trim()) {
      toast.error('Case title zaroori hai')
      return
    }
    if (!form.case_start_date) {
      toast.error('Case start date zaroori hai')
      return
    }
    if (form.party_mobile && !/^[6-9]\d{9}$/.test(form.party_mobile)) {
      toast.error('Sahi 10-digit mobile number daalo')
      return
    }

    const casePayload = {
      case_number: form.case_number,
      case_title: form.case_title,
      court_name: form.court_name,
      judge_name: form.judge_name,
      case_type: form.case_type,
      opposite_party: form.opposite_party,
      status: form.status,
      notes: encodeCaseMetadata(form),
    }

    if (isGuest || !advocateId) {
      setSaving(true)
      const newCase: Case = {
        id: `guest-case-${Date.now()}`,
        ...casePayload,
      }
      setCases(previousCases => [newCase, ...previousCases])
      toast.success('Case add ho gaya! ✅')
      setShowModal(false)
      setForm(EMPTY_CASE_FORM)
      setSaving(false)
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('cases').insert({ ...casePayload, advocate_id: advocateId })
    if (error) {
      toast.error('Case save nahi hua: ' + error.message)
    } else {
      toast.success('Case add ho gaya! ✅')
      setShowModal(false)
      setForm(EMPTY_CASE_FORM)
      await Promise.all([fetchCases(advocateId), fetchHearingSchedule(advocateId)])
    }
    setSaving(false)
  }

  async function handleDelete(caseId: string, caseNumber: string) {
    if (!confirm(`Case "${caseNumber}" delete karna chahte hain?`)) return

    if (isGuest || !advocateId) {
      setCases(previousCases => previousCases.filter(c => c.id !== caseId))
      toast.success('Case delete ho gaya')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('cases').delete().eq('id', caseId)
    if (error) toast.error('Delete nahi hua')
    else {
      toast.success('Case delete ho gaya')
      setCases(prev => prev.filter(c => c.id !== caseId))
    }
  }

  const hearingsByDate = hearings.reduce<Record<string, HearingSchedule[]>>((acc, hearing) => {
    if (!acc[hearing.hearing_date]) acc[hearing.hearing_date] = []
    acc[hearing.hearing_date].push(hearing)
    return acc
  }, {})
  const selectedHearings = selectedDate ? (hearingsByDate[selectedDate] ?? []) : []
  const selectedCaseIds = new Set(selectedHearings.map(hearing => hearing.case_id))

  const filtered = cases.filter(c => {
    const matchSearch = !search ||
      c.case_number.toLowerCase().includes(search.toLowerCase()) ||
      c.court_name.toLowerCase().includes(search.toLowerCase()) ||
      c.opposite_party?.toLowerCase().includes(search.toLowerCase()) ||
      (c.clients as { full_name: string } | undefined)?.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All' || c.status === filterStatus
    const matchDate = !selectedDate || selectedCaseIds.has(c.id)
    return matchSearch && matchStatus && matchDate
  })

  const monthYear = visibleMonth.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
  const firstWeekDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1
  ).getDay()
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  ).getDate()
  const calendarCells: Array<number | null> = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)
  const now = new Date()
  const todayKey = toDateKey(now.getFullYear(), now.getMonth(), now.getDate())
  const matchingDocuments = CASE_DOCUMENTS.filter(document =>
    document.toLowerCase().includes(documentSearch.toLowerCase())
  )

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Active: 'bg-green-100 text-green-700',
      Disposed: 'bg-gray-100 text-gray-600',
      Stayed: 'bg-yellow-100 text-yellow-700',
      Transferred: 'bg-blue-100 text-blue-700',
      Withdrawn: 'bg-red-100 text-red-700',
    }
    return colors[status] ?? 'bg-gray-100 text-gray-600'
  }

  const caseTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      Civil: 'bg-blue-50 text-blue-600',
      Criminal: 'bg-red-50 text-red-600',
      Family: 'bg-purple-50 text-purple-600',
      Labour: 'bg-orange-50 text-orange-600',
      Consumer: 'bg-teal-50 text-teal-600',
      Revenue: 'bg-yellow-50 text-yellow-700',
      Writ: 'bg-indigo-50 text-indigo-600',
      Other: 'bg-gray-100 text-gray-600',
    }
    return colors[type] ?? 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{isHindi ? 'मुकदमे' : 'Cases Diary'}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {isHindi ? 'नया मुकदमा' : 'New Case'}
        </button>
      </div>

      {/* Hearing calendar */}
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-gray-900">Hearing Calendar</h2>
              <p className="truncate text-xs text-gray-500">Select a date to see its cases</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[118px] text-center text-sm font-semibold text-gray-800 sm:min-w-[145px]">{monthYear}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_DAYS.map(day => (
              <div key={day} className="py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">{day}</div>
            ))}
            {calendarCells.map((day, index) => {
              if (!day) return <div key={`blank-${index}`} className="aspect-square" />
              const dateKey = toDateKey(visibleMonth.getFullYear(), visibleMonth.getMonth(), day)
              const dayHearings = hearingsByDate[dateKey] ?? []
              const isSelected = selectedDate === dateKey
              const isToday = todayKey === dateKey
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(current => current === dateKey ? null : dateKey)}
                  aria-label={`${dateKey}${dayHearings.length ? `, ${dayHearings.length} hearings` : ''}`}
                  className={`relative flex aspect-square min-h-9 flex-col items-center justify-center rounded-xl text-xs font-semibold transition sm:min-h-11 sm:text-sm ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : dayHearings.length
                        ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        : 'text-gray-600 hover:bg-gray-100'
                  } ${isToday && !isSelected ? 'ring-1 ring-inset ring-blue-400' : ''}`}
                >
                  <span>{day}</span>
                  {dayHearings.length > 0 && (
                    <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {selectedDate && (
          <div className="flex items-center justify-between gap-3 border-t border-blue-100 bg-blue-50/70 px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs text-blue-600">Selected date</p>
              <p className="text-sm font-semibold text-blue-950">{formatSelectedDate(selectedDate)}</p>
              <p className="mt-0.5 text-xs text-blue-700">{selectedHearings.length} hearing{selectedHearings.length === 1 ? '' : 's'} found</p>
            </div>
            <button type="button" onClick={() => setSelectedDate(null)} className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
              <X className="h-3.5 w-3.5" /> All cases
            </button>
          </div>
        )}
      </section>

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isHindi ? 'मुकदमा नंबर, अदालत या मुवक्किल खोजें...' : 'Search by case number, court, or client...'}
            className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 transition"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 transition">
          <option value="All">Sabhi Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          {selectedDate ? <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" /> : <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />}
          <p className="text-gray-500 font-medium">{selectedDate ? 'No hearings on this date' : (isHindi ? 'कोई मुकदमा नहीं मिला' : 'No cases found')}</p>
          {selectedDate ? (
            <button onClick={() => setSelectedDate(null)} className="mt-3 text-blue-600 text-sm hover:underline">Show all cases</button>
          ) : (
            <button onClick={() => setShowModal(true)} className="mt-3 text-orange-500 text-sm hover:underline">+ Pehla case add karein</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition group">
              <Link href={`/dashboard/cases/${c.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="bg-blue-600/10 rounded-lg p-2 flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-gray-900" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{c.case_number}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${caseTypeBadge(c.case_type)}`}>
                      {c.case_type}
                    </span>
                  </div>
                  {c.case_title && <p className="text-gray-600 text-xs mt-0.5">{c.case_title}</p>}
                  <p className="text-gray-400 text-xs mt-0.5">{c.court_name}</p>
                  {(c.clients as { full_name: string } | undefined)?.full_name && (
                    <p className="text-gray-400 text-xs">
                      Client: {(c.clients as { full_name: string }).full_name}
                    </p>
                  )}
                  {selectedDate && selectedHearings.filter(hearing => hearing.case_id === c.id).map(hearing => (
                    <div key={hearing.id} className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-blue-700">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {hearing.hearing_purpose || 'Hearing'}
                      </span>
                      {hearing.hearing_time && (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <Clock3 className="h-3.5 w-3.5" /> {hearing.hearing_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(c.id, c.case_number)}
                  className="p-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link href={`/dashboard/cases/${c.id}`}>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Case Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Naya Case Add Karein</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAddCase} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Title *</label>
                  <input value={form.case_title} onChange={e => setForm(f => ({ ...f, case_title: e.target.value }))}
                    placeholder="Ram vs Shyam" required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Number *</label>
                  <input value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))}
                    placeholder="CS/123/2026" required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Start Date *</label>
                  <input type="date" value={form.case_start_date} onChange={e => setForm(f => ({ ...f, case_start_date: e.target.value }))} required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input type="tel" inputMode="numeric" value={form.party_mobile} onChange={e => setForm(f => ({ ...f, party_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="9876543210"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
                  <select value={form.case_type} onChange={e => setForm(f => ({ ...f, case_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {CASE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Court Name *</label>
                  <select value={form.court_name} onChange={e => setForm(f => ({ ...f, court_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {COURTS_LIST.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Judge Name</label>
                  <input value={form.judge_name} onChange={e => setForm(f => ({ ...f, judge_name: e.target.value }))}
                    placeholder="Hon'ble Judge..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opposite Party</label>
                  <input value={form.opposite_party} onChange={e => setForm(f => ({ ...f, opposite_party: e.target.value }))}
                    placeholder="Opposite party ka naam"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Documents Received</label>
                  <div className="relative">
                    <button type="button" onClick={() => setDocumentsOpen(open => !open)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm transition hover:border-blue-400">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileCheck2 className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <span className={form.documents.length ? 'font-medium text-gray-800' : 'text-gray-400'}>
                          {form.documents.length ? `${form.documents.length} documents received` : 'Select documents received from party'}
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition ${documentsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {documentsOpen && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                        <div className="border-b border-gray-100 p-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} placeholder="Search documents..."
                              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500" />
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2">
                          {matchingDocuments.map(document => {
                            const checked = form.documents.includes(document)
                            return (
                              <label key={document} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${checked ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <input type="checkbox" checked={checked} onChange={() => setForm(current => ({
                                  ...current,
                                  documents: checked ? current.documents.filter(item => item !== document) : [...current.documents, document],
                                }))} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="flex-1">{document}</span>
                              </label>
                            )
                          })}
                        </div>
                        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-2">
                          <span className="text-xs font-medium text-gray-600">{form.documents.length} selected</span>
                          <button type="button" onClick={() => setDocumentsOpen(false)} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Done</button>
                        </div>
                      </div>
                    )}
                  </div>
                  {form.documents.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {form.documents.map(document => <span key={document} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">{document}</span>)}
                    </div>
                  )}
                </div>
              </div>
              <div className="sticky bottom-0 -mx-6 -mb-6 flex gap-3 border-t border-gray-100 bg-white px-6 py-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
                <button type="button" onClick={handleAddCase} disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 transition text-sm">
                  {saving ? 'Save ho raha hai...' : 'Case Save Karein ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
