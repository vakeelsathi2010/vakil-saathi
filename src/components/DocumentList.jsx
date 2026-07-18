'use client'

import { Download, Eye, FileText, ImageIcon, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const readableSize = value => value > 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`

export default function DocumentList({ documents, query, onQueryChange, onChanged }) {
  const signedUrl = async document => {
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('case-documents').createSignedUrl(document.storage_path, 60)
    if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not open document.')
    return data.signedUrl
  }
  const preview = async document => {
    try {
      const url = await signedUrl(document)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not preview document.') }
  }
  const download = async document => {
    try {
      const url = await signedUrl(document)
      const link = window.document.createElement('a'); link.href = url; link.download = document.file_name; link.click()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not download document.') }
  }
  const remove = async document => {
    if (!window.confirm(`Delete ${document.file_name}? This cannot be undone.`)) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('case_documents').delete().eq('id', document.id)
      if (error) throw error
      await supabase.storage.from('case-documents').remove([document.storage_path])
      toast.success('Document deleted.'); await onChanged()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete document.') }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Case Documents</h2><p className="mt-1 text-sm text-slate-500">Private files organised by case.</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search files or cases" className="w-48 border-0 text-sm outline-none" /></div></div>{documents.length ? <div className="mt-4 divide-y divide-slate-100">{documents.map(document => { const image = document.mime_type.startsWith('image/'); return <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className={`rounded-xl p-2.5 ${image ? 'bg-violet-50 text-violet-600' : 'bg-red-50 text-red-600'}`}>{image ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{document.file_name}</p><p className="text-xs text-slate-500">{document.cases?.case_number || 'Case'} - {readableSize(document.file_size)} - {new Date(document.created_at).toLocaleDateString('en-IN')}</p></div></div><div className="flex gap-1"><button type="button" onClick={() => preview(document)} title="Preview" className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Eye className="h-4 w-4" /></button><button type="button" onClick={() => download(document)} title="Download" className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><Download className="h-4 w-4" /></button><button type="button" onClick={() => remove(document)} title="Delete" className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div> })}</div> : <div className="py-12 text-center text-sm text-slate-500">No matching documents found.</div>}</section>
}
