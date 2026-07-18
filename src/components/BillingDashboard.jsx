'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, IndianRupee, Plus, ReceiptText, Send, WalletCards } from 'lucide-react'
import { jsPDF } from 'jspdf'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const EMPTY_FORM = { caseId: '', feeAmount: '', dueDate: '', notes: '' }
const money = value => `\u20B9${Number(value || 0).toLocaleString('en-IN')}`

export default function BillingDashboard() {
  const [bills, setBills] = useState([])
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setLoading(false)

    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
    if (!advocate) return setLoading(false)

    const [billResult, caseResult] = await Promise.all([
      supabase.from('billing').select('*, cases(case_number, case_title), clients(full_name, phone)').order('due_date', { ascending: true }),
      supabase.from('cases').select('id, case_number, case_title, client_id').eq('advocate_id', advocate.id).order('created_at', { ascending: false }),
    ])

    if (billResult.error) {
      toast.error(billResult.error.code === '42P01' ? 'Billing table is not ready. Run migration 009 first.' : billResult.error.message)
    } else {
      setBills(billResult.data || [])
    }
    setCases(caseResult.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const totals = useMemo(() => bills.reduce((sum, bill) => {
    const amount = Number(bill.fee_amount)
    sum.total += amount
    if (bill.fee_status === 'Paid') sum.collected += amount
    else sum.pending += amount
    return sum
  }, { total: 0, collected: 0, pending: 0 }), [bills])

  const pending = bills.filter(bill => bill.fee_status === 'Pending')
  const clientBreakdown = useMemo(() => Object.values(bills.reduce((grouped, bill) => {
    const name = bill.clients?.full_name || 'Unassigned client'
    if (!grouped[name]) grouped[name] = { name, total: 0, pending: 0 }
    grouped[name].total += Number(bill.fee_amount || 0)
    if (bill.fee_status === 'Pending') grouped[name].pending += Number(bill.fee_amount || 0)
    return grouped
  }, {})), [bills])

  const saveBill = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const selected = cases.find(caseItem => caseItem.id === form.caseId)
      if (!selected) throw new Error('Select a case')
      const supabase = createClient()
      const { error } = await supabase.from('billing').insert({
        case_id: selected.id,
        client_id: selected.client_id || null,
        fee_amount: Number(form.feeAmount),
        fee_status: 'Pending',
        due_date: form.dueDate || null,
        notes: form.notes || '',
      })
      if (error) throw error
      toast.success('Fee entry added')
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add fee')
    } finally {
      setSaving(false)
    }
  }

  const updateBill = async (id, updates, successMessage) => {
    const supabase = createClient()
    const { error } = await supabase.from('billing').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success(successMessage)
    await load()
  }

  const exportCsv = () => {
    const rows = [['Case', 'Client', 'Amount', 'Status', 'Due date'], ...bills.map(bill => [bill.cases?.case_number || '', bill.clients?.full_name || '', bill.fee_amount, bill.fee_status, bill.due_date || ''])]
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = `vakil-saathi-billing-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const invoice = bill => {
    const pdf = new jsPDF()
    pdf.setFontSize(20)
    pdf.text('VakilSaathi Fee Invoice', 20, 25)
    pdf.setFontSize(12)
    pdf.text(`Case: ${bill.cases?.case_number || '-'}`, 20, 45)
    pdf.text(`Client: ${bill.clients?.full_name || '-'}`, 20, 55)
    pdf.text(`Fee amount: ${money(bill.fee_amount)}`, 20, 65)
    pdf.text(`Status: ${bill.fee_status}`, 20, 75)
    pdf.text(`Due date: ${bill.due_date || 'Not set'}`, 20, 85)
    if (bill.notes) pdf.text(`Notes: ${bill.notes}`, 20, 100, { maxWidth: 170 })
    pdf.save(`invoice-${bill.cases?.case_number || bill.id}.pdf`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><IndianRupee className="h-6 w-6 text-emerald-600" />Fees & Payments</h1>
          <p className="mt-1 text-sm text-slate-500">Track case fees, payments, due dates and follow-ups.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"><Download className="h-4 w-4" />Export</button>
          <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" />Add Fee</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total Fees" value={money(totals.total)} color="blue" />
        <Stat label={`Collected (${totals.total ? Math.round((totals.collected / totals.total) * 100) : 0}%)`} value={money(totals.collected)} color="green" />
        <Stat label={`Pending (${totals.total ? Math.round((totals.pending / totals.total) * 100) : 0}%)`} value={money(totals.pending)} color="orange" />
      </div>

      {showForm && <form onSubmit={saveBill} className="mt-6 grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 md:grid-cols-2">
        <select required value={form.caseId} onChange={event => setForm({ ...form, caseId: event.target.value })} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Select case</option>{cases.map(caseItem => <option key={caseItem.id} value={caseItem.id}>{caseItem.case_number} - {caseItem.case_title || 'Untitled case'}</option>)}</select>
        <input required min="1" type="number" value={form.feeAmount} onChange={event => setForm({ ...form, feeAmount: event.target.value })} placeholder="Fee amount" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5" />
        <input type="date" value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5" />
        <input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Notes (optional)" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5" />
        <button disabled={saving} className="md:col-span-2 rounded-xl bg-emerald-600 py-3 font-bold text-white">{saving ? 'Saving...' : 'Save Fee Entry'}</button>
      </form>}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Action items</h2><p className="mt-1 text-sm text-slate-500">Pending client payments that need a follow-up.</p></div>
        {loading ? <div className="h-40 animate-pulse bg-slate-50" /> : pending.length ? <div className="divide-y divide-slate-100">{pending.map(bill => <BillRow key={bill.id} bill={bill} onPaid={() => updateBill(bill.id, { fee_status: 'Paid', paid_date: new Date().toISOString().slice(0, 10), payment_mode: 'Cash' }, 'Payment marked as paid')} onReminder={() => updateBill(bill.id, { reminder_sent: true }, 'Reminder marked as sent')} onInvoice={() => invoice(bill)} />)}</div> : <Empty message="No pending fees. Everything is up to date." />}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Client-wise breakdown</h2></div>
        {clientBreakdown.length ? <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{clientBreakdown.map(client => <div key={client.name} className="rounded-xl bg-slate-50 p-4"><p className="font-bold text-slate-900">{client.name}</p><p className="mt-1 text-sm text-slate-500">Total: {money(client.total)}</p><p className="text-sm font-medium text-orange-700">Pending: {money(client.pending)}</p></div>)}</div> : <Empty message="Client-wise totals will appear after you add fees." />}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">All billing records</h2></div>
        {bills.length ? <div className="divide-y divide-slate-100">{bills.map(bill => <BillRow key={bill.id} bill={bill} onPaid={() => updateBill(bill.id, { fee_status: 'Paid', paid_date: new Date().toISOString().slice(0, 10), payment_mode: 'Cash' }, 'Payment marked as paid')} onReminder={() => updateBill(bill.id, { reminder_sent: true }, 'Reminder marked as sent')} onInvoice={() => invoice(bill)} />)}</div> : !loading && <Empty message="No fee entries yet. Add the first fee for a case." />}
      </section>
    </div>
  )
}

function Stat({ label, value, color }) {
  const colors = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', orange: 'bg-orange-50 text-orange-700' }
  return <div className={`rounded-2xl p-5 ${colors[color]}`}><p className="text-sm font-medium">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>
}

function Empty({ message }) {
  return <div className="p-10 text-center text-sm text-slate-500"><WalletCards className="mx-auto mb-2 h-8 w-8 text-emerald-500" />{message}</div>
}

function BillRow({ bill, onPaid, onReminder, onInvoice }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-bold text-slate-900">{bill.cases?.case_number || 'Case'} <span className="font-normal text-slate-500">- {bill.clients?.full_name || 'Client'}</span></p><p className="mt-1 text-sm text-slate-500">Due: {bill.due_date || 'Not set'} - {money(bill.fee_amount)}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${bill.fee_status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{bill.fee_status}</span>{bill.fee_status === 'Pending' && <><button type="button" onClick={onReminder} className="rounded-lg border border-orange-200 p-2 text-orange-700" title="Mark reminder sent"><Send className="h-4 w-4" /></button><button type="button" onClick={onPaid} className="rounded-lg border border-emerald-200 p-2 text-emerald-700" title="Mark paid"><IndianRupee className="h-4 w-4" /></button></>}<button type="button" onClick={onInvoice} className="rounded-lg border border-blue-200 p-2 text-blue-700" title="Download invoice"><ReceiptText className="h-4 w-4" /></button></div></div>
}
