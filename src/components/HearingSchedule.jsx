'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, Gavel, MapPin, Pencil, RefreshCw, Route, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'

function indiaDateKey(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function notes(value) { try { return value ? JSON.parse(value) : {} } catch { return {} } }
function mapsUrl(courtName) { return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(courtName || 'Court')}` }

/** Uses Google Maps Distance Matrix when the optional Maps JS SDK is configured. */
export function calculateTravelTime(origin, destination, fallbackMinutes = 20) {
  return new Promise(resolve => {
    if (!origin || !destination || !window.google?.maps?.DistanceMatrixService) { resolve(fallbackMinutes); return }
    new window.google.maps.DistanceMatrixService().getDistanceMatrix({ origins: [origin], destinations: [destination], travelMode: 'DRIVING', unitSystem: window.google.maps.UnitSystem.METRIC }, (response, status) => {
      const seconds = response?.rows?.[0]?.elements?.[0]?.duration?.value
      resolve(status === 'OK' && seconds ? Math.max(1, Math.round(seconds / 60)) : fallbackMinutes)
    })
  })
}

export default function HearingSchedule({ homeLocation = '' }) {
  const { tr } = useLanguage()
  const [day, setDay] = useState('today')
  const [hearings, setHearings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [travel, setTravel] = useState({})
  const [mapsReady, setMapsReady] = useState(false)
  const [openJudge, setOpenJudge] = useState('')
  const selectedDate = day === 'today' ? indiaDateKey(0) : indiaDateKey(1)

  const loadHearings = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setHearings([]); return }
      const { data: advocate, error: advocateError } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
      if (advocateError || !advocate) throw new Error('Advocate profile was not found')
      const { data, error: hearingError } = await supabase
        .from('hearings')
        .select('id, hearing_date, hearing_time, hearing_purpose, outcome, cases(id, case_number, case_title, court_name, judge_name, case_type, notes, clients(full_name))')
        .eq('advocate_id', advocate.id).eq('hearing_date', selectedDate).order('hearing_time')
      if (hearingError) throw hearingError
      setHearings(data || [])
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Schedule load nahi ho paya') } finally { setLoading(false) }
  }, [selectedDate])

  useEffect(() => {
    // This effect intentionally fetches the selected day's hearing records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHearings()
  }, [loadHearings])

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key || window.google?.maps) return undefined
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`
    script.async = true
    script.onload = () => setMapsReady(true)
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [])

  useEffect(() => {
    let active = true
    async function calculate() {
      const next = {}
      for (let index = 0; index < hearings.length; index += 1) {
        const item = hearings[index]
        const caseData = item.cases || {}
        const meta = notes(caseData.notes)
        const priorCourt = index ? hearings[index - 1].cases?.court_name : homeLocation
        const fallback = Number(index ? meta.travel_minutes_from_previous : meta.travel_minutes_from_home) || (index ? 20 : 15)
        next[item.id] = await calculateTravelTime(priorCourt, caseData.court_name, fallback)
      }
      if (active) setTravel(next)
    }
    calculate()
    return () => { active = false }
  }, [hearings, homeLocation, mapsReady])

  useEffect(() => {
    const supabase = createClient()
    let channel
    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
      if (!advocate) return
      channel = supabase.channel(`daily-hearings-${advocate.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'hearings', filter: `advocate_id=eq.${advocate.id}` }, loadHearings).subscribe()
    }
    subscribe()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [loadHearings])

  async function markDone(item) {
    const supabase = createClient()
    const { error: updateError } = await supabase.from('hearings').update({ outcome: 'Attended' }).eq('id', item.id)
    if (updateError) { toast.error(updateError.message); return }
    toast.success('Hearing marked attended'); loadHearings()
  }

  async function editTime(item) {
    const value = window.prompt('Enter new time (HH:MM)', item.hearing_time?.slice(0, 5) || '')
    if (!value) return
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) { toast.error('Use time format HH:MM'); return }
    const supabase = createClient(); const { error: updateError } = await supabase.from('hearings').update({ hearing_time: `${value}:00` }).eq('id', item.id)
    if (updateError) { toast.error(updateError.message); return }
    toast.success('Hearing time updated'); loadHearings()
  }

  const dateLabel = useMemo(() => new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), [selectedDate])
  if (loading) return <div className="space-y-4"><div className="h-20 animate-pulse rounded-2xl bg-gray-100" />{[1, 2].map(item => <div key={item} className="h-48 animate-pulse rounded-2xl bg-gray-100" />)}</div>
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><p className="font-bold text-red-800">Schedule load nahi ho paya</p><p className="mt-1 text-sm text-red-700">{error}</p><button type="button" onClick={loadHearings} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Retry</button></div>

  return <section className="mx-auto max-w-4xl space-y-4"><header className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-blue-600" /><h1 className="text-xl font-bold text-gray-900">{day === 'today' ? 'TODAY' : 'TOMORROW'} · {dateLabel}</h1></div><p className="mt-1 text-sm text-gray-500">Court, judge, queue aur travel plan ek jagah.</p></div><button type="button" onClick={loadHearings} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600"><RefreshCw className="h-4 w-4" /></button></div><div className="mt-4 inline-flex rounded-lg bg-white p-1 text-sm font-semibold shadow-sm"><button type="button" onClick={() => setDay('today')} className={`rounded-md px-4 py-2 ${day === 'today' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Today</button><button type="button" onClick={() => setDay('tomorrow')} className={`rounded-md px-4 py-2 ${day === 'tomorrow' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Tomorrow</button></div></header>
    {!hearings.length ? <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-green-600" /><p className="mt-3 font-semibold text-gray-700">{tr('No hearings scheduled. All clear! 🎉', 'कोई सुनवाई निर्धारित नहीं है। सब ठीक है! 🎉')}</p></div> : <div className="space-y-4">{hearings.map((item, index) => { const caseData = item.cases || {}; const meta = notes(caseData.notes); const position = meta.queue_position || index + 1; const total = meta.queue_total || hearings.length; const wait = meta.expected_wait_minutes || Math.max(15, Number(position) * 9); const priority = item.outcome === 'Attended' ? 'green' : index === 0 ? 'red' : 'yellow'; const colors = priority === 'red' ? 'border-red-200 bg-red-50' : priority === 'yellow' ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'; return <article key={item.id} className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${colors}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-gray-900"><Clock3 className="mr-1 inline h-4 w-4" />{item.hearing_time?.slice(0, 5) || 'Time pending'} {priority === 'red' ? '(CRITICAL)' : priority === 'yellow' ? '(EXPECTED)' : '(DONE)'}</p><h2 className="mt-2 text-lg font-bold text-gray-900">{caseData.case_title || caseData.case_number || item.hearing_purpose || 'Follow-up'}</h2><p className="mt-1 text-sm text-gray-700"><MapPin className="mr-1 inline h-4 w-4" />{caseData.court_name || 'Court not added'}{meta.court_number ? `, Room ${meta.court_number}` : ''}</p></div><a href={mapsUrl(caseData.court_name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-blue-700"><ExternalLink className="h-3.5 w-3.5" />Show in Maps</a></div><div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2"><button type="button" onClick={() => setOpenJudge(openJudge === item.id ? '' : item.id)} className="text-left"><Gavel className="mr-1 inline h-4 w-4" />Judge: <strong>{caseData.judge_name || 'Not added'}</strong></button><p><UserRound className="mr-1 inline h-4 w-4" />Your position: <strong>{position}/{total} cases</strong></p><p>Expected wait: <strong>{wait} minutes</strong></p><p><Route className="mr-1 inline h-4 w-4" />Travel: <strong>{travel[item.id] || 15} min {index ? 'from previous court' : 'from home'}</strong></p></div>{openJudge === item.id && <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-gray-700">Judge information is taken from this case record. Update it in Case Reports if the court cause list changes.</div>}<div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => markDone(item)} disabled={item.outcome === 'Attended'} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="mr-1 inline h-4 w-4" />{item.outcome === 'Attended' ? 'Attended' : 'Mark Done'}</button><button type="button" onClick={() => editTime(item)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700"><Pencil className="mr-1 inline h-4 w-4" />Edit time</button></div></article> })}</div>}
    {!mapsReady && <p className="rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-500">Maps route links are ready. Live travel estimates will activate after the optional Google Maps browser key is added.</p>}
  </section>
}

HearingSchedule.propTypes = { homeLocation: PropTypes.string }
HearingSchedule.defaultProps = { homeLocation: '' }
