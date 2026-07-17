'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Check, LoaderCircle, Mic, Pencil, RotateCcw, Send, Square, X } from 'lucide-react'

const MAX_RECORDING_MS = 5 * 60 * 1000

const styles = {
  screen: {
    minHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: 'linear-gradient(145deg, #020617 0%, #0f172a 52%, #111827 100%)',
    color: '#f8fafc',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 24,
    padding: 'clamp(20px, 5vw, 32px)',
    background: 'rgba(15, 23, 42, 0.92)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.38)',
  },
  mic: {
    width: 60,
    height: 60,
    border: 0,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
    touchAction: 'manipulation',
    transition: 'transform 160ms ease, background 160ms ease, box-shadow 160ms ease',
  },
  textarea: {
    width: '100%',
    minHeight: 150,
    resize: 'vertical',
    borderRadius: 16,
    border: '1px solid #334155',
    padding: 16,
    background: '#020617',
    color: '#f8fafc',
    fontFamily: 'inherit',
    fontSize: 16,
    lineHeight: 1.6,
    outline: 'none',
    boxSizing: 'border-box',
  },
  action: {
    minHeight: 46,
    borderRadius: 12,
    border: '1px solid #334155',
    padding: '10px 16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
}

/**
 * @param {{
 *   submitEndpoint?: string,
 *   language?: string,
 *   initialText?: string,
 *   caseId?: string,
 *   onSubmit?: (payload: { transcript: string, language: string, caseId: string | null, source: string, capturedAt: string }) => Promise<unknown>,
 *   onCancel?: () => void,
 *   requestHeaders?: Record<string, string>
 * }} props
 */
function VoiceInput({
  submitEndpoint = '/api/voice-input',
  language = 'hi-IN',
  initialText = '',
  caseId = '',
  onSubmit = null,
  onCancel = null,
  requestHeaders = {},
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transcript, setTranscript] = useState(initialText)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState('')
  const [isOnline, setIsOnline] = useState(true)

  const recognitionRef = useRef(null)
  const timeoutRef = useRef(null)
  const shouldRestartRef = useRef(false)
  const finalTranscriptRef = useRef(initialText)

  const clearRecordingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    shouldRestartRef.current = false
    clearRecordingTimeout()
    recognitionRef.current?.stop()
    setIsRecording(false)
    setInterimTranscript('')
  }, [clearRecordingTimeout])

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = window.navigator.onLine
      setIsOnline(online)
      if (!online) {
        setError('You are offline. Connect to the internet to use voice input.')
        stopRecording()
      } else {
        setError(previous => previous.includes('offline') ? '' : previous)
      }
    }

    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
      shouldRestartRef.current = false
      clearRecordingTimeout()
      recognitionRef.current?.abort()
    }
  }, [clearRecordingTimeout, stopRecording])

  const startRecording = useCallback(() => {
    setError('')
    setIsEditing(false)

    if (!window.navigator.onLine) {
      setError('You are offline. Connect to the internet to use voice input.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Please use the latest Chrome or Edge browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      shouldRestartRef.current = true
      setIsRecording(true)
    }

    recognition.onresult = event => {
      let finalText = ''
      let interimText = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const spokenText = event.results[index][0].transcript
        if (event.results[index].isFinal) finalText += spokenText
        else interimText += spokenText
      }

      if (finalText.trim()) {
        const separator = finalTranscriptRef.current.trim() ? ' ' : ''
        finalTranscriptRef.current = `${finalTranscriptRef.current}${separator}${finalText.trim()}`
        setTranscript(finalTranscriptRef.current)
      }
      setInterimTranscript(interimText)
    }

    recognition.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access was denied. Allow microphone permission in browser settings and try again.')
        stopRecording()
        return
      }
      if (event.error === 'network') {
        setError('Speech service is unavailable. Check your internet connection and try again.')
        stopRecording()
        return
      }
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Voice input stopped: ${event.error}. Please try again.`)
      }
    }

    recognition.onend = () => {
      // Some browsers end long sessions automatically, so restart while the user is recording.
      if (shouldRestartRef.current && window.navigator.onLine) {
        try {
          recognition.start()
        } catch {
          shouldRestartRef.current = false
          setIsRecording(false)
        }
      } else {
        setIsRecording(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      clearRecordingTimeout()
      timeoutRef.current = window.setTimeout(() => {
        stopRecording()
        setError('Recording stopped automatically after the 5-minute limit.')
      }, MAX_RECORDING_MS)
    } catch {
      setError('Could not start the microphone. Please try again.')
    }
  }, [clearRecordingTimeout, language, stopRecording])

  const handleEdit = () => {
    if (isRecording) stopRecording()
    setIsEditing(true)
  }

  const handleTranscriptChange = event => {
    const value = event.target.value
    finalTranscriptRef.current = value
    setTranscript(value)
  }

  const handleCancel = () => {
    stopRecording()
    finalTranscriptRef.current = initialText
    setTranscript(initialText)
    setInterimTranscript('')
    setError('')
    setIsEditing(false)
    onCancel?.()
  }

  const handleSubmit = async () => {
    const cleanTranscript = transcript.trim()
    if (!cleanTranscript) {
      setError('Record or enter some text before submitting.')
      return
    }

    stopRecording()
    setIsSubmitting(true)
    setError('')

    const payload = {
      transcript: cleanTranscript,
      language,
      caseId: caseId || null,
      source: 'voice-input',
      capturedAt: new Date().toISOString(),
    }

    try {
      let responseData
      if (onSubmit) {
        responseData = await onSubmit(payload)
      } else {
        const response = await fetch(submitEndpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...requestHeaders },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
        responseData = await response.json().catch(() => ({}))
      }
      setIsEditing(false)
      return responseData
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the transcript. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayedTranscript = `${transcript}${interimTranscript ? `${transcript.trim() ? ' ' : ''}${interimTranscript}` : ''}`

  return (
    <section style={styles.screen} aria-label="Voice input">
      <div style={styles.card}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#38bdf8', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>VakilSaathi Voice Note</p>
          <h2 style={{ margin: '8px 0 6px', fontSize: 'clamp(22px, 6vw, 30px)' }}>Speak your case update</h2>
          <p style={{ margin: '0 auto 22px', maxWidth: 460, color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>Try: “Rajesh ka bail case, adjourned next 25 July”</p>

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSubmitting || !isOnline}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            aria-pressed={isRecording}
            style={{
              ...styles.mic,
              background: isRecording ? '#dc2626' : '#2563eb',
              boxShadow: isRecording ? '0 0 0 10px rgba(220, 38, 38, 0.16)' : '0 12px 28px rgba(37, 99, 235, 0.32)',
              opacity: isSubmitting || !isOnline ? 0.55 : 1,
            }}
          >
            {isRecording ? <Square size={23} fill="currentColor" /> : <Mic size={27} />}
          </button>
          <p role="status" aria-live="polite" style={{ minHeight: 20, margin: '13px 0 0', color: isRecording ? '#fca5a5' : '#94a3b8', fontSize: 13, fontWeight: 700 }}>
            {isRecording ? 'Recording… tap the red button to stop' : 'Tap the microphone to begin'}
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <label htmlFor="voice-transcript" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
            <span>Live transcript</span>
            {transcript && !isEditing && (
              <button type="button" onClick={handleEdit} style={{ border: 0, background: 'transparent', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontWeight: 700 }}>
                <Pencil size={14} /> Edit
              </button>
            )}
          </label>
          <textarea
            id="voice-transcript"
            value={isEditing ? transcript : displayedTranscript}
            onChange={handleTranscriptChange}
            readOnly={!isEditing}
            placeholder="Your spoken words will appear here in real time…"
            style={{ ...styles.textarea, borderColor: isEditing ? '#3b82f6' : '#334155' }}
          />
          {isEditing && <p style={{ margin: '7px 0 0', color: '#60a5fa', fontSize: 12 }}>Editing enabled — make corrections, then submit.</p>}
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 14, border: '1px solid rgba(248, 113, 113, 0.32)', borderRadius: 12, padding: '11px 13px', background: 'rgba(127, 29, 29, 0.22)', color: '#fecaca', fontSize: 13, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <button type="button" onClick={handleCancel} disabled={isSubmitting} style={{ ...styles.action, background: '#0f172a', color: '#cbd5e1' }}><X size={17} /> Cancel</button>
          <button type="button" onClick={() => { finalTranscriptRef.current = ''; setTranscript(''); setInterimTranscript(''); setError('') }} disabled={isSubmitting || (!transcript && !interimTranscript)} style={{ ...styles.action, background: '#172033', color: '#cbd5e1', opacity: !transcript && !interimTranscript ? 0.5 : 1 }}><RotateCcw size={17} /> Clear</button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || !transcript.trim()} style={{ ...styles.action, borderColor: '#2563eb', background: '#2563eb', color: '#fff', opacity: isSubmitting || !transcript.trim() ? 0.55 : 1 }}>
            {isSubmitting ? <LoaderCircle size={17} className="animate-spin" /> : isEditing ? <Check size={17} /> : <Send size={17} />}
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </section>
  )
}

VoiceInput.propTypes = {
  submitEndpoint: PropTypes.string,
  language: PropTypes.oneOf(['hi-IN', 'en-IN']),
  initialText: PropTypes.string,
  caseId: PropTypes.string,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
  requestHeaders: PropTypes.objectOf(PropTypes.string),
}

export default VoiceInput
