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
  Plus,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import toast from 'react-hot-toast'
import { formatDate, getHearingUrgency, urgencyColor, urgencyLabel } from '@/lib/utils'
import { buildWhatsAppReminderUrl, maskPhone } from '@/lib/whatsapp-link'

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
    clients?: ClientRef
  }
}

interface Case {
  id: string
  case_number: string
  court_name: string
  clients?: ClientRef
}

type AppMode = 'loading' | 'guest' | 'authenticated'
type ManualReminderState = Record<string, { marked: boolean; sentAt?: string }>

const PURPOSES = ['Arguments', 'Evidence', 'Judgment', 'Mediation', 'Bail', 'Stay', 'Written Statement', 'Other']

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function hearingMonthKey(date: string) {
  return date.slice(0, 7)
}

function latestManualLog(hearing: Hearing) {
  return [...(hearing.reminder_logs ?? [])]
    .filter(log => log.channel === 'whatsapp' && log.recipient_type === 'client' && log.status === 'manual_sent')
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0]
}

export default function HearingsPage() {
  const { isHindi } = useLanguage()
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

  const [form, setForm] = useState({
    case_id: '',
    hearing_date: '',
    hearing_time: '',
    hearing_purpose: 'Arguments',
  })

  const fetchData = useCallback(async (advId: string) => {
    const supabase = createClient()
    const [hearingsRes, casesRes] = await Promise.all([
      supabase.from('hearings')
        .select(`*, cases(id, case_number, case_title, court_name, clients(full_name, phone, consent_given)), reminder_logs(id, status, sent_at, channel, recipient_type)`)
        .eq('advocate_id', advId)
        .order('hearing_date', { ascending: false }),
      supabase.from('cases')
        .select('id, case_number, court_name, clients(full_name, phone, consent_given)')
        .eq('advocate_id', advId)
        .eq('status', 'Active'),
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
        setGuestReminderState({})
        setMode('guest')
        setHearings([])
        setCases([])
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

  async function handleAddHearing(e: React.FormEvent) {
    e.preventDefault()
    if (!form.case_id || !form.hearing_date) {
      toast.error('Case aur date zaruri hain')
      return
    }

    if (mode === 'guest') {
      const selectedCase = cases.find(item => item.id === form.case_id)
      if (!selectedCase) return
      const hearing: Hearing = {
        id: `guest-hearing-${Date.now()}`,
        hearing_date: form.hearing_date,
        hearing_time: form.hearing_time || undefined,
        hearing_purpose: form.hearing_purpose,
        reminder_sent_advocate: false,
        reminder_sent_client: false,
        cases: selectedCase,
      }
      setHearings(previous => [hearing, ...previous])
      setSelectedMonth(new Date(`${form.hearing_date}T00:00:00`))
      setShowModal(false)
      setForm({ case_id: '', hearing_date: '', hearing_time: '', hearing_purpose: 'Arguments' })
      toast.success('Demo peshi add ho gayi')
      return
    }

    if (!advocateId) {
      toast.error('Advocate profile nahi mila')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('hearings').insert({
      case_id: form.case_id,
      advocate_id: advocateId,
      hearing_date: form.hearing_date,
      hearing_time: form.hearing_time || null,
      hearing_purpose: form.hearing_purpose,
    })
    if (error) {
      toast.error(`Peshi save nahi hui: ${error.message}`)
    } else {
      toast.success('Peshi add ho gayi')
      setShowModal(false)
      setForm({ case_id: '', hearing_date: '', hearing_time: '', hearing_purpose: 'Arguments' })
      fetchData(advocateId)
    }
    setSaving(false)
  }

  function openWhatsApp(hearing: Hearing) {
    const client = hearing.cases.clients
    if (!client?.phone) {
      toast.error('Client ka WhatsApp number save nahi hai')
      return
    }
    if (!client.consent_given) {
      toast.error('Pehle client ka WhatsApp consent save karein')
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
    toast.success('WhatsApp khul gaya. Message bhejne ke baad checkbox tick karein.')
  }

  async function setManualReminder(hearing: Hearing, marked: boolean) {
    setUpdatingReminder(hearing.id)
    const sentAt = marked ? new Date().toISOString() : undefined

    if (mode === 'guest') {
      const next = { ...guestReminderState, [hearing.id]: { marked, sentAt } }
      setGuestReminderState(next)
      toast.success(marked ? 'WhatsApp sent mark kar diya' : 'Sent mark hata diya')
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
        status: 'manual_sent',
      })
      logError = result.error
    } else if (!updateError) {
      const result = await supabase.from('reminder_logs')
        .delete()
        .eq('hearing_id', hearing.id)
        .eq('recipient_type', 'client')
        .eq('channel', 'whatsapp')
        .eq('status', 'manual_sent')
      logError = result.error
    }

    if (updateError || logError) {
      toast.error('WhatsApp status save nahi hua')
    } else if (advocateId) {
      toast.success(marked ? 'WhatsApp sent mark kar diya' : 'Sent mark hata diya')
      await fetchData(advocateId)
    }
    setUpdatingReminder(null)
  }

  async function handleDelete(hearingId: string) {
    if (!confirm('Ye peshi delete karna chahte hain?')) return
    if (mode === 'guest') {
      setHearings(previous => previous.filter(hearing => hearing.id !== hearingId))
      toast.success('Demo peshi delete ho gayi')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('hearings').delete().eq('id', hearingId)
    if (error) toast.error('Delete nahi hua')
    else {
      toast.success('Peshi delete ho gayi')
      setHearings(previous => previous.filter(hearing => hearing.id !== hearingId))
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const selectedMonthKey = monthKey(selectedMonth)
  const monthHearings = useMemo(
    () => hearings.filter(hearing => hearingMonthKey(hearing.hearing_date) === selectedMonthKey),
    [hearings, selectedMonthKey],
  )
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
        <h1 className="text-xl font-bold text-gray-900">{isHindi ? 'पेशी की तारीखें' : 'Hearing Dates'}</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" />
          Nai Peshi
        </button>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => changeMonth(-1)} aria-label="Previous month" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Monthly hearing summary</p>
            <h2 className="font-bold text-gray-900">
              {selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <button onClick={() => changeMonth(1)} aria-label="Next month" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Total Hearings', value: monthStats.total, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
            { label: 'Upcoming', value: monthStats.upcoming, icon: Clock3, color: 'text-orange-600 bg-orange-50' },
            { label: 'Completed', value: monthStats.past, icon: CheckCircle2, color: 'text-gray-600 bg-gray-100' },
            { label: 'WhatsApp Sent', value: monthStats.sent, icon: MessageCircle, color: 'text-green-600 bg-green-50' },
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
            {value === 'upcoming' ? '⏳ Aane Wali' : value === 'past' ? '✓ Ho Gayi' : '📋 Sabhi'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filteredHearings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Is month mein is filter ki koi peshi nahi hai</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-orange-500 text-sm hover:underline">+ Nai peshi daalo</button>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${urgencyColor(urgency)}`}>{urgencyLabel(urgency)}</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-0.5">{hearing.cases?.court_name}</p>
                      {hearing.hearing_purpose && <p className="text-gray-400 text-xs mt-0.5">📋 {hearing.hearing_purpose}</p>}
                      {hearing.hearing_time && <p className="text-gray-400 text-xs mt-0.5">⏰ {hearing.hearing_time}</p>}
                      {client && (
                        <p className="text-gray-400 text-xs mt-0.5">
                          👤 {client.full_name} • {maskPhone(client.phone)} {client.consent_given ? '• WhatsApp consent ✓' : '• Consent pending'}
                        </p>
                      )}
                      {hearing.outcome && <div className="mt-2 bg-green-50 rounded-lg px-3 py-1.5 border border-green-100"><p className="text-xs text-green-700">→ {hearing.outcome}</p></div>}
                      {hearing.next_date && <p className="text-xs text-orange-500 mt-1">Next peshi: {formatDate(hearing.next_date)}</p>}
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
                        WhatsApp Notification
                      </label>
                      <button onClick={() => handleDelete(hearing.id)} aria-label="Delete hearing" className="p-1.5 text-gray-300 hover:text-red-500 transition rounded-lg hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">Message bhejne ke baad khud tick karein.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => openWhatsApp(hearing)}
                        disabled={!canSend}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                        <MessageCircle className="h-3.5 w-3.5" /> Send Now
                      </button>
                      {reminder.marked && (
                        <button onClick={() => setLogHearing(hearing)} className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100">
                          <FileClock className="h-3.5 w-3.5" /> WhatsApp Log
                        </button>
                      )}
                    </div>
                    {!canSend && <p className="mt-2 text-[11px] text-orange-600">Client number aur consent zaruri hai.</p>}
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
              <h2 className="text-lg font-bold text-gray-900">Nai Peshi Add Karein</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAddHearing} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Select Karein *</label>
                <select value={form.case_id} onChange={event => setForm(current => ({ ...current, case_id: event.target.value }))} required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                  <option value="">— Case chunein —</option>
                  {cases.map(item => <option key={item.id} value={item.id}>{item.case_number} — {item.court_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peshi Ki Tarikh *</label>
                <input type="date" value={form.hearing_date} onChange={event => setForm(current => ({ ...current, hearing_date: event.target.value }))} required min={today} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Samay (Optional)</label>
                <input type="time" value={form.hearing_time} onChange={event => setForm(current => ({ ...current, hearing_time: event.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peshi Ka Maqsad</label>
                <select value={form.hearing_purpose} onChange={event => setForm(current => ({ ...current, hearing_purpose: event.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                  {PURPOSES.map(purpose => <option key={purpose}>{purpose}</option>)}
                </select>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-700">Free mode mein reminder automatic nahi jayega. Hearing card par “Send Now” se WhatsApp khulega; message bhejne ke baad sent checkbox tick karein.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-60 transition text-sm">
                  {saving ? 'Save ho raha hai...' : 'Peshi Save Karein'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {logHearing && logStatus && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setLogHearing(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700"><Bell className="h-5 w-5" /></div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">WhatsApp Summary</h2>
            <div className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div><p className="text-xs text-gray-400">Case</p><p className="font-medium text-gray-800">{logHearing.cases.case_number}</p></div>
              <div><p className="text-xs text-gray-400">Client</p><p className="font-medium text-gray-800">{logHearing.cases.clients?.full_name} • {maskPhone(logHearing.cases.clients?.phone ?? '')}</p></div>
              <div><p className="text-xs text-gray-400">Marked sent at</p><p className="font-medium text-gray-800">{logStatus.sentAt ? new Date(logStatus.sentAt).toLocaleString('en-IN') : 'Time unavailable'}</p></div>
              <div><p className="text-xs text-gray-400">Status</p><p className="font-medium text-green-700">Manually marked as sent</p></div>
            </div>
            <p className="mt-3 text-xs text-gray-500">Yeh advocate ki manual confirmation hai. WhatsApp delivery/read status verify nahi kiya gaya.</p>
            <button onClick={() => setLogHearing(null)} className="mt-5 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
