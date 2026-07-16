'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  MessageCircle,
  PencilLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { formatDate, getHearingUrgency, urgencyColor, urgencyLabel } from '@/lib/utils'
import { buildWhatsAppCaseUpdateUrl, buildWhatsAppReminderUrl, maskPhone } from '@/lib/whatsapp-link'
import { useLanguage } from '@/components/LanguageProvider'
import CourtDayPlanner from '@/components/CourtDayPlanner'

interface ReminderLog {
  id: string
  status: string
  sent_at: string
  channel: string
  recipient_type: string
}

interface ClientRef {
  full_name: string
  phone: string
  consent_given: boolean
}

interface Hearing {
  id: string
  hearing_date: string
  hearing_time?: string
  hearing_purpose?: string
  outcome?: string
  next_date?: string
  reminder_sent_advocate: boolean
  reminder_sent_client: boolean
  reminder_logs?: ReminderLog[]
  cases: {
    id: string
    case_number: string
    case_title?: string
    court_name: string
    judge_name?: string
    notes?: string
    clients?: ClientRef
  }
}

interface Case {
  id: string
  case_number: string
  court_name: string
  judge_name?: string
  notes?: string
  clients?: ClientRef
}

type AppMode = 'loading' | 'guest' | 'authenticated'
type ManualReminderState = Record<string, { marked: boolean; sentAt?: string }>

const PURPOSES = ['Arguments', 'Evidence', 'Judgment', 'Mediation', 'Bail', 'Stay', 'Written Statement', 'Other']
const GUEST_CASES_STORAGE_KEY = 'vakil_guest_cases_v2'
const GUEST_HEARINGS_STORAGE_KEY = 'vakil_guest_hearings_v1'
const GUEST_REMINDERS_STORAGE_KEY = 'vakil_guest_reminders_v1'

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function hearingMonthKey(date: string) {
  return date.slice(0, 7)
}

function latestManualLog(hearing: Hearing) {
  return [...(hearing.reminder_logs ?? [])]
    .filter(log => log.channel === 'whatsapp' && log.recipient_type === 'client' && ['manual_sent', 'manual_case_update_sent'].includes(log.status))
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0]
}

function getCourtNumber(notes?: string) {
  if (!notes) return undefined
  try {
    const metadata = JSON.parse(notes) as { court_number?: unknown }
    const value = String(metadata.court_number || '').trim()
    return value || undefined
  } catch {
    return undefined
  }
}

