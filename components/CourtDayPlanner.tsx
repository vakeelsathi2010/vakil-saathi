'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Route,
  Scale,
  UserRound,
} from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'

export interface CourtPlanHearing {
  id: string
  hearing_date: string
  hearing_time?: string
  hearing_purpose?: string
  caseNumber: string
  caseTitle?: string
  courtName: string
  courtNumber?: string
  judgeName?: string
}

interface CourtDayPlannerProps {
  hearings: CourtPlanHearing[]
  onAddHearing: () => void
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function moveDate(value: string, days: number) {
  const date = dateFromKey(value)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

function formatTime(value?: string) {
  if (!value) return null
  const [hour, minute] = value.split(':').map(Number)
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export default function CourtDayPlanner({ hearings, onAddHearing }: CourtDayPlannerProps) {
  const { isHindi, tr } = useLanguage()
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))

  const dayHearings = useMemo(() => hearings
    .filter(hearing => hearing.hearing_date === selectedDate)
    .sort((first, second) => {
      if (first.hearing_time && second.hearing_time) return first.hearing_time.localeCompare(second.hearing_time)
      if (first.hearing_time) return -1
      if (second.hearing_time) return 1
      const courtOrder = first.courtName.localeCompare(second.courtName)
      return courtOrder || first.caseNumber.localeCompare(second.caseNumber)
    }), [hearings, selectedDate])

  const courtCount = new Set(dayHearings.map(item => item.courtName.trim().toLowerCase()).filter(Boolean)).size
  const missingTimeCount = dayHearings.filter(item => !item.hearing_time).length
  const courtChanges = dayHearings.slice(1).filter((item, index) => item.courtName !== dayHearings[index].courtName).length
  const selectedDateObject = dateFromKey(selectedDate)
  const isToday = selectedDate === dateKey(new Date())

  return (
    <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-950 px-4 py-4 text-white sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Route className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{tr('Court Day Planner', 'कोर्ट डे प्लानर')}</h2>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">{tr('Free planner', 'मुफ्त प्लानर')}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-300">{tr('Your matters ordered by hearing time, court and room.', 'आपके मामलों का समय, कोर्ट और कक्ष के अनुसार क्रम।')}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
            <button type="button" onClick={() => setSelectedDate(current => moveDate(current, -1))} aria-label={tr('Previous day', 'पिछला दिन')} className="rounded-lg p-2 text-slate-200 hover:bg-white/10 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
            <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value || dateKey(new Date()))} className="min-w-0 flex-1 rounded-lg border-0 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900 sm:w-36" />
            <button type="button" onClick={() => setSelectedDate(current => moveDate(current, 1))} aria-label={tr('Next day', 'अगला दिन')} className="rounded-lg p-2 text-slate-200 hover:bg-white/10 hover:text-white"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              <p className="text-sm font-bold text-gray-900">{selectedDateObject.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              {isToday && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{tr('Today', 'आज')}</span>}
            </div>
            <p className="mt-1 text-xs text-gray-500">{dayHearings.length ? tr('Suggested working order based on the details entered in the app.', 'ऐप में दर्ज जानकारी के आधार पर सुझाया गया कार्य क्रम।') : tr('No case date is scheduled for this day.', 'इस दिन कोई केस तारीख निर्धारित नहीं है।')}</p>
          </div>
          {dayHearings.length > 0 && <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700">{dayHearings.length} {tr(dayHearings.length === 1 ? 'matter' : 'matters', 'मामले')}</span>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">{courtCount} {tr(courtCount === 1 ? 'court' : 'courts', 'कोर्ट')}</span>
            {courtChanges > 0 && <span className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700">{courtChanges} {tr('court changes', 'कोर्ट बदलाव')}</span>}
          </div>}
        </div>
      </div>

      {dayHearings.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"><Scale className="h-6 w-6" /></div>
          <p className="mt-3 text-sm font-semibold text-gray-700">{tr('Your court route is clear', 'आज का कोर्ट रूट खाली है')}</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-gray-400">{tr('Add a case date with time and court details to create the day plan.', 'दिन की योजना बनाने के लिए समय और कोर्ट विवरण के साथ केस तारीख जोड़ें।')}</p>
          <button type="button" onClick={onAddHearing} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><Plus className="h-3.5 w-3.5" />{tr('Add Case Date', 'केस तारीख जोड़ें')}</button>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          {missingTimeCount > 0 && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p><strong>{missingTimeCount} {tr(missingTimeCount === 1 ? 'matter has no time.' : 'matters have no time.', 'मामलों में समय दर्ज नहीं है।')}</strong> {tr('Add approximate times for a more reliable court plan.', 'बेहतर कोर्ट योजना के लिए अनुमानित समय जोड़ें।')}</p>
            </div>
          )}

          <div className="space-y-0">
            {dayHearings.map((hearing, index) => {
              const previous = index > 0 ? dayHearings[index - 1] : null
              const courtChanged = previous && previous.courtName !== hearing.courtName
              const sameTimeConflict = previous?.hearing_time && hearing.hearing_time && previous.hearing_time === hearing.hearing_time && courtChanged
              return (
                <div key={hearing.id}>
                  {previous && (
                    <div className={`ml-[19px] flex min-h-9 items-center border-l-2 pl-7 text-[11px] ${courtChanged ? 'border-orange-300 text-orange-700' : 'border-blue-200 text-blue-600'}`}>
                      {courtChanged ? <><Route className="mr-1.5 h-3.5 w-3.5" />{sameTimeConflict ? tr('Timing conflict: different court at the same time', 'समय टकराव: एक ही समय पर अलग कोर्ट') : tr('Court change — keep travel and security-check buffer', 'कोर्ट बदलाव — यात्रा और सुरक्षा जाँच का समय रखें')}</> : <><Building2 className="mr-1.5 h-3.5 w-3.5" />{tr('Same court complex — shorter movement', 'वही कोर्ट परिसर — कम आवागमन')}</>}
                    </div>
                  )}
                  <article className={`grid gap-3 rounded-xl border p-3.5 sm:grid-cols-[76px_1fr_auto] sm:items-center ${sameTimeConflict ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/60'}`}>
                    <div className="flex items-center gap-2 sm:block">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white sm:mx-auto">{index + 1}</div>
                      <div className="sm:mt-1 sm:text-center">
                        <p className={`text-xs font-bold ${hearing.hearing_time ? 'text-gray-900' : 'text-amber-700'}`}>{formatTime(hearing.hearing_time) || tr('Time not set', 'समय नहीं')}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-gray-900">{hearing.caseNumber}</p>
                        {hearing.hearing_purpose && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">{hearing.hearing_purpose}</span>}
                      </div>
                      {hearing.caseTitle && <p className="mt-0.5 truncate text-xs text-gray-500">{hearing.caseTitle}</p>}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-blue-600" />{hearing.courtName}</span>
                        {hearing.courtNumber && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-orange-600" />{tr('Room', 'कक्ष')} {hearing.courtNumber}</span>}
                        {hearing.judgeName && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-gray-500" />{hearing.judgeName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 sm:justify-end"><Clock3 className="h-3.5 w-3.5" />{tr('Planned', 'योजनाबद्ध')}</div>
                  </article>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-5 text-blue-700">
            <strong>{tr('Planning note:', 'योजना नोट:')}</strong> {tr('This free planner uses the hearing time and court details entered by the advocate. Live traffic, walking distance and courtroom-call priority will require a maps/court integration later.', 'यह मुफ्त प्लानर अधिवक्ता द्वारा दर्ज समय और कोर्ट विवरण का उपयोग करता है। लाइव ट्रैफिक, पैदल दूरी और कोर्ट कॉल प्राथमिकता के लिए बाद में मैप/कोर्ट इंटीग्रेशन आवश्यक होगा।')}
          </div>
        </div>
      )}
    </section>
  )
}
