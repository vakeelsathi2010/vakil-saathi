'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar, Bell, BellOff, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_CASE_OPTIONS, DEMO_HEARINGS } from '@/lib/demo-data'
import { useLanguage } from '@/components/LanguageProvider'
import toast from 'react-hot-toast'
import { formatDate, getHearingUrgency, urgencyColor, urgencyLabel } from '@/lib/utils'

interface Hearing {
  id: string
  hearing_date: string
  hearing_time?: string
  hearing_purpose?: string
  outcome?: string
  next_date?: string
  reminder_sent_advocate: boolean
  reminder_sent_client: boolean
  cases: {
    id: string
    case_number: string
    case_title?: string
    court_name: string
    clients?: { full_name: string; phone: string; consent_given: boolean }
  }
}

interface Case {
  id: string
  case_number: string
  court_name: string
  clients?: { full_name: string; phone: string }
}

const PURPOSES = ['Arguments', 'Evidence', 'Judgment', 'Mediation', 'Bail', 'Stay', 'Written Statement', 'Other']

export default function HearingsPage() {
  const { isHindi } = useLanguage()
  const [hearings, setHearings] = useState<Hearing[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [advocateId, setAdvocateId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming')

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
        .select(`*, cases(id, case_number, case_title, court_name, clients(full_name, phone, consent_given))`)
        .eq('advocate_id', advId)
        .order('hearing_date', { ascending: false }),
      supabase.from('cases')
        .select('id, case_number, court_name, clients(full_name, phone)')
        .eq('advocate_id', advId)
        .eq('status', 'Active'),
    ])

    if (!hearingsRes.error) setHearings(hearingsRes.data ?? [])
    if (!casesRes.error) setCases((casesRes.data ?? []) as unknown as Case[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setHearings(DEMO_HEARINGS)
        setCases(DEMO_CASE_OPTIONS)
        setLoading(false)
        return
      }
      const { data: adv } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
      if (adv) { setAdvocateId(adv.id); fetchData(adv.id) }
    }
    init()
  }, [fetchData])

  async function handleAddHearing(e: React.FormEvent) {
    e.preventDefault()
    if (!advocateId || !form.case_id || !form.hearing_date) {
      toast.error('Case aur date zaruri hain')
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
      toast.error('Peshi save nahi hui: ' + error.message)
    } else {
      toast.success('Peshi add ho gayi! ✅')
      setShowModal(false)
      setForm({ case_id: '', hearing_date: '', hearing_time: '', hearing_purpose: 'Arguments' })
      fetchData(advocateId)
    }
    setSaving(false)
  }

  async function sendReminder(hearing: Hearing) {
    setSendingReminder(hearing.id)
    try {
      const res = await fetch('/api/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hearing_id: hearing.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Reminder bhej diya! 📱')
        fetchData(advocateId!)
      } else {
        toast.error('Reminder nahi gaya: ' + (data.error ?? 'Unknown error'))
      }
    } catch {
      toast.error('Network error — try again')
    }
    setSendingReminder(null)
  }

  async function handleDelete(hearingId: string) {
    if (!confirm('Ye peshi delete karna chahte hain?')) return
    const supabase = createClient()
    const { error } = await supabase.from('hearings').delete().eq('id', hearingId)
    if (error) toast.error('Delete nahi hua')
    else {
      toast.success('Peshi delete ho gayi')
      setHearings(prev => prev.filter(h => h.id !== hearingId))
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const filteredHearings = hearings.filter(h => {
    if (filter === 'upcoming') return h.hearing_date >= today
    if (filter === 'past') return h.hearing_date < today
    return true
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{isHindi ? 'पेशी की तारीखें' : 'Hearing Dates'}</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" />
          Nai Peshi
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        {(['upcoming', 'all', 'past'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {f === 'upcoming' ? '⏳ Aane Wali' : f === 'past' ? '✓ Ho Gayi' : '📋 Sabhi'}
          </button>
        ))}
      </div>

      {/* Hearings List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filteredHearings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Koi peshi nahi mili</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-orange-500 text-sm hover:underline">
            + Pehli peshi daalo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHearings.map(h => {
            const urgency = getHearingUrgency(h.hearing_date)
            const isPast = urgency === 'past'
            const client = h.cases?.clients

            return (
              <div key={h.id}
                className={`bg-white rounded-xl border shadow-sm p-5 ${isPast ? 'opacity-70 border-gray-100' : 'border-gray-100 hover:shadow-md'} transition`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Date Box */}
                    <div className={`text-center min-w-[52px] rounded-xl p-2 ${isPast ? 'bg-gray-100' : 'bg-blue-600'}`}>
                      <p className={`text-xl font-bold ${isPast ? 'text-gray-500' : 'text-white'}`}>
                        {new Date(h.hearing_date).getDate()}
                      </p>
                      <p className={`text-xs uppercase ${isPast ? 'text-gray-400' : 'text-blue-200'}`}>
                        {new Date(h.hearing_date).toLocaleDateString('en', { month: 'short' })}
                      </p>
                      <p className={`text-xs ${isPast ? 'text-gray-400' : 'text-blue-300'}`}>
                        {new Date(h.hearing_date).getFullYear()}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{h.cases?.case_number}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${urgencyColor(urgency)}`}>
                          {urgencyLabel(urgency)}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm mt-0.5">{h.cases?.court_name}</p>
                      {h.hearing_purpose && (
                        <p className="text-gray-400 text-xs mt-0.5">📋 {h.hearing_purpose}</p>
                      )}
                      {h.hearing_time && (
                        <p className="text-gray-400 text-xs mt-0.5">⏰ {h.hearing_time}</p>
                      )}
                      {client && (
                        <p className="text-gray-400 text-xs mt-0.5">
                          👤 {client.full_name} • {client.phone}
                          {client.consent_given && ' ✓'}
                        </p>
                      )}
                      {h.outcome && (
                        <div className="mt-2 bg-green-50 rounded-lg px-3 py-1.5 border border-green-100">
                          <p className="text-xs text-green-700">→ {h.outcome}</p>
                        </div>
                      )}
                      {h.next_date && (
                        <p className="text-xs text-orange-500 mt-1">
                          Next peshi: {formatDate(h.next_date)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {!isPast && (
                      <button
                        onClick={() => sendReminder(h)}
                        disabled={sendingReminder === h.id}
                        title="Reminder bhejo"
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                          h.reminder_sent_advocate
                            ? 'bg-green-50 text-green-600 border border-green-200'
                            : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                        }`}>
                        {sendingReminder === h.id ? (
                          <span>Bhej raha...</span>
                        ) : h.reminder_sent_advocate ? (
                          <><Bell className="w-3 h-3" />Bheja</>
                        ) : (
                          <><BellOff className="w-3 h-3" />Reminder</>
                        )}
                      </button>
                    )}
                    <button onClick={() => handleDelete(h.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Hearing Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nai Peshi Add Karein</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAddHearing} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Select Karein *</label>
                <select value={form.case_id} onChange={e => setForm(f => ({ ...f, case_id: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                  <option value="">— Case chunein —</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.case_number} — {c.court_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peshi Ki Tarikh *</label>
                <input type="date" value={form.hearing_date} onChange={e => setForm(f => ({ ...f, hearing_date: e.target.value }))}
                  required min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Samay (Optional)</label>
                <input type="time" value={form.hearing_time} onChange={e => setForm(f => ({ ...f, hearing_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peshi Ka Maqsad</label>
                <select value={form.hearing_purpose} onChange={e => setForm(f => ({ ...f, hearing_purpose: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                  {PURPOSES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                <p className="text-xs text-orange-700">
                  💡 Kal is peshi se ek din pehle, aap aur client (agar consent diya) dono ko automatic WhatsApp + SMS reminder jaayega.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-60 transition text-sm">
                  {saving ? 'Save ho raha hai...' : 'Peshi Save Karein 📅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
