'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Briefcase, ChevronRight, ChevronLeft, ChevronDown, Trash2, CalendarDays, Clock3, X, FileCheck2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useLanguage } from '@/components/LanguageProvider'
import LanguageToggle from '@/components/LanguageToggle'

const CASE_TYPES = ['Civil', 'Criminal', 'Family', 'Labour', 'Consumer', 'Revenue', 'Writ', 'Other']
const MATTER_STAGES = ['New Enquiry', 'Documents Pending', 'Drafting', 'Legal Notice', 'Ready for Filing', 'Filed', 'Scrutiny / Objection', 'Registered', 'Active', 'Evidence', 'Arguments', 'Judgment Reserved', 'Disposed', 'Appeal / Execution']
const STATUSES = MATTER_STAGES
const MATTER_NATURES: Record<string, string[]> = {
  Civil: ['Injunction', 'Recovery Suit', 'Property Dispute', 'Partition', 'Declaration', 'Specific Performance', 'Execution', 'Civil Appeal', 'Other Civil Matter'],
  Criminal: ['Bail', 'Anticipatory Bail', 'Criminal Complaint', 'Trial', 'Cheque Bounce - NI Act 138', 'Criminal Appeal', 'Revision', 'Other Criminal Matter'],
  Family: ['Divorce', 'Maintenance', 'Domestic Violence', 'Child Custody', 'Restitution of Conjugal Rights', 'Succession', 'Other Family Matter'],
  Labour: ['Termination Dispute', 'Wages / Benefits', 'Industrial Dispute', 'Service Matter', 'Other Labour Matter'],
  Consumer: ['Consumer Complaint', 'Deficiency in Service', 'Product Dispute', 'Insurance Claim', 'Other Consumer Matter'],
  Revenue: ['Mutation', 'Land Revenue Dispute', 'Demarcation', 'Revenue Appeal', 'Other Revenue Matter'],
  Writ: ['Civil Writ', 'Criminal Writ', 'Service Writ', 'Public Interest Litigation', 'Other Writ'],
  Other: ['Legal Notice', 'Consultation Only', 'Drafting Work', 'Other Matter'],
}
const STAGE_HI: Record<string, string> = {
  'New Enquiry': 'नई पूछताछ', 'Documents Pending': 'दस्तावेज़ लंबित', Drafting: 'मसौदा तैयार करना', 'Legal Notice': 'कानूनी नोटिस', 'Ready for Filing': 'दाखिले के लिए तैयार', Filed: 'दाखिल', 'Scrutiny / Objection': 'जाँच / आपत्ति', Registered: 'पंजीकृत', Active: 'सक्रिय', Evidence: 'साक्ष्य', Arguments: 'बहस', 'Judgment Reserved': 'निर्णय सुरक्षित', Disposed: 'निस्तारित', 'Appeal / Execution': 'अपील / निष्पादन',
}
const COURTS_LIST = [
  'Not assigned / Pre-filing',
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
  clients?: { full_name: string; phone?: string; consent_given?: boolean }
}

interface CaseForm {
  client_mode: 'existing' | 'new'
  client_id: string
  client_name: string
  client_phone: string
  client_address: string
  client_notes: string
  client_consent: boolean
  case_number: string
  cnr_number: string
  case_title: string
  consultation_date: string
  matter_nature: string
  facts_summary: string
  relief_sought: string
  acts_sections: string
  urgency: string
  limitation_date: string
  filing_number: string
  filing_date: string
  court_name: string
  court_number: string
  judge_name: string
  case_type: string
  opposite_party: string
  opposite_advocate: string
  status: string
  documents: string[]
  agreed_fee: string
  advance_received: string
  fee_notes: string
  next_action: string
  next_action_deadline: string
  internal_notes: string
}

interface ClientOption {
  id: string
  full_name: string
  phone: string
  address?: string | null
  notes?: string | null
  consent_given: boolean
}

