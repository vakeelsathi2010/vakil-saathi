'use client'

import PropTypes from 'prop-types'
import { BarChart3, Clock3, MapPin, Share2, Star, Target, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'

function toPercentage(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${Math.round(number)}%` : 'Not recorded'
}

export const sampleJudge = {
  id: 'sample-justice-singh',
  name: 'Justice Singh',
  court: 'Civil Court, Kanpur',
  bailGrantRate: 85,
  avgCaseDuration: '4.2 months',
  totalCases: 250,
  worksOn: ['Bail', 'Property'],
  preferences: 'Values complete documentation and concise submissions.',
  tips: ['Be punctual', 'Bring complete documents'],
  workingHours: '10:30 AM - 5:00 PM',
  caseTypeSuccess: { Bail: 85, Property: 72 },
}

export default function JudgeCard({ judge, onShowSimilarCases, onRate }) {
  const openMap = () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(judge.court)}`, '_blank', 'noopener,noreferrer')
  const shareTips = async () => {
    const text = `${judge.name} — ${judge.court}\nPractice notes: ${(judge.tips || []).join(', ')}`
    try {
      if (navigator.share) await navigator.share({ title: `${judge.name} practice notes`, text })
      else { await navigator.clipboard.writeText(text); toast.success('Practice notes copied') }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('Could not share practice notes')
    }
  }
  const successEntries = Object.entries(judge.caseTypeSuccess || {})

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-slate-900">{judge.name}</p>
          <button type="button" onClick={openMap} className="mt-1 flex items-center gap-1 text-sm text-blue-600 hover:underline"><MapPin className="h-4 w-4" />{judge.court}</button>
        </div>
        <button type="button" onClick={shareTips} aria-label="Share practice notes" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Share2 className="h-5 w-5" /></button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onShowSimilarCases?.(judge)} className="rounded-xl bg-emerald-50 p-3 text-left hover:bg-emerald-100"><Trophy className="h-4 w-4 text-emerald-700" /><p className="mt-2 text-xl font-bold text-emerald-800">{toPercentage(judge.bailGrantRate)}</p><p className="text-xs text-emerald-700">Bail outcome record</p></button>
        <div className="rounded-xl bg-blue-50 p-3"><Clock3 className="h-4 w-4 text-blue-700" /><p className="mt-2 text-base font-bold text-blue-900">{judge.avgCaseDuration || 'Not recorded'}</p><p className="text-xs text-blue-700">Average duration</p></div>
      </div>

      <div className="mt-5 space-y-3 text-sm text-slate-700">
        <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" /><span><strong>Working hours:</strong> {judge.workingHours || 'Not recorded'}</span></p>
        <p className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-400" /><span><strong>Logged matters:</strong> {judge.totalCases || 0}</span></p>
        {judge.preferences && <p className="rounded-xl bg-amber-50 p-3 text-amber-900"><strong>Practice preference:</strong> {judge.preferences}</p>}
      </div>

      <section className="mt-5"><p className="flex items-center gap-2 text-sm font-bold text-slate-900"><Target className="h-4 w-4 text-orange-500" />Tips for this court</p><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">{(judge.tips || []).map(tip => <li key={tip}>{tip}</li>)}</ul></section>
      {successEntries.length > 0 && <section className="mt-5"><p className="text-sm font-bold text-slate-900">Outcome record by case type</p><div className="mt-2 space-y-2">{successEntries.map(([type, value]) => <div key={type}><div className="flex justify-between text-xs text-slate-600"><span>{type}</span><span>{toPercentage(value)}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, Number(value) || 0))}%` }} /></div></div>)}</div></section>}
      <button type="button" onClick={() => onRate?.(judge)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Star className="h-4 w-4" />Add your practice note</button>
      <p className="mt-3 text-xs text-slate-400">Private advocate practice notes. Verify every case decision from official court records.</p>
    </article>
  )
}

JudgeCard.propTypes = {
  judge: PropTypes.shape({ id: PropTypes.string, name: PropTypes.string.isRequired, court: PropTypes.string.isRequired, bailGrantRate: PropTypes.number, avgCaseDuration: PropTypes.string, totalCases: PropTypes.number, worksOn: PropTypes.arrayOf(PropTypes.string), preferences: PropTypes.string, tips: PropTypes.arrayOf(PropTypes.string), workingHours: PropTypes.string, caseTypeSuccess: PropTypes.object }).isRequired,
  onShowSimilarCases: PropTypes.func,
  onRate: PropTypes.func,
}
