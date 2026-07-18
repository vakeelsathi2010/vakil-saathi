'use client'

import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { CheckCircle2, Mail, Plus, Printer, Share2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateChecklist } from '@/backend/functions/checklistGenerator'

const EMPTY_ITEMS = []
const NOOP = () => {}

export default function CaseChecklist({ caseType, caseTitle = 'Case', initialItems = EMPTY_ITEMS, onChange = NOOP }) {
  const initialTemplate = useMemo(() => generateChecklist(caseType, { customItems: initialItems }).items, [caseType, initialItems])
  const [items, setItems] = useState(initialTemplate)
  const [customItem, setCustomItem] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(initialTemplate), 0)
    return () => window.clearTimeout(timer)
  }, [initialTemplate])
  useEffect(() => { onChange(items) }, [items, onChange])
  const completed = items.filter(item => item.collected).length
  const updateItem = (id, changes) => setItems(current => current.map(item => item.id === id ? { ...item, ...changes } : item))
  const addCustomItem = () => {
    const title = customItem.trim(); if (!title) return
    setItems(current => [...current, { id: `custom-${Date.now()}`, title, collected: false, notes: '', isCustom: true }]); setCustomItem('')
  }
  const message = `${caseTitle} — ${caseType} document checklist\n${items.map(item => `${item.collected ? '☑' : '☐'} ${item.title}${item.notes ? ` — ${item.notes}` : ''}`).join('\n')}`
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  const shareEmail = () => window.location.assign(`mailto:?subject=${encodeURIComponent(`${caseTitle} document checklist`)}&body=${encodeURIComponent(message)}`)
  const printChecklist = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer'); if (!printWindow) return toast.error('Please allow pop-ups to print')
    printWindow.document.write(`<!doctype html><html><head><title>${caseTitle} Checklist</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#172033}h1{font-size:22px}p{color:#526070}li{padding:9px 0;border-bottom:1px solid #e5e7eb}.done{text-decoration:line-through;color:#64748b}.note{display:block;margin:4px 0 0 26px;font-size:12px}</style></head><body><h1>${caseTitle}</h1><p>${caseType} document checklist · ${completed}/${items.length} collected</p><ul>${items.map(item => `<li class="${item.collected ? 'done' : ''}">${item.collected ? '☑' : '☐'} ${item.title}${item.notes ? `<span class="note">Note: ${item.notes}</span>` : ''}</li>`).join('')}</ul></body></html>`); printWindow.document.close(); printWindow.focus(); printWindow.print()
  }

  if (!items.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">No checklist template is available for this case type yet.</div>
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Court document checklist</h2><p className="mt-1 text-sm text-slate-500">{caseType} · {completed} of {items.length} collected</p></div><div className="flex gap-2"><button onClick={printChecklist} type="button" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Print checklist"><Printer className="h-4 w-4" /></button><button onClick={shareWhatsApp} type="button" className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100" aria-label="Share via WhatsApp"><Share2 className="h-4 w-4" /></button><button onClick={shareEmail} type="button" className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100" aria-label="Share via email"><Mail className="h-4 w-4" /></button></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} /></div></div><div className="divide-y divide-slate-100">{items.map(item => <div key={item.id} className="p-4"><div className="flex gap-3"><input id={item.id} type="checkbox" checked={item.collected} onChange={event => updateItem(item.id, { collected: event.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" /><div className="min-w-0 flex-1"><label htmlFor={item.id} className={`font-medium ${item.collected ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.title}</label><input value={item.notes} onChange={event => updateItem(item.id, { notes: event.target.value })} placeholder="Add a note (optional)" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" /></div>{item.isCustom && <button type="button" onClick={() => setItems(current => current.filter(value => value.id !== item.id))} className="p-1 text-slate-400 hover:text-red-600" aria-label={`Remove ${item.title}`}><Trash2 className="h-4 w-4" /></button>}</div></div>)}</div><div className="flex gap-2 border-t border-slate-100 p-4"><input value={customItem} onChange={event => setCustomItem(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomItem() } }} placeholder="Add custom document" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button type="button" onClick={addCustomItem} className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" />Add</button></div><p className="px-5 pb-5 text-xs text-slate-400"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Review documents before filing. This checklist is a preparation aid, not legal advice.</p></section>
}

CaseChecklist.propTypes = { caseType: PropTypes.string.isRequired, caseTitle: PropTypes.string, initialItems: PropTypes.arrayOf(PropTypes.string), onChange: PropTypes.func }