interface HearingSchedule {
  id: string
  case_id: string
  hearing_date: string
  hearing_time?: string | null
  hearing_purpose?: string | null
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const GUEST_CASES_STORAGE_KEY = 'vakil_guest_cases_v2'

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
  client_mode: 'existing',
  client_id: '',
  client_name: '',
  client_phone: '',
  client_address: '',
  client_notes: '',
  client_consent: false,
  case_number: '',
  cnr_number: '',
  case_title: '',
  consultation_date: new Date().toISOString().split('T')[0],
  matter_nature: 'Injunction',
  facts_summary: '',
  relief_sought: '',
  acts_sections: '',
  urgency: 'Normal',
  limitation_date: '',
  filing_number: '',
  filing_date: '',
  court_name: 'Not assigned / Pre-filing',
  court_number: '',
  judge_name: '',
  case_type: 'Civil',
  opposite_party: '',
  opposite_advocate: '',
  status: 'New Enquiry',
  documents: [],
  agreed_fee: '',
  advance_received: '',
  fee_notes: '',
  next_action: '',
  next_action_deadline: '',
  internal_notes: '',
}

function encodeCaseMetadata(form: CaseForm) {
  return JSON.stringify({
    version: 2,
    consultation_date: form.consultation_date,
    case_start_date: form.consultation_date,
    party_mobile: form.client_phone,
    client_consent: form.client_consent,
    cnr_number: form.cnr_number || undefined,
    matter_nature: form.matter_nature,
    facts_summary: form.facts_summary,
    relief_sought: form.relief_sought,
    acts_sections: form.acts_sections,
    urgency: form.urgency,
    limitation_date: form.limitation_date,
    filing_number: form.filing_number,
    filing_date: form.filing_date,
    court_number: form.court_number,
    opposite_advocate: form.opposite_advocate,
    documents: form.documents,
    agreed_fee: form.agreed_fee,
    advance_received: form.advance_received,
    fee_notes: form.fee_notes,
    next_action: form.next_action,
    next_action_deadline: form.next_action_deadline,
    internal_notes: form.internal_notes,
  })
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatSelectedDate(dateKey: string, isHindi: boolean) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function CasesPage() {
  const { isHindi, tr } = useLanguage()
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
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
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

  const fetchClients = useCallback(async (advId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('clients')
      .select('id, full_name, phone, address, notes, consent_given')
      .eq('advocate_id', advId)
      .order('full_name')
    if (!error) setClients((data ?? []) as ClientOption[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!user) {
        setIsGuest(true)
        try {
          const storedCases = window.sessionStorage.getItem(GUEST_CASES_STORAGE_KEY)
          setCases(storedCases ? JSON.parse(storedCases) as Case[] : [])
        } catch {
          setCases([])
        }
        setLoading(false)
        return
      }
      const { data: adv } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
      if (adv) {
        setAdvocateId(adv.id)
        await Promise.all([fetchCases(adv.id), fetchHearingSchedule(adv.id), fetchClients(adv.id)])
      }
    }
    init()
  }, [fetchCases, fetchHearingSchedule, fetchClients])

  async function handleAddCase(e: React.SyntheticEvent) {
    e.preventDefault()

    if (!form.case_title.trim()) {
      toast.error(tr('Case title is required', 'केस का शीर्षक आवश्यक है'))
      return
    }
    if (!form.facts_summary.trim()) {
      toast.error(tr('Add a short summary of the client problem', 'मुवक्किल की समस्या का संक्षिप्त सार जोड़ें'))
      return
    }
    if (!form.consultation_date) {
      toast.error(tr('Consultation date is required', 'परामर्श की तारीख आवश्यक है'))
      return
    }
    if (form.client_mode === 'existing' && !form.client_id && clients.length > 0) {
      toast.error(tr('Select an existing client or create a new client', 'मौजूदा मुवक्किल चुनें या नया मुवक्किल बनाएँ'))
      return
    }
    if ((form.client_mode === 'new' || clients.length === 0) && !form.client_name.trim()) {
      toast.error(tr('Client name is required', 'मुवक्किल का नाम आवश्यक है'))
      return
    }
    if (form.cnr_number && !/^[A-Z0-9]{16}$/.test(form.cnr_number)) {
      toast.error(tr('CNR number must contain exactly 16 letters and numbers', 'CNR नंबर में ठीक 16 अक्षर और अंक होने चाहिए'))
      return
    }
    if (form.client_phone && !/^[6-9]\d{9}$/.test(form.client_phone)) {
      toast.error(tr('Enter a valid 10-digit mobile number', 'सही 10 अंकों का मोबाइल नंबर दर्ज करें'))
      return
    }

    const generatedMatterNumber = `VS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
    const displayCaseNumber = form.case_number.trim() || generatedMatterNumber
    const casePayload = {
      case_number: displayCaseNumber,
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
        clients: form.client_name ? { full_name: form.client_name, phone: form.client_phone, consent_given: form.client_consent } : undefined,
      }
      setCases(previousCases => {
        const nextCases = [newCase, ...previousCases]
        window.sessionStorage.setItem(GUEST_CASES_STORAGE_KEY, JSON.stringify(nextCases))
        return nextCases
      })
      toast.success(tr('Case added successfully! ✅', 'केस सफलतापूर्वक जोड़ दिया गया! ✅'))
      setShowModal(false)
      setForm(EMPTY_CASE_FORM)
      setSaving(false)
      return
    }

    setSaving(true)
    const supabase = createClient()
    let clientId = form.client_id || null
    if (form.client_mode === 'new' || clients.length === 0) {
      const { data: newClient, error: clientError } = await supabase.from('clients').insert({
        advocate_id: advocateId,
        full_name: form.client_name.trim(),
        phone: form.client_phone,
        address: form.client_address || null,
        notes: form.client_notes || null,
        consent_given: form.client_consent,
      }).select('id').single()
      if (clientError || !newClient) {
        toast.error(tr('Client could not be saved: ', 'मुवक्किल सहेजा नहीं जा सका: ') + (clientError?.message || 'Unknown error'))
        setSaving(false)
        return
      }
      clientId = newClient.id
    }
    const { error } = await supabase.from('cases').insert({ ...casePayload, advocate_id: advocateId, client_id: clientId })
    if (error) {
      toast.error(tr('Case could not be saved: ', 'केस सहेजा नहीं जा सका: ') + error.message)
    } else {
      toast.success(tr('Case added successfully! ✅', 'केस सफलतापूर्वक जोड़ दिया गया! ✅'))
      setShowModal(false)
      setForm(EMPTY_CASE_FORM)
      await Promise.all([fetchCases(advocateId), fetchHearingSchedule(advocateId), fetchClients(advocateId)])
    }
    setSaving(false)
  }

  async function handleDelete(caseId: string, caseNumber: string) {
    if (!confirm(tr(`Delete case "${caseNumber}"?`, `केस "${caseNumber}" हटाएँ?`))) return

    if (isGuest || !advocateId) {
      setCases(previousCases => {
        const nextCases = previousCases.filter(c => c.id !== caseId)
        window.sessionStorage.setItem(GUEST_CASES_STORAGE_KEY, JSON.stringify(nextCases))
        return nextCases
      })
      toast.success(tr('Case deleted successfully', 'केस सफलतापूर्वक हटा दिया गया'))
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('cases').delete().eq('id', caseId)
    if (error) toast.error(tr('Case could not be deleted', 'केस हटाया नहीं जा सका'))
    else {
      toast.success(tr('Case deleted successfully', 'केस सफलतापूर्वक हटा दिया गया'))
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

  const monthYear = visibleMonth.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
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
      'New Enquiry': 'bg-sky-100 text-sky-700',
      'Documents Pending': 'bg-amber-100 text-amber-700',
      Drafting: 'bg-purple-100 text-purple-700',
      'Legal Notice': 'bg-orange-100 text-orange-700',
      'Ready for Filing': 'bg-cyan-100 text-cyan-700',
      Filed: 'bg-blue-100 text-blue-700',
      'Scrutiny / Objection': 'bg-red-100 text-red-700',
      Registered: 'bg-indigo-100 text-indigo-700',
      Active: 'bg-green-100 text-green-700',
      Evidence: 'bg-violet-100 text-violet-700',
      Arguments: 'bg-fuchsia-100 text-fuchsia-700',
      'Judgment Reserved': 'bg-yellow-100 text-yellow-800',
      'Appeal / Execution': 'bg-teal-100 text-teal-700',
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

  function toggleCalendar() {
    setCalendarOpen(open => {
      if (open) setSelectedDate(null)
      return !open
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{tr('Case Reports', 'केस रिपोर्ट')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {tr('New Case', 'नया केस')}
        </button>
      </div>

      {/* Hearing calendar */}
      <section className="w-full max-w-3xl overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 ${calendarOpen ? 'border-b border-gray-100' : ''}`}>
          <button type="button" onClick={toggleCalendar} aria-expanded={calendarOpen} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-gray-900">{tr('Hearing Calendar', 'सुनवाई कैलेंडर')}</h2>
              <p className="truncate text-xs text-gray-500">{calendarOpen ? tr('Select a date to see its cases', 'उस दिन के केस देखने के लिए तारीख चुनें') : tr('Click to view case dates', 'केस की तारीखें देखने के लिए क्लिक करें')}</p>
            </div>
            <ChevronDown className={`ml-auto h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${calendarOpen ? 'rotate-180 text-blue-600' : ''}`} />
          </button>
          {calendarOpen && <div className="flex w-full items-center justify-between gap-1 rounded-lg bg-gray-50 px-1 sm:w-auto sm:bg-transparent sm:px-0">
            <button
              type="button"
              aria-label={tr('Previous month', 'पिछला महीना')}
              onClick={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[118px] text-center text-sm font-semibold text-gray-800 sm:min-w-[145px]">{monthYear}</p>
            <button
              type="button"
              aria-label={tr('Next month', 'अगला महीना')}
              onClick={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>}
        </div>

        {calendarOpen && <div className="p-2.5 sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center">
            {(isHindi ? ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'] : WEEK_DAYS).map(day => (
              <div key={day} className="py-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400 sm:text-[10px]">{day}</div>
            ))}
            {calendarCells.map((day, index) => {
              if (!day) return <div key={`blank-${index}`} className="h-9 sm:h-10" />
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
                  className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition sm:h-10 sm:text-xs ${
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
        </div>}

        {calendarOpen && selectedDate && (
          <div className="flex items-center justify-between gap-3 border-t border-blue-100 bg-blue-50/70 px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs text-blue-600">{tr('Selected date', 'चुनी गई तारीख')}</p>
              <p className="text-sm font-semibold text-blue-950">{formatSelectedDate(selectedDate, isHindi)}</p>
              <p className="mt-0.5 text-xs text-blue-700">{isHindi ? `${selectedHearings.length} सुनवाई मिलीं` : `${selectedHearings.length} hearing${selectedHearings.length === 1 ? '' : 's'} found`}</p>
            </div>
            <button type="button" onClick={() => setSelectedDate(null)} className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
              <X className="h-3.5 w-3.5" /> {tr('All cases', 'सभी केस')}
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
            placeholder={tr('Search by case number, court, or client...', 'केस नंबर, न्यायालय या मुवक्किल से खोजें...')}
            className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 transition"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 transition">
          <option value="All">{tr('All Statuses', 'सभी स्थितियाँ')}</option>
          {STATUSES.map(s => <option key={s} value={s}>{isHindi ? STAGE_HI[s] || s : s}</option>)}
        </select>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">{tr('Loading...', 'लोड हो रहा है...')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          {selectedDate ? <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" /> : <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />}
          <p className="text-gray-500 font-medium">{selectedDate ? tr('No hearings on this date', 'इस तारीख पर कोई सुनवाई नहीं है') : tr('No cases found', 'कोई केस नहीं मिला')}</p>
          {selectedDate ? (
            <button onClick={() => setSelectedDate(null)} className="mt-3 text-blue-600 text-sm hover:underline">{tr('Show all cases', 'सभी केस दिखाएँ')}</button>
          ) : (
            <button onClick={() => setShowModal(true)} className="mt-3 text-orange-500 text-sm hover:underline">+ {tr('Add your first case', 'अपना पहला केस जोड़ें')}</button>
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
                      {isHindi ? STAGE_HI[c.status] || c.status : c.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${caseTypeBadge(c.case_type)}`}>
                      {isHindi ? ({ Civil: 'दीवानी', Criminal: 'फौजदारी', Family: 'पारिवारिक', Labour: 'श्रम', Consumer: 'उपभोक्ता', Revenue: 'राजस्व', Writ: 'रिट', Other: 'अन्य' } as Record<string, string>)[c.case_type] || c.case_type : c.case_type}
                    </span>
                  </div>
                  {c.case_title && <p className="text-gray-600 text-xs mt-0.5">{c.case_title}</p>}
                  <p className="text-gray-400 text-xs mt-0.5">{c.court_name}</p>
                  {(c.clients as { full_name: string } | undefined)?.full_name && (
                    <p className="text-gray-400 text-xs">
                      {tr('Client', 'मुवक्किल')}: {(c.clients as { full_name: string }).full_name}
                    </p>
                  )}
                  {selectedDate && selectedHearings.filter(hearing => hearing.case_id === c.id).map(hearing => (
                    <div key={hearing.id} className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-blue-700">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {hearing.hearing_purpose || tr('Hearing', 'सुनवाई')}
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
              <h2 className="text-lg font-bold text-gray-900">{tr('Add New Case', 'नया केस जोड़ें')}</h2>
              <div className="flex items-center gap-2">
                <LanguageToggle compact />
                <button onClick={() => setShowModal(false)} aria-label={tr('Close', 'बंद करें')} className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">✕</button>
              </div>
            </div>
            <form onSubmit={handleAddCase} className="p-6 space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-950">{tr('Create a complete matter file', 'पूर्ण मुकदमा फ़ाइल बनाएँ')}</p>
                <p className="mt-1 text-xs leading-5 text-blue-700">{tr('Start with the client and matter details. Court numbers can be added later after filing.', 'मुवक्किल और मामले की जानकारी से शुरू करें। कोर्ट नंबर दाखिले के बाद जोड़े जा सकते हैं।')}</p>
              </div>

              <section className="rounded-xl border border-gray-200 p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">01</p>
                  <h3 className="font-bold text-gray-900">{tr('Client & Contact', 'मुवक्किल और संपर्क')}</h3>
                </div>
                {clients.length > 0 && (
                  <div className="mb-4 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
                    <button type="button" onClick={() => setForm(current => ({ ...current, client_mode: 'existing' }))} className={`rounded-md px-3 py-2 text-sm font-medium ${form.client_mode === 'existing' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{tr('Existing Client', 'मौजूदा मुवक्किल')}</button>
                    <button type="button" onClick={() => setForm(current => ({ ...current, client_mode: 'new', client_id: '' }))} className={`rounded-md px-3 py-2 text-sm font-medium ${form.client_mode === 'new' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{tr('New Client', 'नया मुवक्किल')}</button>
                  </div>
                )}
                {clients.length > 0 && form.client_mode === 'existing' ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Select Client', 'मुवक्किल चुनें')} *</label>
                    <select value={form.client_id} onChange={event => {
                      const selected = clients.find(client => client.id === event.target.value)
                      setForm(current => ({ ...current, client_id: event.target.value, client_phone: selected?.phone || '' }))
                    }} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500">
                      <option value="">— {tr('Select an existing client', 'मौजूदा मुवक्किल चुनें')} —</option>
                      {clients.map(client => <option key={client.id} value={client.id}>{client.full_name} {client.phone ? `• ${client.phone}` : ''}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Client Full Name', 'मुवक्किल का पूरा नाम')} *</label>
                      <input value={form.client_name} onChange={event => setForm(current => ({ ...current, client_name: event.target.value }))} placeholder={tr('Enter full name', 'पूरा नाम दर्ज करें')} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Mobile / WhatsApp', 'मोबाइल / WhatsApp')}</label>
                      <input type="tel" inputMode="numeric" value={form.client_phone} onChange={event => setForm(current => ({ ...current, client_phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder={tr('10-digit number', '10 अंकों का नंबर')} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Address', 'पता')}</label>
                      <input value={form.client_address} onChange={event => setForm(current => ({ ...current, client_address: event.target.value }))} placeholder={tr('Client address', 'मुवक्किल का पता')} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-800">
                        <input type="checkbox" checked={form.client_consent} onChange={event => setForm(current => ({ ...current, client_consent: event.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-green-300 text-green-600" />
                        <span><strong>{tr('WhatsApp consent received', 'WhatsApp सहमति प्राप्त')}</strong><span className="mt-0.5 block text-xs font-normal">{tr('Select only after the client agrees to receive case updates.', 'मुवक्किल द्वारा केस अपडेट लेने की सहमति देने के बाद ही चुनें।')}</span></span>
                      </label>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">02</p>
                  <h3 className="font-bold text-gray-900">{tr('Matter Intake', 'मामले की प्रारंभिक जानकारी')}</h3>
                </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Matter Title', 'मामले का शीर्षक')} *</label>
                  <input value={form.case_title} onChange={e => setForm(f => ({ ...f, case_title: e.target.value }))}
                    placeholder="Ram vs Shyam" required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Court Case Number (Optional)', 'कोर्ट केस नंबर (वैकल्पिक)')}</label>
                  <input value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))}
                    placeholder={tr('Leave blank before registration', 'रजिस्ट्रेशन से पहले खाली छोड़ें')}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                  <p className="mt-1 text-xs text-gray-400">{tr('An internal VS matter number will be generated automatically if left blank.', 'खाली छोड़ने पर आंतरिक VS मामला नंबर अपने-आप बनेगा।')}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('eCourts CNR Number (Optional)', 'eCourts CNR नंबर (वैकल्पिक)')}</label>
                  <input value={form.cnr_number} onChange={e => setForm(f => ({ ...f, cnr_number: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) }))}
                    placeholder={tr('16-character CNR number', '16 अक्षरों का CNR नंबर')} minLength={16} maxLength={16}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm uppercase tracking-wider focus:border-blue-500 transition" />
                  <p className="mt-1 text-xs text-gray-400">{tr('Used to verify this case on the official eCourts service.', 'इस केस को आधिकारिक eCourts सेवा पर सत्यापित करने के लिए उपयोग होगा।')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Consultation / Matter Start Date', 'परामर्श / मामला शुरू होने की तारीख')} *</label>
                  <input type="date" value={form.consultation_date} onChange={e => setForm(f => ({ ...f, consultation_date: e.target.value }))} required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Urgency', 'प्राथमिकता')}</label>
                  <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    <option>Normal</option><option>Urgent</option><option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Case Type', 'केस का प्रकार')}</label>
                  <select value={form.case_type} onChange={e => setForm(f => ({ ...f, case_type: e.target.value, matter_nature: MATTER_NATURES[e.target.value]?.[0] || '' }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {CASE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Status', 'स्थिति')}</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {STATUSES.map(s => <option key={s} value={s}>{isHindi ? STAGE_HI[s] || s : s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Nature of Matter', 'मामले की प्रकृति')}</label>
                  <select value={form.matter_nature} onChange={e => setForm(f => ({ ...f, matter_nature: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {(MATTER_NATURES[form.case_type] ?? []).map(nature => <option key={nature}>{nature}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Facts / Client Problem Summary', 'तथ्य / मुवक्किल की समस्या का सार')} *</label>
                  <textarea value={form.facts_summary} onChange={e => setForm(f => ({ ...f, facts_summary: e.target.value }))} rows={4} maxLength={2000} placeholder={tr('Record the key facts and timeline shared by the client...', 'मुवक्किल द्वारा बताए गए मुख्य तथ्य और घटनाक्रम दर्ज करें...')} className="w-full resize-none border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Relief / Client Objective', 'मांगी गई राहत / मुवक्किल का उद्देश्य')}</label>
                  <textarea value={form.relief_sought} onChange={e => setForm(f => ({ ...f, relief_sought: e.target.value }))} rows={2} placeholder={tr('What result does the client want?', 'मुवक्किल क्या परिणाम चाहता है?')} className="w-full resize-none border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Acts / Sections', 'अधिनियम / धाराएँ')}</label>
                  <input value={form.acts_sections} onChange={e => setForm(f => ({ ...f, acts_sections: e.target.value }))} placeholder={tr('e.g. CPC, Section 138 NI Act', 'जैसे CPC, धारा 138 NI Act')} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Limitation / Critical Deadline', 'लिमिटेशन / महत्वपूर्ण समय-सीमा')}</label>
                  <input type="date" value={form.limitation_date} onChange={e => setForm(f => ({ ...f, limitation_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
              </div>
              </section>

              <section className="rounded-xl border border-gray-200 p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">03</p>
                  <h3 className="font-bold text-gray-900">{tr('Court & Filing', 'कोर्ट और दाखिला')}</h3>
                  <p className="mt-1 text-xs text-gray-500">{tr('Optional for enquiries and pre-filing matters.', 'पूछताछ और दाखिले से पहले के मामलों के लिए वैकल्पिक।')}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Filing Number', 'फाइलिंग नंबर')}</label>
                  <input value={form.filing_number} onChange={e => setForm(f => ({ ...f, filing_number: e.target.value }))} placeholder="Filing No." className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Filing Date', 'दाखिला तारीख')}</label>
                  <input type="date" value={form.filing_date} onChange={e => setForm(f => ({ ...f, filing_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Court / Establishment', 'न्यायालय / स्थापना')}</label>
                  <select value={form.court_name} onChange={e => setForm(f => ({ ...f, court_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {COURTS_LIST.map(court => <option key={court}>{court}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Court / Room Number', 'न्यायालय / कक्ष संख्या')}</label>
                  <input value={form.court_number} onChange={e => setForm(f => ({ ...f, court_number: e.target.value }))}
                    placeholder={tr('e.g. Court 12', 'जैसे न्यायालय 12')}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Judge Name', 'न्यायाधीश का नाम')}</label>
                  <input value={form.judge_name} onChange={e => setForm(f => ({ ...f, judge_name: e.target.value }))}
                    placeholder={tr("Hon'ble Judge...", 'माननीय न्यायाधीश...')}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Opposite Party', 'विपक्षी पक्ष')}</label>
                  <input value={form.opposite_party} onChange={e => setForm(f => ({ ...f, opposite_party: e.target.value }))}
                    placeholder={tr('Opposite party name', 'विपक्षी पक्ष का नाम')}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Opposite Advocate', 'विपक्षी अधिवक्ता')}</label>
                  <input value={form.opposite_advocate} onChange={e => setForm(f => ({ ...f, opposite_advocate: e.target.value }))} placeholder={tr('Name and contact, if known', 'नाम और संपर्क, यदि ज्ञात हो')} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">04</p>
                  <h3 className="font-bold text-gray-900">{tr('Documents Received', 'प्राप्त दस्तावेज़')}</h3>
                  <p className="mt-1 text-xs text-gray-500">{tr('Mark what the client has already provided. File upload will be added in the Document Vault module.', 'मुवक्किल द्वारा दिए गए दस्तावेज़ चुनें। फ़ाइल अपलोड Document Vault मॉड्यूल में जोड़ा जाएगा।')}</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="relative">
                    <button type="button" onClick={() => setDocumentsOpen(open => !open)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm transition hover:border-blue-400">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileCheck2 className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <span className={form.documents.length ? 'font-medium text-gray-800' : 'text-gray-400'}>
                          {form.documents.length ? (isHindi ? `${form.documents.length} दस्तावेज़ प्राप्त` : `${form.documents.length} documents received`) : tr('Select documents received from party', 'पक्षकार से प्राप्त दस्तावेज़ चुनें')}
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition ${documentsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {documentsOpen && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                        <div className="border-b border-gray-100 p-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} placeholder={tr('Search documents...', 'दस्तावेज़ खोजें...')}
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
                          <span className="text-xs font-medium text-gray-600">{isHindi ? `${form.documents.length} चुने गए` : `${form.documents.length} selected`}</span>
                          <button type="button" onClick={() => setDocumentsOpen(false)} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">{tr('Done', 'पूर्ण')}</button>
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
              </section>

              <section className="rounded-xl border border-gray-200 p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">05</p>
                  <h3 className="font-bold text-gray-900">{tr('Fee & Next Action', 'फीस और अगला कार्य')}</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Agreed Professional Fee', 'तय पेशेवर फीस')}</label>
                    <input type="number" min="0" value={form.agreed_fee} onChange={event => setForm(current => ({ ...current, agreed_fee: event.target.value }))} placeholder="₹ 0" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Advance Received', 'प्राप्त अग्रिम')}</label>
                    <input type="number" min="0" value={form.advance_received} onChange={event => setForm(current => ({ ...current, advance_received: event.target.value }))} placeholder="₹ 0" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Fee Notes', 'फीस टिप्पणी')}</label>
                    <input value={form.fee_notes} onChange={event => setForm(current => ({ ...current, fee_notes: event.target.value }))} placeholder={tr('Instalment plan or expense note', 'किस्त योजना या खर्च की टिप्पणी')} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Next Action', 'अगला कार्य')}</label>
                    <input value={form.next_action} onChange={event => setForm(current => ({ ...current, next_action: event.target.value }))} placeholder={tr('e.g. Draft legal notice', 'जैसे कानूनी नोटिस तैयार करें')} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Action Deadline', 'कार्य की समय-सीमा')}</label>
                    <input type="date" value={form.next_action_deadline} onChange={event => setForm(current => ({ ...current, next_action_deadline: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Private Advocate Notes', 'अधिवक्ता की निजी टिप्पणी')}</label>
                    <textarea value={form.internal_notes} onChange={event => setForm(current => ({ ...current, internal_notes: event.target.value }))} rows={3} placeholder={tr('Strategy, risk, missing information or internal note...', 'रणनीति, जोखिम, अधूरी जानकारी या निजी टिप्पणी...')} className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                  </div>
                </div>
              </section>
              <div className="sticky bottom-0 -mx-6 -mb-6 flex gap-3 border-t border-gray-100 bg-white px-6 py-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">
                  {tr('Cancel', 'रद्द करें')}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 transition text-sm">
                  {saving ? tr('Saving...', 'सहेजा जा रहा है...') : tr('Save Case ✅', 'केस सहेजें ✅')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
