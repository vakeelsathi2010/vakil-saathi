'use client'

import { useRef, useState } from 'react'
import { FileUp, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const FREE_LIMIT = 100 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

export default function DocumentUpload({ cases, advocateId, userId, usedBytes, onUploaded }) {
  const [caseId, setCaseId] = useState('')
  const [uploading, setUploading] = useState(false)
  const pickerRef = useRef(null)

  const uploadFiles = async files => {
    if (!caseId) return toast.error('Select a case before uploading.')
    const list = [...files]
    if (!list.length) return
    if (list.some(file => !ALLOWED_TYPES.includes(file.type))) return toast.error('Only PDF, image, DOC and DOCX files are allowed.')
    const total = list.reduce((sum, file) => sum + file.size, 0)
    if (usedBytes + total > FREE_LIMIT) return toast.error('Free plan storage limit is 100 MB. Upgrade is required for more storage.')
    setUploading(true)
    try {
      const supabase = createClient()
      for (const file of list) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${userId}/${caseId}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('case-documents').upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        const { error: recordError } = await supabase.from('case_documents').insert({ case_id: caseId, advocate_id: advocateId, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size })
        if (recordError) { await supabase.storage.from('case-documents').remove([path]); throw recordError }
      }
      toast.success(`${list.length} document${list.length > 1 ? 's' : ''} uploaded.`)
      if (pickerRef.current) pickerRef.current.value = ''
      await onUploaded()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Upload failed.') } finally { setUploading(false) }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><FileUp className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Upload Documents</h2><p className="mt-1 text-sm text-slate-500">PDF, images, DOC and DOCX. Free storage limit: 100 MB.</p></div></div><select value={caseId} onChange={event => setCaseId(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"><option value="">Select case</option>{cases.map(item => <option key={item.id} value={item.id}>{item.case_number} - {item.case_title || 'Untitled case'}</option>)}</select><input ref={pickerRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={event => uploadFiles(event.target.files)} /><button type="button" disabled={uploading || !cases.length} onClick={() => pickerRef.current?.click()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 px-4 py-8 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><UploadCloud className="h-5 w-5" />{uploading ? 'Uploading securely...' : 'Choose files to upload'}</button></section>
}
