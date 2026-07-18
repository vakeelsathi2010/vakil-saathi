'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gavel, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import JudgeCard from '@/src/components/JudgeCard'

const EMPTY_FORM = { name: '', court: '', bailGrantRate: '', avgCaseDuration: '', totalCases: '', worksOn: '', preferences: '', tips: '', workingHours: '', bailSuccess: '', propertySuccess: '' }
const toCardJudge = row => ({ id: row.id, name: row.name, court: row.court, bailGrantRate: row.bail_grant_rate, avgCaseDuration: row.avg_case_duration, totalCases: row.total_cases, worksOn: row.works_on || [], preferences: row.preferences, tips: row.tips || [], workingHours: row.working_hours, caseTypeSuccess: row.case_type_success || {} })

export default function JudgeDirectory() {
  const [judges, setJudges] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const loadJudges = useCallback(async () => {
    const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: advocate, error: advocateError } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
    if (advocateError || !advocate) { setLoading(false); return }
    const { data, error } = await supabase.from('judges').select('*').eq('advocate_id', advocate.id).order('name')
    if (error) toast.error('Could not load judge notes'); else setJudges((data || []).map(toCardJudge))
    setLoading(false)
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadJudges() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadJudges])

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const saveJudge = async event => {
    event.preventDefault(); setSaving(true)
    try {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Please sign in first')
      const { data: advocate, error: advocateError } = await supabase.from('advocates').select('id').eq('user_id', user.id).single(); if (advocateError || !advocate) throw new Error('Advocate profile not found')
      const caseTypeSuccess = {}; if (form.bailSuccess) caseTypeSuccess.Bail = Number(form.bailSuccess); if (form.propertySuccess) caseTypeSuccess.Property = Number(form.propertySuccess)
      const payload = { advocate_id: advocate.id, name: form.name.trim(), court: form.court.trim(), bail_grant_rate: form.bailGrantRate ? Number(form.bailGrantRate) : null, avg_case_duration: form.avgCaseDuration || null, total_cases: Number(form.totalCases) || 0, works_on: form.worksOn.split(',').map(value => value.trim()).filter(Boolean), preferences: form.preferences || null, tips: form.tips.split(',').map(value => value.trim()).filter(Boolean), working_hours: form.workingHours || null, case_type_success: caseTypeSuccess, source: 'manual', updated_at: new Date().toISOString() }
      if (!payload.name || !payload.court) throw new Error('Judge name and court are required')
      const { error } = await supabase.from('judges').upsert(payload, { onConflict: 'advocate_id,name,court' })
      if (error) throw error
      toast.success('Judge practice note saved'); setForm(EMPTY_FORM); setShowForm(false); await loadJudges()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save judge note') } finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-6xl"><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Gavel className="h-6 w-6 text-orange-500" />Judge Information</h1><p className="mt-1 text-sm text-slate-500">Your private practice notes and case observations. Always verify case information from official court records.</p></div><button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add Judge Note</button></div>
    {showForm && <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Add judge practice note</h2><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-slate-500 hover:bg-white"><X /></button></div><form onSubmit={saveJudge} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Judge name *<input required value={form.name} onChange={event => update('name', event.target.value)} placeholder="Justice Singh" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Court *<input required value={form.court} onChange={event => update('court', event.target.value)} placeholder="Civil Court, Kanpur" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Bail outcome record (%)<input type="number" min="0" max="100" value={form.bailGrantRate} onChange={event => update('bailGrantRate', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Average duration<input value={form.avgCaseDuration} onChange={event => update('avgCaseDuration', event.target.value)} placeholder="4.2 months" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Working hours<input value={form.workingHours} onChange={event => update('workingHours', event.target.value)} placeholder="10:30 AM - 5:00 PM" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Matter types (comma-separated)<input value={form.worksOn} onChange={event => update('worksOn', event.target.value)} placeholder="Bail, Property" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label><label className="md:col-span-2 text-sm font-semibold">Practice preference<textarea value={form.preferences} onChange={event => update('preferences', event.target.value)} placeholder="For example: Values complete documentation" className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label><label className="md:col-span-2 text-sm font-semibold">Helpful tips (comma-separated)<input value={form.tips} onChange={event => update('tips', event.target.value)} placeholder="Be punctual, Complete documents" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label><button disabled={saving} className="md:col-span-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save judge note'}</button></form></div>}
    {loading ? <div className="h-48 animate-pulse rounded-2xl bg-slate-100" /> : judges.length ? <div className="grid gap-5 md:grid-cols-2">{judges.map(judge => <JudgeCard key={judge.id} judge={judge} onShowSimilarCases={() => toast('Similar case search will be available in Case Reports.')} onRate={() => { setForm({ ...EMPTY_FORM, name: judge.name, court: judge.court }); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center"><Gavel className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-800">No judge practice notes yet</p><p className="mt-1 text-sm text-slate-500">Add your first private observation to help prepare for matters.</p></div>}</div>
}
