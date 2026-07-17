'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Mic, ShieldCheck } from 'lucide-react'
import VoiceInput from '@/src/components/VoiceInput'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'

const GUEST_CASES_STORAGE_KEY = 'vakil_guest_cases_v2'

interface CaseOption {
  id: string
  case_number: string
  case_title?: string | null
  notes?: string | null
}

interface VoiceUpdate {
  id: string
  transcript: string
  language: string
  captured_at: string
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

  const selectedCase = useMemo(() => cases.find(item => item.id === selectedCaseId), [cases, selectedCaseId])

  const loadCases = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setIsGuest(true)
      try {
        const stored = window.sessionStorage.getItem(GUEST_CASES_STORAGE_KEY)
        const parsed = stored ? JSON.parse(stored) as CaseOption[] : []
        setCases(parsed)
        setSelectedCaseId(parsed[0]?.id || '')
      } catch { setCases([]) }
      setLoading(false)
      return
    }

    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', session.user.id).single()
    if (!advocate) { setLoading(false); return }
    const { data } = await supabase
      .from('cases')
      .select('id, case_number, case_title, notes')
      .eq('advocate_id', advocate.id)
      .order('created_at', { ascending: false })
    const loadedCases = (data ?? []) as CaseOption[]
    setCases(loadedCases)
    setSelectedCaseId(loadedCases[0]?.id || '')
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCases()
  }, [loadCases])

  async function saveVoiceUpdate(payload: { transcript: string; language: string; caseId?: string | null; capturedAt: string }) {
    if (!selectedCase) throw new Error(tr('Select a case before submitting', 'सबमिट करने से पहले केस चुनें'))
    const requestPayload = { ...payload, caseId: selectedCase.id }

    if (isGuest) {
      const notes = parseNotes(selectedCase.notes)
      const existing = Array.isArray(notes.voice_updates) ? notes.voice_updates as VoiceUpdate[] : []
      const update: VoiceUpdate = { id: `voice-${Date.now()}`, transcript: payload.transcript, language: payload.language, captured_at: payload.capturedAt }
      const nextNotes = JSON.stringify({ ...notes, voice_updates: [update, ...existing] })
      const nextCases = cases.map(item => item.id === selectedCase.id ? { ...item, notes: nextNotes } : item)
      window.sessionStorage.setItem(GUEST_CASES_STORAGE_KEY, JSON.stringify(nextCases))
      setCases(nextCases)
      toast.success(tr('Voice update saved for this temporary guest case', 'वॉइस अपडेट अस्थायी गेस्ट केस में सेव हो गया'))
      return { success: true, update }
    }

    const response = await fetch('/api/voice-input', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || tr('Could not save voice update', 'वॉइस अपडेट सेव नहीं हो सका'))
    toast.success(tr('Voice update saved to the case', 'वॉइस अपडेट केस में सेव हो गया'))
    await loadCases()
    return data
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2"><Mic className="h-5 w-5 text-blue-600" /><h1 className="text-xl font-bold text-gray-900">{tr('Voice Case Update', 'वॉइस केस अपडेट')}</h1></div>
        <p className="mt-1 text-sm text-gray-500">{tr('Speak a case update in Hindi, English or Hinglish, review it, then save it to the chosen case.', 'हिंदी, अंग्रेज़ी या हिंग्लिश में केस अपडेट बोलें, उसे जाँचें और चुने गए केस में सेव करें।')}</p>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <label className="text-sm font-bold text-blue-950">{tr('Save voice update to', 'वॉइस अपडेट इसमें सेव करें')}</label>
        <select value={selectedCaseId} onChange={event => setSelectedCaseId(event.target.value)} disabled={loading || !cases.length} className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-3 text-sm text-gray-800 outline-none focus:border-blue-500">
          {!cases.length && <option>{tr('No case available', 'कोई केस उपलब्ध नहीं है')}</option>}
          {cases.map(caseItem => <option key={caseItem.id} value={caseItem.id}>{caseItem.case_number} — {caseItem.case_title || tr('Untitled matter', 'बिना शीर्षक का मामला')}</option>)}
        </select>
      </div>

      {loading ? <div className="py-12 text-center text-sm text-gray-400">{tr('Loading cases...', 'केस लोड हो रहे हैं...')}</div> : !cases.length ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center"><p className="font-semibold text-gray-600">{tr('Create a case first to save a voice update.', 'वॉइस अपडेट सेव करने के लिए पहले एक केस बनाएं।')}</p></div>
      ) : (
        <VoiceInput
          key={selectedCaseId}
          caseId={selectedCaseId}
          language={isHindi ? 'hi-IN' : 'en-IN'}
          onSubmit={saveVoiceUpdate}
        />
      )}

      <p className="flex items-start gap-2 rounded-xl border border-gray-100 bg-white p-3 text-xs leading-5 text-gray-500"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />{tr('Review and edit every transcript before saving. Voice notes are not used to automatically change a hearing date, case status or legal record.', 'सेव करने से पहले हर ट्रांसक्रिप्ट की जाँच और संपादन करें। वॉइस नोट से तारीख, केस स्थिति या कानूनी रिकॉर्ड अपने-आप नहीं बदलेगा।')}</p>
    </div>
  )
}

