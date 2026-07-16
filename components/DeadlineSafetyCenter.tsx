'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertOctagon, AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Clock3, ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'

export interface DeadlineCase {
  id: string
  case_number: string
  case_title?: string | null
  court_name?: string | null
  status?: string | null
  notes?: string | null
}

interface CaseMetadata {
  limitation_date?: string
  limitation_type?: string
  limitation_notes?: string
  next_action?: string
  next_action_deadline?: string
}

interface DeadlineItem {
  id: string
  caseId: string
  caseNumber: string
  caseTitle?: string | null
  courtName?: string | null
  deadlineDate: string
  label: string
  notes?: string
  kind: 'limitation' | 'action'
  daysLeft: number
}

type DeadlineFilter = 'all' | 'critical' | 'later' | 'overdue'

const DEADLINE_TYPE_HI: Record<string, string> = {
  'Appeal / Revision Filing': 'अपील / पुनरीक्षण दाखिला',
  'Written Statement / Reply': 'लिखित बयान / जवाब',
  'Evidence / Affidavit Filing': 'साक्ष्य / शपथपत्र दाखिला',
  'Compliance / Objection Removal': 'अनुपालन / आपत्ति निवारण',
  'Legal Notice Response': 'कानूनी नोटिस का जवाब',
  'Execution / Enforcement': 'निष्पादन / प्रवर्तन',
  'Review / Recall Application': 'पुनर्विचार / रिकॉल आवेदन',
  'Other Statutory Deadline': 'अन्य वैधानिक समय-सीमा',
}

function parseMetadata(notes?: string | null): CaseMetadata {
  if (!notes) return {}
  try {
    return JSON.parse(notes) as CaseMetadata
  } catch {
    return {}
  }
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function todayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function daysUntil(value: string) {
  return Math.round((dateFromKey(value).getTime() - todayStart().getTime()) / 86_400_000)
}

function moveDate(value: string, days: number) {
  const date = dateFromKey(value)
  date.setDate(date.getDate() + days)
  return date
}

function isValidDateKey(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dateFromKey(value).getTime()))
}

