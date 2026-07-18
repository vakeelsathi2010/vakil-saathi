'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { HardDrive } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import DocumentUpload from './DocumentUpload'
import DocumentList from './DocumentList'

const FREE_LIMIT = 100 * 1024 * 1024

export default function DocumentManager() {
  const [cases, setCases] = useState([]); const [documents, setDocuments] = useState([]); const [advocateId, setAdvocateId] = useState(''); const [userId, setUserId] = useState(''); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setLoading(false); return }; setUserId(user.id); const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', user.id).single(); if (!advocate) { setLoading(false); return }; setAdvocateId(advocate.id); const [caseResult, documentResult] = await Promise.all([supabase.from('cases').select('id, case_number, case_title').eq('advocate_id', advocate.id).order('created_at', { ascending: false }), supabase.from('case_documents').select('*, cases(case_number, case_title)').eq('advocate_id', advocate.id).order('created_at', { ascending: false })]); if (documentResult.error && documentResult.error.code === '42P01') toast.error('Document storage is not ready. Run migration 012 first.'); else if (documentResult.error) toast.error(documentResult.error.message); setCases(caseResult.data || []); setDocuments(documentResult.data || []); setLoading(false) }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const usedBytes = documents.reduce((sum, document) => sum + Number(document.file_size || 0), 0)
  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return value ? documents.filter(document => `${document.file_name} ${document.cases?.case_number || ''} ${document.cases?.case_title || ''}`.toLowerCase().includes(value)) : documents }, [documents, query])
  return <div className="mx-auto max-w-6xl"><div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Document Vault</h1><p className="mt-1 text-sm text-slate-500">Store case records privately and keep every file easy to find.</p></div><div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><HardDrive className="h-6 w-6 text-blue-700" /><div><p className="font-bold text-blue-950">Free plan storage</p><p className="text-sm text-blue-700">{(usedBytes / 1024 / 1024).toFixed(1)} MB of 100 MB used</p></div></div><span className="text-sm font-bold text-blue-800">{Math.max(0, Math.round((1 - usedBytes / FREE_LIMIT) * 100))}% free</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, usedBytes / FREE_LIMIT * 100)}%` }} /></div><p className="mt-2 text-xs text-blue-700">Paid plans can later extend this limit to 1-5 GB.</p></div>{loading ? <div className="h-48 animate-pulse rounded-2xl bg-slate-100" /> : <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"><DocumentUpload cases={cases} advocateId={advocateId} userId={userId} usedBytes={usedBytes} onUploaded={load} /><DocumentList documents={filtered} query={query} onQueryChange={setQuery} onChanged={load} /></div>}</div>
}