export default function HearingsPage() {
  const { isHindi, tr } = useLanguage()
  const [hearings, setHearings] = useState<Hearing[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingReminder, setUpdatingReminder] = useState<string | null>(null)
  const [advocateId, setAdvocateId] = useState<string | null>(null)
  const [mode, setMode] = useState<AppMode>('loading')
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date())
  const [guestReminderState, setGuestReminderState] = useState<ManualReminderState>({})
  const [logHearing, setLogHearing] = useState<Hearing | null>(null)
  const [updateHearing, setUpdateHearing] = useState<Hearing | null>(null)
  const [savingCourtUpdate, setSavingCourtUpdate] = useState(false)
  const [shareAfterUpdate, setShareAfterUpdate] = useState<Hearing | null>(null)
  const [shareWhatsAppOpened, setShareWhatsAppOpened] = useState(false)

  const [form, setForm] = useState({
    case_id: '',
    hearing_date: '',
    hearing_time: '',
    hearing_purpose: 'Arguments',
  })
  const [courtUpdateForm, setCourtUpdateForm] = useState({
    hearing_purpose: 'Arguments',
    outcome: '',
    next_date: '',
  })

  function openCourtUpdate(hearing: Hearing) {
    setUpdateHearing(hearing)
    setCourtUpdateForm({
      hearing_purpose: hearing.hearing_purpose || 'Arguments',
      outcome: hearing.outcome || '',
      next_date: hearing.next_date || '',
    })
  }

  function queueClientUpdate(hearing: Hearing) {
    setShareWhatsAppOpened(false)
    setShareAfterUpdate(hearing)
  }

  const fetchData = useCallback(async (advId: string) => {
    const supabase = createClient()
    const [hearingsRes, casesRes] = await Promise.all([
      supabase.from('hearings')
        .select(`*, cases(id, case_number, case_title, court_name, judge_name, notes, clients(full_name, phone, consent_given)), reminder_logs(id, status, sent_at, channel, recipient_type)`)
        .eq('advocate_id', advId)
        .order('hearing_date', { ascending: false }),
      supabase.from('cases')
        .select('id, case_number, court_name, judge_name, notes, clients(full_name, phone, consent_given)')
        .eq('advocate_id', advId)
        .neq('status', 'Disposed'),
    ])

    if (!hearingsRes.error) setHearings((hearingsRes.data ?? []) as unknown as Hearing[])
    if (!casesRes.error) setCases((casesRes.data ?? []) as unknown as Case[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!user) {
        try {
          const storedCases = window.sessionStorage.getItem(GUEST_CASES_STORAGE_KEY)
          const storedHearings = window.sessionStorage.getItem(GUEST_HEARINGS_STORAGE_KEY)
          const storedReminders = window.sessionStorage.getItem(GUEST_REMINDERS_STORAGE_KEY)
          setCases(storedCases ? JSON.parse(storedCases) as Case[] : [])
          setHearings(storedHearings ? JSON.parse(storedHearings) as Hearing[] : [])
          setGuestReminderState(storedReminders ? JSON.parse(storedReminders) as ManualReminderState : {})
        } catch {
          setCases([])
          setHearings([])
          setGuestReminderState({})
        }
        setMode('guest')
        setLoading(false)
        return
      }
      const { data: adv } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
      if (adv) {
        setMode('authenticated')
        setAdvocateId(adv.id)
        fetchData(adv.id)
      } else {
        setMode('authenticated')
        setLoading(false)
      }
    }
    init()
  }, [fetchData])

  const getReminderStatus = useCallback((hearing: Hearing) => {
    if (mode === 'guest') {
      const saved = guestReminderState[hearing.id]
      return saved ?? {
        marked: hearing.reminder_sent_client,
        sentAt: hearing.reminder_sent_client
          ? new Date(`${hearing.hearing_date}T09:00:00`).toISOString()
          : undefined,
      }
    }
    const log = latestManualLog(hearing)
    return { marked: hearing.reminder_sent_client, sentAt: log?.sent_at }
  }, [guestReminderState, mode])

  async function handleAddHearing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submitted = new FormData(e.currentTarget)
    const submittedForm = {
      case_id: String(submitted.get('case_id') || form.case_id),
      hearing_date: String(submitted.get('hearing_date') || form.hearing_date),
      hearing_time: String(submitted.get('hearing_time') || form.hearing_time),
      hearing_purpose: String(submitted.get('hearing_purpose') || form.hearing_purpose),
    }
    if (!submittedForm.case_id || !submittedForm.hearing_date) {
      toast.error(tr('Case and hearing date are required', 'केस और सुनवाई की तारीख आवश्यक है'))
      return
    }

    if (mode === 'guest') {
      const selectedCase = cases.find(item => item.id === submittedForm.case_id)
      if (!selectedCase) return
      const hearing: Hearing = {
        id: `guest-hearing-${Date.now()}`,
        hearing_date: submittedForm.hearing_date,
        hearing_time: submittedForm.hearing_time || undefined,
        hearing_purpose: submittedForm.hearing_purpose,
        reminder_sent_advocate: false,
        reminder_sent_client: false,
        cases: selectedCase,
      }
      setHearings(previous => {
        const next = [hearing, ...previous]
        window.sessionStorage.setItem(GUEST_HEARINGS_STORAGE_KEY, JSON.stringify(next))
        return next
      })
      setSelectedMonth(new Date(`${submittedForm.hearing_date}T00:00:00`))
      setShowModal(false)
      setForm({ case_id: '', hearing_date: '', hearing_time: '', hearing_purpose: 'Arguments' })
      toast.success(tr('Demo hearing added successfully', 'डेमो सुनवाई सफलतापूर्वक जोड़ दी गई'))
      return
    }

    if (!advocateId) {
      toast.error(tr('Advocate profile was not found', 'अधिवक्ता प्रोफ़ाइल नहीं मिली'))
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('hearings').insert({
      case_id: submittedForm.case_id,
      advocate_id: advocateId,
      hearing_date: submittedForm.hearing_date,
      hearing_time: submittedForm.hearing_time || null,
      hearing_purpose: submittedForm.hearing_purpose,
    })
    if (error) {
      toast.error(`${tr('Hearing could not be saved', 'सुनवाई सहेजी नहीं जा सकी')}: ${error.message}`)
    } else {
      toast.success(tr('Hearing added successfully', 'सुनवाई सफलतापूर्वक जोड़ दी गई'))
      setShowModal(false)
      setForm({ case_id: '', hearing_date: '', hearing_time: '', hearing_purpose: 'Arguments' })
      fetchData(advocateId)
    }
    setSaving(false)
  }

  function openWhatsApp(hearing: Hearing) {
    const client = hearing.cases.clients
    if (!client?.phone) {
      toast.error(tr("The client's WhatsApp number has not been saved", 'मुवक्किल का WhatsApp नंबर सहेजा नहीं गया है'))
      return
    }
    if (!client.consent_given) {
      toast.error(tr("Save the client's WhatsApp consent first", 'पहले मुवक्किल की WhatsApp सहमति सहेजें'))
      return
    }
    window.open(buildWhatsAppReminderUrl({
      clientName: client.full_name,
      phone: client.phone,
      caseNumber: hearing.cases.case_number,
      courtName: hearing.cases.court_name,
      hearingDate: hearing.hearing_date,
      hearingTime: hearing.hearing_time,
      purpose: hearing.hearing_purpose,
    }), '_blank', 'noopener,noreferrer')
    toast.success(tr('WhatsApp opened. Select the checkbox after sending the message.', 'WhatsApp खुल गया है। संदेश भेजने के बाद चेकबॉक्स चुनें।'))
  }

  function openCaseUpdateWhatsApp(hearing: Hearing) {
    const client = hearing.cases.clients
    if (!client?.phone) {
      toast.error(tr("The client's WhatsApp number has not been saved", 'मुवक्किल का WhatsApp नंबर सहेजा नहीं गया है'))
      return
    }
    if (!client.consent_given) {
      toast.error(tr("Save the client's WhatsApp consent first", 'पहले मुवक्किल की WhatsApp सहमति सहेजें'))
      return
    }
    if (!hearing.outcome?.trim()) {
      toast.error(tr('Save the court update before notifying the client', 'मुवक्किल को सूचना देने से पहले कोर्ट अपडेट सहेजें'))
      return
    }

    window.open(buildWhatsAppCaseUpdateUrl({
      clientName: client.full_name,
      phone: client.phone,
      caseNumber: hearing.cases.case_number,
      courtName: hearing.cases.court_name,
      hearingDate: hearing.hearing_date,
      hearingPurpose: hearing.hearing_purpose,
      outcome: hearing.outcome,
      nextDate: hearing.next_date,
      language: isHindi ? 'hi' : 'en',
    }), '_blank', 'noopener,noreferrer')
    setShareWhatsAppOpened(true)
    toast.success(tr('The case update is ready in WhatsApp. Send it, then confirm below.', 'केस अपडेट WhatsApp में तैयार है। इसे भेजें और फिर नीचे पुष्टि करें।'))
  }

  async function setManualReminder(hearing: Hearing, marked: boolean, kind: 'reminder' | 'case_update' = 'reminder') {
    setUpdatingReminder(hearing.id)
    const sentAt = marked ? new Date().toISOString() : undefined

    if (mode === 'guest') {
      const next = { ...guestReminderState, [hearing.id]: { marked, sentAt } }
      setGuestReminderState(next)
      window.sessionStorage.setItem(GUEST_REMINDERS_STORAGE_KEY, JSON.stringify(next))
      toast.success(marked ? tr('Marked as sent on WhatsApp', 'WhatsApp पर भेजा गया चिह्नित किया') : tr('Removed the sent status', 'भेजे जाने की स्थिति हटा दी गई'))
      setUpdatingReminder(null)
      return
    }

    const supabase = createClient()
    const { error: updateError } = await supabase.from('hearings')
      .update({ reminder_sent_client: marked })
      .eq('id', hearing.id)

    let logError = null
    if (!updateError && marked) {
      const result = await supabase.from('reminder_logs').insert({
        hearing_id: hearing.id,
        recipient_type: 'client',
        phone: hearing.cases.clients?.phone ?? '',
        channel: 'whatsapp',
        status: kind === 'case_update' ? 'manual_case_update_sent' : 'manual_sent',
      })
      logError = result.error
    } else if (!updateError) {
      const result = await supabase.from('reminder_logs')
        .delete()
        .eq('hearing_id', hearing.id)
        .eq('recipient_type', 'client')
        .eq('channel', 'whatsapp')
        .in('status', ['manual_sent', 'manual_case_update_sent'])
      logError = result.error
    }

    if (updateError || logError) {
      toast.error(tr('WhatsApp status could not be saved', 'WhatsApp स्थिति सहेजी नहीं जा सकी'))
    } else if (advocateId) {
      toast.success(marked ? tr('Marked as sent on WhatsApp', 'WhatsApp पर भेजा गया चिह्नित किया') : tr('Removed the sent status', 'भेजे जाने की स्थिति हटा दी गई'))
      await fetchData(advocateId)
    }
    setUpdatingReminder(null)
  }

  async function confirmCaseUpdateSent() {
    if (!shareAfterUpdate) return
    await setManualReminder(shareAfterUpdate, true, 'case_update')
    setShareAfterUpdate(null)
    setShareWhatsAppOpened(false)
  }

  async function handleDelete(hearingId: string) {
    if (!confirm(tr('Delete this hearing?', 'यह सुनवाई हटाएँ?'))) return
    if (mode === 'guest') {
      setHearings(previous => {
        const next = previous.filter(hearing => hearing.id !== hearingId)
        window.sessionStorage.setItem(GUEST_HEARINGS_STORAGE_KEY, JSON.stringify(next))
        return next
      })
      toast.success(tr('Demo hearing deleted', 'डेमो सुनवाई हटा दी गई'))
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('hearings').delete().eq('id', hearingId)
    if (error) toast.error(tr('Hearing could not be deleted', 'सुनवाई हटाई नहीं जा सकी'))
    else {
      toast.success(tr('Hearing deleted successfully', 'सुनवाई सफलतापूर्वक हटा दी गई'))
      setHearings(previous => previous.filter(hearing => hearing.id !== hearingId))
    }
  }

  async function handleCourtUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submitted = new FormData(e.currentTarget)
    const submittedUpdate = {
      hearing_purpose: String(submitted.get('hearing_purpose') || courtUpdateForm.hearing_purpose),
      outcome: String(submitted.get('outcome') || courtUpdateForm.outcome).trim(),
      next_date: String(submitted.get('next_date') || courtUpdateForm.next_date),
    }
    if (!updateHearing || !submittedUpdate.outcome) {
      toast.error(tr('Please add a short order or hearing note', 'कृपया आदेश या सुनवाई का संक्षिप्त विवरण जोड़ें'))
      return
    }
    if (submittedUpdate.next_date && submittedUpdate.next_date <= updateHearing.hearing_date) {
      toast.error(tr('The next date must be after the current hearing date', 'अगली तारीख वर्तमान सुनवाई की तारीख के बाद होनी चाहिए'))
      return
    }

    setSavingCourtUpdate(true)
    const values = {
      hearing_purpose: submittedUpdate.hearing_purpose,
      outcome: submittedUpdate.outcome,
      next_date: submittedUpdate.next_date || null,
    }

    if (mode === 'guest') {
      const updatedHearing: Hearing = {
        ...updateHearing,
        ...values,
        next_date: values.next_date || undefined,
      }
      setHearings(previous => {
        const updated = previous.map(hearing => hearing.id === updateHearing.id ? updatedHearing : hearing)
        const next = !submittedUpdate.next_date || previous.some(hearing => hearing.cases.id === updateHearing.cases.id && hearing.hearing_date === submittedUpdate.next_date) ? updated : [{
          id: `guest-hearing-${Date.now()}`,
          hearing_date: submittedUpdate.next_date,
          hearing_purpose: submittedUpdate.hearing_purpose,
          reminder_sent_advocate: false,
          reminder_sent_client: false,
          cases: updateHearing.cases,
        }, ...updated]
        window.sessionStorage.setItem(GUEST_HEARINGS_STORAGE_KEY, JSON.stringify(next))
        return next
      })
      setUpdateHearing(null)
      queueClientUpdate(updatedHearing)
      setSavingCourtUpdate(false)
      toast.success(tr('Court update saved and next hearing added', 'कोर्ट अपडेट सहेजा गया और अगली सुनवाई जोड़ दी गई'))
      return
    }

    if (!advocateId) {
      setSavingCourtUpdate(false)
      toast.error(tr('Advocate profile was not found', 'अधिवक्ता प्रोफ़ाइल नहीं मिली'))
      return
    }

    const supabase = createClient()
    const { error: updateError } = await supabase.from('hearings').update(values).eq('id', updateHearing.id).eq('advocate_id', advocateId)
    let nextHearingError = null

    if (!updateError && submittedUpdate.next_date) {
      const { data: existing } = await supabase.from('hearings')
        .select('id')
        .eq('advocate_id', advocateId)
        .eq('case_id', updateHearing.cases.id)
        .eq('hearing_date', submittedUpdate.next_date)
        .maybeSingle()

      if (!existing) {
        const result = await supabase.from('hearings').insert({
          advocate_id: advocateId,
          case_id: updateHearing.cases.id,
          hearing_date: submittedUpdate.next_date,
          hearing_purpose: submittedUpdate.hearing_purpose,
        })
        nextHearingError = result.error
      }
    }

    if (updateError || nextHearingError) {
      toast.error(`${tr('Court update could not be saved', 'कोर्ट अपडेट सहेजा नहीं जा सका')}: ${(updateError || nextHearingError)?.message}`)
    } else {
      await fetchData(advocateId)
      queueClientUpdate({ ...updateHearing, ...values, next_date: values.next_date || undefined })
      setUpdateHearing(null)
      toast.success(submittedUpdate.next_date
        ? tr('Court update saved and next hearing added', 'कोर्ट अपडेट सहेजा गया और अगली सुनवाई जोड़ दी गई')
        : tr('Court update saved', 'कोर्ट अपडेट सहेजा गया'))
    }
    setSavingCourtUpdate(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const selectedMonthKey = monthKey(selectedMonth)
  const monthHearings = useMemo(
    () => hearings.filter(hearing => hearingMonthKey(hearing.hearing_date) === selectedMonthKey),
    [hearings, selectedMonthKey],
  )
  const courtPlanHearings = useMemo(() => hearings.map(hearing => ({
    id: hearing.id,
    hearing_date: hearing.hearing_date,
    hearing_time: hearing.hearing_time,
    hearing_purpose: hearing.hearing_purpose,
    caseNumber: hearing.cases.case_number,
    caseTitle: hearing.cases.case_title,
    courtName: hearing.cases.court_name,
    courtNumber: getCourtNumber(hearing.cases.notes),
    judgeName: hearing.cases.judge_name,
  })), [hearings])
  const filteredHearings = monthHearings.filter(hearing => {
    if (filter === 'upcoming') return hearing.hearing_date >= today
    if (filter === 'past') return hearing.hearing_date < today
    return true
  })
  const monthStats = {
    total: monthHearings.length,
    upcoming: monthHearings.filter(hearing => hearing.hearing_date >= today).length,
    past: monthHearings.filter(hearing => hearing.hearing_date < today).length,
    sent: monthHearings.filter(hearing => getReminderStatus(hearing).marked).length,
  }

  function changeMonth(offset: number) {
    setSelectedMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const logStatus = logHearing ? getReminderStatus(logHearing) : null

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">{tr('Case Dates', 'केस की तारीखें')}</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" />
          {tr('New Hearing', 'नई सुनवाई')}
        </button>
      </div>

      <CourtDayPlanner hearings={courtPlanHearings} onAddHearing={() => setShowModal(true)} />

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => changeMonth(-1)} aria-label={tr('Previous month', 'पिछला महीना')} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{tr('Monthly hearing summary', 'मासिक सुनवाई सारांश')}</p>
            <h2 className="font-bold text-gray-900">
              {selectedMonth.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <button onClick={() => changeMonth(1)} aria-label={tr('Next month', 'अगला महीना')} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: tr('Total Hearings', 'कुल सुनवाई'), value: monthStats.total, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
            { label: tr('Upcoming', 'आगामी'), value: monthStats.upcoming, icon: Clock3, color: 'text-orange-600 bg-orange-50' },
            { label: tr('Completed', 'पूर्ण'), value: monthStats.past, icon: CheckCircle2, color: 'text-gray-600 bg-gray-100' },
            { label: tr('WhatsApp Sent', 'WhatsApp भेजा गया'), value: monthStats.sent, icon: MessageCircle, color: 'text-green-600 bg-green-50' },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-gray-100 p-3">
              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${item.color}`}>
                <item.icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-gray-900">{item.value}</p>
              <p className="text-xs text-gray-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit max-w-full overflow-x-auto">
        {(['upcoming', 'all', 'past'] as const).map(value => (
          <button key={value} onClick={() => setFilter(value)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {value === 'upcoming' ? `⏳ ${tr('Upcoming', 'आगामी')}` : value === 'past' ? `✓ ${tr('Completed', 'पूर्ण')}` : `📋 ${tr('All', 'सभी')}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{tr('Loading...', 'लोड हो रहा है...')}</div>
      ) : filteredHearings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">{tr('No hearings match this filter for the selected month', 'चुने गए महीने में इस फ़िल्टर से कोई सुनवाई नहीं मिली')}</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-orange-500 text-sm hover:underline">+ {tr('Add a hearing', 'सुनवाई जोड़ें')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHearings.map(hearing => {
            const urgency = getHearingUrgency(hearing.hearing_date)
            const isPast = urgency === 'past'
            const client = hearing.cases?.clients
            const reminder = getReminderStatus(hearing)
            const canSend = Boolean(client?.phone && client.consent_given)

            return (
              <article key={hearing.id} className={`bg-white rounded-xl border shadow-sm p-4 sm:p-5 ${isPast ? 'border-gray-100' : 'border-gray-100 hover:shadow-md'} transition`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className={`text-center min-w-[52px] rounded-xl p-2 ${isPast ? 'bg-gray-100' : 'bg-blue-600'}`}>
                      <p className={`text-xl font-bold ${isPast ? 'text-gray-500' : 'text-white'}`}>{new Date(`${hearing.hearing_date}T00:00:00`).getDate()}</p>
                      <p className={`text-xs uppercase ${isPast ? 'text-gray-400' : 'text-blue-200'}`}>
                        {new Date(`${hearing.hearing_date}T00:00:00`).toLocaleDateString('en', { month: 'short' })}
                      </p>
                      <p className={`text-xs ${isPast ? 'text-gray-400' : 'text-blue-300'}`}>{new Date(`${hearing.hearing_date}T00:00:00`).getFullYear()}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{hearing.cases?.case_number}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${urgencyColor(urgency)}`}>{isHindi ? ({ today: 'आज', tomorrow: 'कल', soon: 'जल्द', upcoming: 'आगामी', past: 'पूर्ण' } as Record<string, string>)[urgency] || urgencyLabel(urgency) : urgencyLabel(urgency)}</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-0.5">{hearing.cases?.court_name}</p>
                      {hearing.hearing_purpose && <p className="text-gray-400 text-xs mt-0.5">📋 {hearing.hearing_purpose}</p>}
                      {hearing.hearing_time && <p className="text-gray-400 text-xs mt-0.5">⏰ {hearing.hearing_time}</p>}
                      {client && (
                        <p className="text-gray-400 text-xs mt-0.5">
                          👤 {client.full_name} • {maskPhone(client.phone)} {client.consent_given ? tr('• WhatsApp consent ✓', '• WhatsApp सहमति ✓') : tr('• Consent pending', '• सहमति लंबित')}
                        </p>
                      )}
                      {hearing.outcome && <div className="mt-2 bg-green-50 rounded-lg px-3 py-1.5 border border-green-100"><p className="text-xs text-green-700">→ {hearing.outcome}</p></div>}
                      {hearing.next_date && <p className="text-xs text-orange-500 mt-1">{tr('Next hearing', 'अगली सुनवाई')}: {formatDate(hearing.next_date)}</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 lg:min-w-[265px]">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={reminder.marked}
                          disabled={updatingReminder === hearing.id}
                          onChange={event => setManualReminder(hearing, event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        {tr('WhatsApp Notification', 'WhatsApp सूचना')}
                      </label>
                      <button onClick={() => handleDelete(hearing.id)} aria-label={tr('Delete hearing', 'सुनवाई हटाएँ')} className="p-1.5 text-gray-300 hover:text-red-500 transition rounded-lg hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">{tr('Select this after sending the message.', 'संदेश भेजने के बाद इसे चुनें।')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => openCourtUpdate(hearing)}
                        className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                        <PencilLine className="h-3.5 w-3.5" /> {tr('Update from Court', 'कोर्ट से अपडेट करें')}
                      </button>
                      <button
                        onClick={() => hearing.outcome ? queueClientUpdate(hearing) : openWhatsApp(hearing)}
                        disabled={!canSend}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                        <MessageCircle className="h-3.5 w-3.5" /> {hearing.outcome ? tr('Send Case Update', 'केस अपडेट भेजें') : tr('Send Reminder', 'रिमाइंडर भेजें')}
                      </button>
                      {reminder.marked && (
                        <button onClick={() => setLogHearing(hearing)} className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100">
                          <FileClock className="h-3.5 w-3.5" /> {tr('WhatsApp Log', 'WhatsApp विवरण')}
                        </button>
                      )}
                    </div>
                    {!canSend && <p className="mt-2 text-[11px] text-orange-600">{tr('A client number and consent are required.', 'मुवक्किल का नंबर और सहमति आवश्यक है।')}</p>}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{tr('Add New Hearing', 'नई सुनवाई जोड़ें')}</h2>
              <button onClick={() => setShowModal(false)} aria-label={tr('Close', 'बंद करें')} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAddHearing} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Select Case', 'केस चुनें')} *</label>
                <select name="case_id" value={form.case_id} onChange={event => setForm(current => ({ ...current, case_id: event.target.value }))} required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                  <option value="">— {tr('Select a case', 'केस चुनें')} —</option>
                  {cases.map(item => <option key={item.id} value={item.id}>{item.case_number} — {item.court_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Hearing Date', 'सुनवाई की तारीख')} *</label>
                <input name="hearing_date" type="date" value={form.hearing_date} onChange={event => setForm(current => ({ ...current, hearing_date: event.target.value }))} required min={today} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Time (Optional)', 'समय (वैकल्पिक)')}</label>
                <input name="hearing_time" type="time" value={form.hearing_time} onChange={event => setForm(current => ({ ...current, hearing_time: event.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tr('Hearing Stage / Purpose', 'सुनवाई का चरण / उद्देश्य')}</label>
                <select name="hearing_purpose" value={form.hearing_purpose} onChange={event => setForm(current => ({ ...current, hearing_purpose: event.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                  {PURPOSES.map(purpose => <option key={purpose} value={purpose}>{isHindi ? ({ Arguments: 'बहस', Evidence: 'साक्ष्य', Judgment: 'निर्णय', Mediation: 'मध्यस्थता', Bail: 'जमानत', Stay: 'स्थगन', 'Written Statement': 'लिखित बयान', Other: 'अन्य' } as Record<string, string>)[purpose] : purpose}</option>)}
                </select>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-700">{tr('The free version does not send reminders automatically. Use “Send Now” to open WhatsApp, then select the sent checkbox after sending the message.', 'मुफ़्त संस्करण अपने-आप रिमाइंडर नहीं भेजता। WhatsApp खोलने के लिए “अभी भेजें” दबाएँ और संदेश भेजने के बाद भेजे गए चेकबॉक्स को चुनें।')}</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">{tr('Cancel', 'रद्द करें')}</button>
                <button type="submit" disabled={saving} className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-60 transition text-sm">
                  {saving ? tr('Saving...', 'सहेजा जा रहा है...') : tr('Save Hearing', 'सुनवाई सहेजें')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {updateHearing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setUpdateHearing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="border-b border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tr('Quick court update', 'त्वरित कोर्ट अपडेट')}</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">{updateHearing.cases.case_number}</h2>
              <p className="mt-1 text-xs text-gray-500">{tr('Record what happened today and add the next date before leaving court.', 'आज क्या हुआ दर्ज करें और कोर्ट से निकलने से पहले अगली तारीख जोड़ें।')}</p>
            </div>
            <form onSubmit={handleCourtUpdate} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Updated Stage', 'अपडेट किया गया चरण')}</label>
                <select name="hearing_purpose" value={courtUpdateForm.hearing_purpose} onChange={event => setCourtUpdateForm(current => ({ ...current, hearing_purpose: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500">
                  {PURPOSES.map(purpose => <option key={purpose} value={purpose}>{purpose}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Short Order / Hearing Note', 'संक्षिप्त आदेश / सुनवाई नोट')} *</label>
                <textarea name="outcome" value={courtUpdateForm.outcome} onChange={event => setCourtUpdateForm(current => ({ ...current, outcome: event.target.value }))} required rows={4} maxLength={1000} placeholder={tr('Example: Arguments heard; reply to be filed before next date.', 'उदाहरण: बहस सुनी गई; अगली तारीख से पहले जवाब दाखिल करना है।')} className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500" />
                <p className="mt-1 text-right text-[11px] text-gray-400">{courtUpdateForm.outcome.length}/1000</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{tr('Next Hearing Date (Optional)', 'अगली सुनवाई की तारीख (वैकल्पिक)')}</label>
                <input name="next_date" type="date" min={updateHearing.hearing_date} value={courtUpdateForm.next_date} onChange={event => setCourtUpdateForm(current => ({ ...current, next_date: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500" />
                <p className="mt-1 text-[11px] text-gray-400">{tr('When provided, this case is automatically added to the upcoming cause list.', 'तारीख भरने पर यह केस आगामी कॉज लिस्ट में अपने-आप जुड़ जाएगा।')}</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setUpdateHearing(null)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">{tr('Cancel', 'रद्द करें')}</button>
                <button type="submit" disabled={savingCourtUpdate} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{savingCourtUpdate ? tr('Saving...', 'सहेजा जा रहा है...') : tr('Save Update', 'अपडेट सहेजें')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {shareAfterUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShareAfterUpdate(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 text-white">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20"><MessageCircle className="h-5 w-5" /></div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-green-50">{tr('Court update saved', 'कोर्ट अपडेट सहेजा गया')}</p>
              <h2 className="mt-1 text-xl font-bold">{tr('Client Update Ready', 'मुवक्किल अपडेट तैयार है')}</h2>
              <p className="mt-1 text-sm text-green-50">{tr('A clear WhatsApp message has been prepared from today’s hearing note.', 'आज की सुनवाई के नोट से एक स्पष्ट WhatsApp संदेश तैयार किया गया है।')}</p>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-400">{tr('Case', 'केस')}</p><p className="font-semibold text-gray-900">{shareAfterUpdate.cases.case_number}</p></div>
                  <div><p className="text-xs text-gray-400">{tr('Client', 'मुवक्किल')}</p><p className="font-semibold text-gray-900">{shareAfterUpdate.cases.clients?.full_name || tr('Not linked', 'लिंक नहीं है')}</p></div>
                </div>
                <div className="mt-3 border-t border-gray-200 pt-3"><p className="text-xs text-gray-400">{tr('What happened', 'क्या हुआ')}</p><p className="mt-1 text-gray-700">{shareAfterUpdate.outcome}</p></div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
                  <div><p className="text-xs text-gray-400">{tr('WhatsApp number', 'WhatsApp नंबर')}</p><p className="font-medium text-gray-700">{maskPhone(shareAfterUpdate.cases.clients?.phone ?? '') || '—'}</p></div>
                  <div className="text-right"><p className="text-xs text-gray-400">{tr('Next hearing', 'अगली सुनवाई')}</p><p className="font-medium text-gray-700">{shareAfterUpdate.next_date ? formatDate(shareAfterUpdate.next_date) : tr('Not fixed', 'तय नहीं हुई')}</p></div>
                </div>
              </div>
              {shareAfterUpdate.cases.clients?.phone && shareAfterUpdate.cases.clients?.consent_given ? (
                <>
                  <button onClick={() => openCaseUpdateWhatsApp(shareAfterUpdate)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700"><MessageCircle className="h-4 w-4" /> {tr('Open WhatsApp with Message', 'संदेश के साथ WhatsApp खोलें')}</button>
                  <button onClick={confirmCaseUpdateSent} disabled={!shareWhatsAppOpened || updatingReminder === shareAfterUpdate.id} className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-3 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"><CheckCircle2 className="h-4 w-4" /> {tr('I Sent This Update', 'मैंने यह अपडेट भेज दिया')}</button>
                  {!shareWhatsAppOpened && <p className="text-center text-xs text-gray-400">{tr('Open WhatsApp first. Confirm only after you actually send the message.', 'पहले WhatsApp खोलें। संदेश भेजने के बाद ही पुष्टि करें।')}</p>}
                </>
              ) : (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">{tr('Add the client’s mobile number and WhatsApp consent before sending an update.', 'अपडेट भेजने से पहले मुवक्किल का मोबाइल नंबर और WhatsApp सहमति जोड़ें।')}</div>
              )}
              <button onClick={() => setShareAfterUpdate(null)} className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-700">{tr('Send later', 'बाद में भेजें')}</button>
              <p className="text-center text-[11px] text-gray-400">{tr('Free workflow: the app prepares the message; the advocate sends it through WhatsApp.', 'मुफ्त प्रक्रिया: ऐप संदेश तैयार करता है; अधिवक्ता उसे WhatsApp से भेजता है।')}</p>
            </div>
          </div>
        </div>
      )}

      {logHearing && logStatus && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setLogHearing(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700"><Bell className="h-5 w-5" /></div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">{tr('WhatsApp Summary', 'WhatsApp सारांश')}</h2>
            <div className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div><p className="text-xs text-gray-400">{tr('Case', 'केस')}</p><p className="font-medium text-gray-800">{logHearing.cases.case_number}</p></div>
              <div><p className="text-xs text-gray-400">{tr('Client', 'मुवक्किल')}</p><p className="font-medium text-gray-800">{logHearing.cases.clients?.full_name} • {maskPhone(logHearing.cases.clients?.phone ?? '')}</p></div>
              <div><p className="text-xs text-gray-400">{tr('Marked sent at', 'भेजे जाने का समय')}</p><p className="font-medium text-gray-800">{logStatus.sentAt ? new Date(logStatus.sentAt).toLocaleString(isHindi ? 'hi-IN' : 'en-IN') : tr('Time unavailable', 'समय उपलब्ध नहीं')}</p></div>
              <div><p className="text-xs text-gray-400">{tr('Status', 'स्थिति')}</p><p className="font-medium text-green-700">{tr('Manually marked as sent', 'हाथ से भेजा गया चिह्नित किया')}</p></div>
            </div>
            <p className="mt-3 text-xs text-gray-500">{tr("This is the advocate's manual confirmation. WhatsApp delivery or read status has not been verified.", 'यह अधिवक्ता की हाथ से की गई पुष्टि है। WhatsApp डिलीवरी या पढ़े जाने की स्थिति सत्यापित नहीं हुई है।')}</p>
            <button onClick={() => setLogHearing(null)} className="mt-5 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">{tr('Close', 'बंद करें')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