export default function DeadlineSafetyCenter({ cases }: { cases: DeadlineCase[] }) {
  const { isHindi, tr } = useLanguage()
  const [filter, setFilter] = useState<DeadlineFilter>('all')

  const deadlines = useMemo(() => cases.flatMap<DeadlineItem>(caseItem => {
    const metadata = parseMetadata(caseItem.notes)
    const items: DeadlineItem[] = []

    if (isValidDateKey(metadata.limitation_date)) {
      items.push({
        id: `${caseItem.id}-limitation`,
        caseId: caseItem.id,
        caseNumber: caseItem.case_number,
        caseTitle: caseItem.case_title,
        courtName: caseItem.court_name,
        deadlineDate: metadata.limitation_date!,
        label: metadata.limitation_type ? (isHindi ? DEADLINE_TYPE_HI[metadata.limitation_type] || metadata.limitation_type : metadata.limitation_type) : tr('Limitation / Critical Deadline', 'लिमिटेशन / महत्वपूर्ण समय-सीमा'),
        notes: metadata.limitation_notes,
        kind: 'limitation',
        daysLeft: daysUntil(metadata.limitation_date!),
      })
    }

    if (isValidDateKey(metadata.next_action_deadline)) {
      items.push({
        id: `${caseItem.id}-action`,
        caseId: caseItem.id,
        caseNumber: caseItem.case_number,
        caseTitle: caseItem.case_title,
        courtName: caseItem.court_name,
        deadlineDate: metadata.next_action_deadline!,
        label: metadata.next_action || tr('Next Action Deadline', 'अगले कार्य की समय-सीमा'),
        kind: 'action',
        daysLeft: daysUntil(metadata.next_action_deadline!),
      })
    }

    return items
  }).sort((first, second) => first.deadlineDate.localeCompare(second.deadlineDate)), [cases, isHindi, tr])

  const overdueCount = deadlines.filter(item => item.daysLeft < 0).length
  const todayCount = deadlines.filter(item => item.daysLeft === 0).length
  const nextSevenCount = deadlines.filter(item => item.daysLeft > 0 && item.daysLeft <= 7).length
  const laterCount = deadlines.filter(item => item.daysLeft > 7).length

  const visibleDeadlines = deadlines.filter(item => {
    if (filter === 'overdue') return item.daysLeft < 0
    if (filter === 'critical') return item.daysLeft >= 0 && item.daysLeft <= 7
    if (filter === 'later') return item.daysLeft > 7
    return true
  })

  const formatDate = (value: string) => dateFromKey(value).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const urgency = (daysLeft: number) => {
    if (daysLeft < 0) return {
      badge: tr(`${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} overdue`, `${Math.abs(daysLeft)} दिन विलंबित`),
      card: 'border-red-200 bg-red-50/50',
      badgeClass: 'bg-red-100 text-red-700',
      icon: <AlertOctagon className="h-5 w-5 text-red-600" />,
    }
    if (daysLeft === 0) return { badge: tr('Due today', 'आज अंतिम दिन'), card: 'border-red-300 bg-red-50', badgeClass: 'bg-red-600 text-white', icon: <AlertOctagon className="h-5 w-5 text-red-600" /> }
    if (daysLeft === 1) return { badge: tr('1 day left', '1 दिन शेष'), card: 'border-orange-300 bg-orange-50', badgeClass: 'bg-orange-600 text-white', icon: <AlertTriangle className="h-5 w-5 text-orange-600" /> }
    if (daysLeft <= 3) return { badge: tr(`${daysLeft} days left`, `${daysLeft} दिन शेष`), card: 'border-orange-200 bg-orange-50/60', badgeClass: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="h-5 w-5 text-orange-600" /> }
    if (daysLeft <= 7) return { badge: tr(`${daysLeft} days left`, `${daysLeft} दिन शेष`), card: 'border-amber-200 bg-amber-50/50', badgeClass: 'bg-amber-100 text-amber-700', icon: <Clock3 className="h-5 w-5 text-amber-600" /> }
    return { badge: tr(`${daysLeft} days left`, `${daysLeft} दिन शेष`), card: 'border-gray-100 bg-white', badgeClass: 'bg-gray-100 text-gray-600', icon: <CalendarClock className="h-5 w-5 text-blue-600" /> }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 px-4 py-5 text-white sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{tr('Deadline Safety Center', 'समय-सीमा सुरक्षा केंद्र')}</h2>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">{tr('Automatic in-app alerts', 'स्वचालित इन-ऐप अलर्ट')}</span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300">
                {tr('Tracks limitation periods and important case actions with 7-day, 3-day and 1-day warning points.', 'लिमिटेशन और महत्वपूर्ण केस कार्यों को 7 दिन, 3 दिन और 1 दिन पहले चेतावनी के साथ ट्रैक करता है।')}
              </p>
            </div>
          </div>
          <Link href="/dashboard/cases" className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-blue-50">
            {tr('Add deadline in Case Reports', 'केस रिपोर्ट में समय-सीमा जोड़ें')} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-gray-100 sm:grid-cols-4">
        {[
          { label: tr('Overdue', 'विलंबित'), value: overdueCount, tone: 'text-red-700' },
          { label: tr('Due Today', 'आज अंतिम दिन'), value: todayCount, tone: 'text-red-600' },
          { label: tr('Next 7 Days', 'अगले 7 दिन'), value: nextSevenCount, tone: 'text-orange-600' },
          { label: tr('Scheduled Later', 'बाद के लिए तय'), value: laterCount, tone: 'text-blue-700' },
        ].map(item => (
          <div key={item.label} className="border-b border-r border-gray-100 px-4 py-3 last:border-r-0 sm:border-b-0">
            <p className={`text-xl font-extrabold ${item.tone}`}>{item.value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {([
            ['all', tr('All Deadlines', 'सभी समय-सीमाएँ')],
            ['critical', tr('Due in 7 Days', '7 दिनों में देय')],
            ['later', tr('Later', 'बाद में')],
            ['overdue', tr('Overdue', 'विलंबित')],
          ] as [DeadlineFilter, string][]).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {visibleDeadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-sm font-bold text-gray-800">{deadlines.length ? tr('No deadlines in this category', 'इस श्रेणी में कोई समय-सीमा नहीं है') : tr('No deadlines recorded yet', 'अभी कोई समय-सीमा दर्ज नहीं है')}</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">{tr('While adding a case, record its limitation date or next-action deadline. Alerts will appear here automatically.', 'केस जोड़ते समय लिमिटेशन तारीख या अगले कार्य की समय-सीमा दर्ज करें। अलर्ट यहाँ अपने-आप दिखाई देंगे।')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleDeadlines.map(item => {
              const style = urgency(item.daysLeft)
              return (
                <article key={item.id} className={`rounded-xl border p-4 ${style.card}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">{style.icon}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.kind === 'limitation' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {item.kind === 'limitation' ? tr('Limitation', 'लिमिटेशन') : tr('Case Action', 'केस कार्य')}
                          </span>
                          <p className="text-sm font-bold text-gray-900">{item.label}</p>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-gray-700">{item.caseNumber}{item.caseTitle ? ` · ${item.caseTitle}` : ''}</p>
                        {item.courtName && <p className="mt-0.5 text-xs text-gray-500">{item.courtName}</p>}
                        {item.notes && <p className="mt-2 text-xs leading-5 text-gray-600">{item.notes}</p>}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center justify-between gap-3 sm:block sm:text-right">
                      <p className="text-sm font-extrabold text-gray-900">{formatDate(item.deadlineDate)}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${style.badgeClass}`}>{style.badge}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 border-t border-black/5 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500">
                      <span className="font-semibold text-gray-600">{tr('Warning dates:', 'चेतावनी तारीखें:')}</span>
                      {[7, 3, 1].map(days => (
                        <span key={days} className={`rounded-md border px-2 py-1 ${item.daysLeft <= days ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white'}`}>
                          {days}d · {moveDate(item.deadlineDate, -days).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      ))}
                    </div>
                    <Link href={`/dashboard/cases/${item.caseId}`} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
                      {tr('Open Case Report', 'केस रिपोर्ट खोलें')} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">
          <strong>{tr('Professional check required:', 'पेशेवर जाँच आवश्यक:')}</strong>{' '}
          {tr('VakilSaathi calculates alerts from dates entered by the advocate. Always verify the applicable limitation law, exclusions and the official court record. Background push/SMS alerts require a notification service and are not active in this free version.', 'VakilSaathi अधिवक्ता द्वारा दर्ज तारीखों से अलर्ट की गणना करता है। लागू लिमिटेशन कानून, अपवाद और आधिकारिक न्यायालय रिकॉर्ड की हमेशा जाँच करें। बैकग्राउंड पुश/SMS अलर्ट के लिए नोटिफिकेशन सेवा आवश्यक है और इस मुफ्त संस्करण में सक्रिय नहीं है।')}
        </div>
      </div>
    </section>
  )
}
