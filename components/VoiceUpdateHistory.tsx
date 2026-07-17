'use client'

import { Mic, Volume2 } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'

interface VoiceUpdate { id: string; transcript: string; language?: string; captured_at: string }

function parseVoiceUpdates(notes?: string | null): VoiceUpdate[] {
  if (!notes) return []
  try {
    const parsed = JSON.parse(notes) as { voice_updates?: VoiceUpdate[] }
    return Array.isArray(parsed.voice_updates) ? parsed.voice_updates.filter(item => item?.transcript) : []
  } catch { return [] }
}

export default function VoiceUpdateHistory({ initialNotes }: { initialNotes?: string | null }) {
  const { isHindi, tr } = useLanguage()
  const updates = parseVoiceUpdates(initialNotes)
  if (!updates.length) return null
  return (
    <section id="voice-updates" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><Volume2 className="h-5 w-5 text-blue-600" /><h2 className="font-bold text-[#1e3a5f]">{tr('Voice Updates', 'वॉइस अपडेट')}</h2><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{updates.length}</span></div>
      <div className="space-y-3">{updates.map(update => <article key={update.id} className="rounded-xl border border-gray-100 bg-blue-50/40 p-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-blue-700"><Mic className="h-3.5 w-3.5" />{new Date(update.captured_at).toLocaleString(isHindi ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{update.transcript}</p></article>)}</div>
    </section>
  )
}

