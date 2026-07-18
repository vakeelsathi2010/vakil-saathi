'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Play, Save, Square, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

function formatTime(seconds) {
  const value = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export default function VoiceNotes() {
  const [cases, setCases] = useState([])
  const [caseId, setCaseId] = useState('')
  const [advocateId, setAdvocateId] = useState('')
  const [userId, setUserId] = useState('')
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState([])
  const [speed, setSpeed] = useState(1)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const intervalRef = useRef(null)
  const audioRef = useRef(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sign in to record and save voice notes.'); return }
    setUserId(user.id)
    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
    if (!advocate) return
    setAdvocateId(advocate.id)
    const { data } = await supabase.from('cases').select('id, case_number, case_title').eq('advocate_id', advocate.id).order('created_at', { ascending: false })
    setCases(data || [])
    setCaseId(data?.[0]?.id || '')
  }, [])

  const loadNotes = useCallback(async () => {
    if (!caseId) return setNotes([])
    const supabase = createClient()
    const { data } = await supabase.from('voice_notes').select('*').eq('case_id', caseId).order('created_at', { ascending: false })
    setNotes(data || [])
  }, [caseId])

  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { const timer = window.setTimeout(() => { void loadNotes() }, 0); return () => window.clearTimeout(timer) }, [loadNotes])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); if (intervalRef.current) window.clearInterval(intervalRef.current) }, [previewUrl])

  const startRecording = async () => {
    if (!caseId) return toast.error('Create and select a case first.')
    if (!navigator.mediaDevices?.getUserMedia) return toast.error('Voice recording is not supported by this browser.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        const recordingBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setBlob(recordingBlob)
        setPreviewUrl(URL.createObjectURL(recordingBlob))
      }
      recorder.start()
      recorderRef.current = recorder
      setSeconds(0)
      setRecording(true)
      intervalRef.current = window.setInterval(() => setSeconds(value => value + 1), 1000)
    } catch {
      toast.error('Microphone permission was not allowed.')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    setRecording(false)
  }

  const saveNote = async () => {
    if (!blob || !caseId || !advocateId || !userId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const extension = blob.type.includes('ogg') ? 'ogg' : 'webm'
      const fileName = `voice-note-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`
      const storagePath = `${userId}/${caseId}/${fileName}`
      const { error: uploadError } = await supabase.storage.from('voice-notes').upload(storagePath, blob, { contentType: blob.type || 'audio/webm', upsert: false })
      if (uploadError) throw uploadError
      const { error: noteError } = await supabase.from('voice_notes').insert({ case_id: caseId, advocate_id: advocateId, storage_path: storagePath, file_name: fileName, mime_type: blob.type || 'audio/webm', duration_seconds: seconds })
      if (noteError) { await supabase.storage.from('voice-notes').remove([storagePath]); throw noteError }
      toast.success('Voice note saved to this case.')
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setBlob(null); setPreviewUrl(''); setSeconds(0)
      await loadNotes()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the voice note.')
    } finally { setSaving(false) }
  }

  const playSaved = async note => {
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('voice-notes').createSignedUrl(note.storage_path, 60)
    if (error || !data?.signedUrl) return toast.error(error?.message || 'Could not open voice note.')
    if (audioRef.current) { audioRef.current.src = data.signedUrl; audioRef.current.playbackRate = speed; await audioRef.current.play() }
  }

  const updateSpeed = value => { setSpeed(value); if (audioRef.current) audioRef.current.playbackRate = value }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Volume2 className="h-5 w-5 text-violet-600" />Voice Notes</h2><p className="mt-1 text-sm text-slate-500">Record a voice note and attach it securely to a case.</p></div><div className="flex rounded-lg border border-slate-200 p-1">{[1, 1.5, 2].map(value => <button key={value} type="button" onClick={() => updateSpeed(value)} className={`rounded px-2 py-1 text-xs font-bold ${speed === value ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{value}x</button>)}</div></div><select value={caseId} onChange={event => setCaseId(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"><option value="">Select case</option>{cases.map(item => <option key={item.id} value={item.id}>{item.case_number} - {item.case_title || 'Untitled case'}</option>)}</select><div className="mt-5 flex flex-col items-center rounded-2xl bg-slate-50 p-6"><button type="button" onClick={recording ? stopRecording : startRecording} className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition ${recording ? 'bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}>{recording ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}</button><p className="mt-3 text-sm font-semibold text-slate-700">{recording ? `Recording ${formatTime(seconds)}` : blob ? `Recorded ${formatTime(seconds)}` : 'Tap to record a case note'}</p>{previewUrl && <div className="mt-4 flex w-full max-w-md items-center gap-3"><audio controls src={previewUrl} className="min-w-0 flex-1" /><button type="button" onClick={saveNote} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save'}</button></div>}</div><audio ref={audioRef} onPlay={() => { if (audioRef.current) audioRef.current.playbackRate = speed }} className="hidden" />{notes.length > 0 && <div className="mt-5"><h3 className="text-sm font-bold text-slate-900">Saved notes</h3><div className="mt-2 space-y-2">{notes.map(note => <div key={note.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-800">{new Date(note.created_at).toLocaleString('en-IN')}</p><p className="text-xs text-slate-500">{formatTime(note.duration_seconds)}</p></div><button type="button" onClick={() => playSaved(note)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700"><Play className="h-4 w-4" />Play</button></div>)}</div></div>}</section>
}
