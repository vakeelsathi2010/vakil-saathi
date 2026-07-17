'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FilePlus2, Mic, ShieldCheck } from 'lucide-react'
import VoiceInput from '@/src/components/VoiceInput'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'

const GUEST_CASES_STORAGE_KEY = 'vakil_guest_cases_v2'

interface CaseOption { id: string; case_number: string; case_title?: string | null; notes?: string | null }
interface VoiceUpdate { id: string; transcript: string; language: string; captured_at: string }
interface VoiceCaseDraft {
  clientName: string
  caseType: 'Bail' | 'Property' | 'Criminal' | 'Civil' | ''
  status: string
  nextDate: string
  mainIssue: string
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  confidence: number
}

function parseNotes(notes?: string | null): Record<string, unknown> {
  if (!notes) return {}
  try { return JSON.parse(notes) as Record<string, unknown> } catch { return { legacy_notes: notes } }
}

export default function VoiceCaseUpdater() {
  const { isHindi, tr } = useLanguage()
  const [cases, setCases] = useState<CaseOption[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [mode, setMode] = useState<'update' | 'create'>('update')
  const [draft, setDraft] = useState<VoiceCaseDraft | null>(null)
  const [creating, setCreating] = useState(false)
  const selectedCase = useMemo(() => cases.find(item => item.id === selectedCaseId), [cases, selectedCaseId])

  const loadCases = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setIsGuest(true)
      try {
        const stored = window.sessionStorage.getItem(GUEST_CASES_STORAGE_KEY)
        const parsed = stored ? JSON.parse(stored) as CaseOption[] : []
        setCases(parsed); setSelectedCaseId(parsed[0]?.id || '')
      } catch { setCases([]) }
      setLoading(false)
      return
    }
    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
    if (!advocate) { setLoading(false); return }
    const { data } = await supabase.from('cases').select('id, case_number, case_title, notes').eq('advocate_id', advocate.id).order('created_at', { ascending: false })
    const loadedCases = (data ?? []) as CaseOption[]
    setCases(loadedCases); setSelectedCaseId(loadedCases[0]?.id || ''); setLoading(false)
  }, [])

  useEffect(() => {
    // Loading the existing workspace is the effect's explicit purpose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCases()
  }, [loadCases])

  async function saveVoiceUpdate(payload: { transcript: string; language: string; caseId?: string | null; capturedAt: string }) {
    if (!selectedCase) throw new Error(tr('Select a case before submitting', 'Submit करने से पहले case चुनें'))
    const requestPayload = { ...payload, caseId: selectedCase.id }
    if (isGuest) {
      const notes = parseNotes(selectedCase.notes)
      const existing = Array.isArray(notes.voice_updates) ? notes.voice_updates as VoiceUpdate[] : []
      const update: VoiceUpdate = { id: `voice-${Date.now()}`, transcript: payload.transcript, language: payload.language, captured_at: payload.capturedAt }
      const nextNotes = JSON.stringify({ ...notes, voice_updates: [update, ...existing] })
      const nextCases = cases.map(item => item.id === selectedCase.id ? { ...item, notes: nextNotes } : item)
      window.sessionStorage.setItem(GUEST_CASES_STORAGE_KEY, JSON.stringify(nextCases)); setCases(nextCases)
      toast.success(tr('Voice update saved for this temporary guest case', 'Voice update guest case में save हो गया'))
      return { success: true, update }
    }
    const response = await fetch('/api/voice-input', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestPayload) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || tr('Could not save voice update', 'Voice update save नहीं हो सका'))
    toast.success(tr('Voice update saved to the case', 'Voice update case में save हो गया'))
    await loadCases()
    return data
  }

  async function analyseVoiceCase(payload: { transcript: string }) {
    if (isGuest) throw new Error('Please sign in before creating a case from voice.')
    const response = await fetch('/api/cases/extract', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: payload.transcript }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.success) throw new Error(data.error || 'Could not analyse the voice note')
    const details = data.details as Partial<VoiceCaseDraft>
    setDraft({ clientName: details.clientName || '', caseType: details.caseType || '', status: details.status || 'Active', nextDate: details.nextDate || '', mainIssue: details.mainIssue || '', urgency: details.urgency || 'MEDIUM', confidence: details.confidence || 50 })
    toast.success('Voice note analysed. Review the details before creating the case.')
    return data
  }

  async function createCaseFromDraft() {
    if (!draft) return
    if (!draft.clientName || !draft.caseType || !draft.nextDate) { toast.error('Client name, case type and next date are required.'); return }
    setCreating(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Please sign in before creating a case.')
      const { data: advocate, error } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
      if (error || !advocate) throw new Error('Your advocate profile could not be found.')
      const response = await fetch('/api/cases/auto-create', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advocateId: advocate.id, ...draft }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not create the case')
      toast.success(data.updated ? 'Matching case updated successfully.' : `Case ${data.crn} created successfully.`)
      setDraft(null); setMode('update'); await loadCases()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create the case') } finally { setCreating(false) }
  }

  return (
    <div className="space-y-5">
      <div><div className="flex items-center gap-2"><Mic className="h-5 w-5 text-blue-600" /><h1 className="text-xl font-bold text-gray-900">{tr('Voice Case Update', 'Voice Case Update')}</h1></div><p className="mt-1 text-sm text-gray-500">{tr('Speak, review the transcript, and safely save an update or create a new case.', 'बोलें, transcript की जाँच करें, और सुरक्षित रूप से update या नया case बनाएं।')}</p></div>

      <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm font-semibold"><button type="button" onClick={() => { setMode('update'); setDraft(null) }} className={`rounded-lg px-3 py-2.5 ${mode === 'update' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Update existing case</button><button type="button" onClick={() => { setMode('create'); setDraft(null) }} className={`rounded-lg px-3 py-2.5 ${mode === 'create' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Create case from voice</button></div>

      {mode === 'update' && <><div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><label className="text-sm font-bold text-blue-950">{tr('Save voice update to', 'Voice update इसमें save करें')}</label><select value={selectedCaseId} onChange={event => setSelectedCaseId(event.target.value)} disabled={loading || !cases.length} className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-3 text-sm text-gray-800 outline-none focus:border-blue-500">{!cases.length && <option>{tr('No case available', 'कोई case उपलब्ध नहीं है')}</option>}{cases.map(caseItem => <option key={caseItem.id} value={caseItem.id}>{caseItem.case_number} — {caseItem.case_title || tr('Untitled matter', 'बिना शीर्षक का मामला')}</option>)}</select></div>{loading ? <div className="py-12 text-center text-sm text-gray-400">{tr('Loading cases...', 'Cases load हो रहे हैं...')}</div> : !cases.length ? <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center"><p className="font-semibold text-gray-600">{tr('Create a case first to save a voice update.', 'Voice update save करने के लिए पहले एक case बनाएं।')}</p></div> : <VoiceInput key={selectedCaseId} caseId={selectedCaseId} language={isHindi ? 'hi-IN' : 'en-IN'} onSubmit={saveVoiceUpdate} />}</>}

      {mode === 'create' && !draft && <VoiceInput key="new-voice-case" language={isHindi ? 'hi-IN' : 'en-IN'} onSubmit={analyseVoiceCase} />}

      {mode === 'create' && draft && <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-blue-700"><FilePlus2 className="h-5 w-5" /><h2 className="font-bold">Review case details</h2></div><p className="mt-1 text-sm text-gray-500">Confirm or correct the extracted fields before saving. Confidence: {draft.confidence}%</p></div><button type="button" onClick={() => setDraft(null)} className="text-sm font-semibold text-gray-500 hover:text-gray-800">Record again</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-700">Client name<input value={draft.clientName} onChange={event => setDraft({ ...draft, clientName: event.target.value })} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label><label className="text-sm font-semibold text-gray-700">Case type<select value={draft.caseType} onChange={event => setDraft({ ...draft, caseType: event.target.value as VoiceCaseDraft['caseType'] })} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500"><option value="">Select type</option><option>Bail</option><option>Property</option><option>Criminal</option><option>Civil</option></select></label><label className="text-sm font-semibold text-gray-700">Status<input value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label><label className="text-sm font-semibold text-gray-700">Next date<input type="date" value={draft.nextDate} onChange={event => setDraft({ ...draft, nextDate: event.target.value })} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label><label className="text-sm font-semibold text-gray-700">Main issue<input value={draft.mainIssue} onChange={event => setDraft({ ...draft, mainIssue: event.target.value })} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label><label className="text-sm font-semibold text-gray-700">Urgency<select value={draft.urgency} onChange={event => setDraft({ ...draft, urgency: event.target.value as VoiceCaseDraft['urgency'] })} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label></div><button type="button" onClick={createCaseFromDraft} disabled={creating} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">{creating ? 'Creating case...' : 'Create / Update Case'}</button></section>}

      <p className="flex items-start gap-2 rounded-xl border border-gray-100 bg-white p-3 text-xs leading-5 text-gray-500"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />{tr('Review and edit every transcript before saving. Voice input never changes a legal record without your confirmation.', 'Save करने से पहले transcript की जाँच और संपादन करें। आपकी पुष्टि के बिना voice input कोई legal record नहीं बदलता।')}</p>
    </div>
  )
}
