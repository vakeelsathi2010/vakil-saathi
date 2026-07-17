'use client'

import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { CheckCircle2, Clock3, FileText, Lightbulb, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['Filed', 'Pending', 'Hearing', 'Adjourned', 'Hearing Completed', 'Judgment Awaited', 'Judgment Received', 'Appeal', 'Closed']
const SUGGESTIONS = { Bail: ['Hearing', 'Adjourned', 'Judgment Received'], Property: ['Pending', 'Hearing', 'Judgment Awaited', 'Judgment Received'], Criminal: ['Hearing', 'Adjourned', 'Hearing Completed'], Civil: ['Pending', 'Hearing', 'Judgment Awaited'] }

export default function StatusTracker({ caseId }) {
  const [caseData, setCaseData] = useState(null)
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('Pending')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: record, error: recordError }, { data: events, error: historyError }] = await Promise.all([
      supabase.from('cases').select('id, case_number, case_title, case_type, status').eq('id', caseId).single(),
      supabase.from('case_history').select('id, event_type, details, created_at').eq('case_id', caseId).order('created_at', { ascending: false }),
    ])
    if (recordError) toast.error(recordError.message)
    if (historyError && historyError.code !== '42P01') toast.error(historyError.message)
    setCaseData(record); setStatus(record?.status || 'Pending'); setHistory(events || []); setLoading(false)
  }, [caseId])

  useEffect(() => {
    // Loading the selected case and its immutable timeline is this effect's purpose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function submit(event) {
    event.preventDefault(); setSaving(true)
    try {
      const response = await fetch(`/api/cases/${caseId}/status`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, date: date || undefined, notes }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) throw new Error(result.error || 'Status update failed')
      toast.success('Case status updated'); setNotes(''); await load()
      if (result.clientNotification?.status === 'pending_approval') toast.success('Client message draft is ready for approval')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Status update failed') } finally { setSaving(false) }
  }

  if (loading) return <div className="h-52 animate-pulse rounded-2xl bg-gray-100" />
  const suggestions = SUGGESTIONS[caseData?.case_type] || ['Pending', 'Hearing', 'Closed']
  return <section className="space-y-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6"><div><h2 className="text-lg font-bold text-gray-900">Case Status Management</h2><p className="mt-1 text-sm text-gray-500">{caseData?.case_title || caseData?.case_number}</p></div><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-700">New status<select value={status} onChange={event => setStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal"><option value="">Select status</option>{STATUSES.map(item => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">Next hearing / status date<input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" /></label><label className="sm:col-span-2 text-sm font-semibold text-gray-700">Notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="e.g. FIR not yet filed" className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" /></label><div className="sm:col-span-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900"><Lightbulb className="mr-1 inline h-4 w-4" />Suggested next statuses: {suggestions.map(item => <button type="button" key={item} onClick={() => setStatus(item)} className="ml-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">{item}</button>)}</div><button disabled={saving} className="sm:col-span-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? 'Updating...' : 'Update Status'}</button></form><div className="border-t border-gray-100 pt-5"><h3 className="flex items-center gap-2 font-bold text-gray-900"><FileText className="h-5 w-5 text-blue-600" />Case History</h3>{history.length ? <ol className="mt-4 space-y-4 border-l-2 border-blue-100 pl-5">{history.map(item => { const details = item.details || {}; return <li key={item.id} className="relative"><span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-blue-600" /><p className="text-sm font-semibold text-gray-900"><Clock3 className="mr-1 inline h-4 w-4" />{new Date(item.created_at).toLocaleString('en-IN')} · {details.new_status || item.event_type}</p><p className="mt-1 text-xs text-gray-500">By: {details.changed_by || 'You'}</p>{details.notes && <p className="mt-1 text-sm text-gray-700">Note: {details.notes}</p>}{details.next_date && <p className="mt-1 text-sm text-gray-700">Next date: {details.next_date}</p>}{details.client_notification?.status === 'pending_approval' && <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs text-green-700"><Send className="h-3 w-3" />Client message ready for approval</p>}</li> })}</ol> : <div className="mt-4 rounded-xl bg-green-50 p-5 text-center text-sm text-green-800"><CheckCircle2 className="mx-auto mb-2 h-6 w-6" />No status changes yet.</div>}</div></section>
}

StatusTracker.propTypes = { caseId: PropTypes.string.isRequired }
