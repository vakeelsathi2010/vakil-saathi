'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, CreditCard, IndianRupee, Plus, ReceiptText, Trash2, WalletCards, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { createReceiptNumber, currency, feeNumbers, parseFeeMetadata, type FeeMetadata, type PaymentRecord } from '@/lib/fees'
import { useLanguage } from '@/components/LanguageProvider'

const GUEST_CASES_STORAGE_KEY = 'vakil_guest_cases_v2'
const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other']
const PAYMENT_MODE_HI: Record<string, string> = {
  Cash: 'नकद',
  UPI: 'UPI',
  'Bank Transfer': 'बैंक ट्रांसफर',
  Cheque: 'चेक',
  Other: 'अन्य',
}

function localDateKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface FeeLedgerProps {
  caseId: string
  caseNumber: string
  initialNotes?: string | null
  isGuest?: boolean
}

export default function FeeLedger({ caseId, caseNumber, initialNotes, isGuest = false }: FeeLedgerProps) {
  const { isHindi, tr } = useLanguage()
  const [metadata, setMetadata] = useState<FeeMetadata>(() => parseFeeMetadata(initialNotes))
  const [showForm, setShowForm] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [followUpDate, setFollowUpDate] = useState(String(metadata.fee_follow_up_date || ''))
  const [form, setForm] = useState({
    amount: '',
    paid_on: localDateKey(),
    mode: 'Cash',
    reference: '',
    note: '',
  })
  const [termsForm, setTermsForm] = useState({
    agreed_fee: String(metadata.agreed_fee || ''),
    advance_received: String(metadata.advance_received || ''),
    fee_notes: String(metadata.fee_notes || ''),
  })

  const totals = useMemo(() => feeNumbers(metadata), [metadata])
  const payments = useMemo(() => [...(metadata.payment_history ?? [])].sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at)), [metadata.payment_history])

  async function persist(nextMetadata: FeeMetadata) {
    if (isGuest) {
      try {
        const stored = window.sessionStorage.getItem(GUEST_CASES_STORAGE_KEY)
        const cases = stored ? JSON.parse(stored) as Array<{ id: string; notes?: string }> : []
        const nextCases = cases.map(caseItem => caseItem.id === caseId ? { ...caseItem, notes: JSON.stringify(nextMetadata) } : caseItem)
        window.sessionStorage.setItem(GUEST_CASES_STORAGE_KEY, JSON.stringify(nextCases))
        setMetadata(nextMetadata)
        return true
      } catch {
        toast.error(tr('Guest payment could not be saved', 'गेस्ट भुगतान सेव नहीं हो सका'))
        return false
      }
    }

    const supabase = createClient()
    const { error } = await supabase.from('cases').update({ notes: JSON.stringify(nextMetadata) }).eq('id', caseId)
    if (error) {
      toast.error(tr('Payment could not be saved: ', 'भुगतान सेव नहीं हो सका: ') + error.message)
      return false
    }
    setMetadata(nextMetadata)
    return true
  }

  async function addPayment(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(tr('Enter a valid payment amount', 'सही भुगतान राशि दर्ज करें'))
      return
    }
    if (!form.paid_on) {
      toast.error(tr('Select the payment date', 'भुगतान की तारीख चुनें'))
      return
    }
    if (totals.agreed > 0 && amount > totals.due) {
      toast.error(tr(`Amount cannot exceed the outstanding balance of ${currency(totals.due)}`, `राशि ${currency(totals.due)} के बकाया से अधिक नहीं हो सकती`))
      return
    }

    const payment: PaymentRecord = {
      id: `payment-${Date.now()}`,
      amount,
      paid_on: form.paid_on,
      mode: form.mode,
      reference: form.reference.trim() || undefined,
      note: form.note.trim() || undefined,
      receipt_number: createReceiptNumber(),
      created_at: new Date().toISOString(),
    }
    const nextMetadata: FeeMetadata = { ...metadata, payment_history: [...(metadata.payment_history ?? []), payment] }
    setSaving(true)
    const saved = await persist(nextMetadata)
    setSaving(false)
    if (!saved) return
    toast.success(tr(`Payment recorded · ${payment.receipt_number}`, `भुगतान दर्ज हुआ · ${payment.receipt_number}`))
    setForm({ amount: '', paid_on: localDateKey(), mode: 'Cash', reference: '', note: '' })
    setShowForm(false)
  }

  async function saveFeeTerms(event: React.FormEvent) {
    event.preventDefault()
    const agreed = Number(termsForm.agreed_fee)
    const openingAdvance = Number(termsForm.advance_received || 0)
    const recordedPayments = (metadata.payment_history ?? []).reduce((total, payment) => total + Number(payment.amount || 0), 0)
    if (!Number.isFinite(agreed) || agreed <= 0) {
      toast.error(tr('Enter a valid agreed fee', 'सही तय फीस दर्ज करें'))
      return
    }
    if (!Number.isFinite(openingAdvance) || openingAdvance < 0) {
      toast.error(tr('Enter a valid opening advance', 'सही प्रारंभिक अग्रिम दर्ज करें'))
      return
    }
    if (openingAdvance + recordedPayments > agreed) {
      toast.error(tr('Agreed fee cannot be lower than payments already received', 'तय फीस पहले से प्राप्त भुगतानों से कम नहीं हो सकती'))
      return
    }
    const nextMetadata: FeeMetadata = {
      ...metadata,
      agreed_fee: String(agreed),
      advance_received: openingAdvance ? String(openingAdvance) : '',
      fee_notes: termsForm.fee_notes.trim(),
    }
    setSaving(true)
    const saved = await persist(nextMetadata)
    setSaving(false)
    if (!saved) return
    toast.success(tr('Fee terms updated', 'फीस की शर्तें अपडेट हो गईं'))
    setShowTerms(false)
  }

  async function deletePayment(payment: PaymentRecord) {
    if (!window.confirm(tr(`Delete payment ${currency(payment.amount)}?`, `${currency(payment.amount)} का भुगतान हटाएँ?`))) return
    setSaving(true)
    const saved = await persist({ ...metadata, payment_history: (metadata.payment_history ?? []).filter(item => item.id !== payment.id) })
    setSaving(false)
    if (saved) toast.success(tr('Payment entry deleted', 'भुगतान प्रविष्टि हटा दी गई'))
  }

  async function saveFollowUp() {
    setSaving(true)
    const saved = await persist({ ...metadata, fee_follow_up_date: followUpDate || undefined })
    setSaving(false)
    if (saved) toast.success(followUpDate ? tr('Payment follow-up scheduled', 'भुगतान फॉलो-अप तय हो गया') : tr('Payment follow-up cleared', 'भुगतान फॉलो-अप हटा दिया गया'))
  }

  const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <section id="fees" className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><WalletCards className="h-5 w-5" /></div>
          <div>
            <h2 className="font-bold text-gray-900">{tr('Fee & Payment Ledger', 'फीस और भुगतान खाता')}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{caseNumber} · {tr('Case-wise payment history', 'केस के अनुसार भुगतान इतिहास')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowTerms(open => !open)} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
            {showTerms ? <X className="h-4 w-4" /> : <IndianRupee className="h-4 w-4" />}{showTerms ? tr('Close', 'बंद करें') : totals.agreed ? tr('Edit Terms', 'शर्तें बदलें') : tr('Set Fee Terms', 'फीस तय करें')}
          </button>
          <button type="button" onClick={() => setShowForm(open => !open)} disabled={saving || totals.due === 0} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? tr('Close', 'बंद करें') : tr('Record Payment', 'भुगतान दर्ज करें')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        <div className="p-3 text-center sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{tr('Agreed Fee', 'तय फीस')}</p><p className="mt-1 text-base font-extrabold text-gray-900 sm:text-xl">{currency(totals.agreed)}</p></div>
        <div className="p-3 text-center sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">{tr('Received', 'प्राप्त')}</p><p className="mt-1 text-base font-extrabold text-emerald-700 sm:text-xl">{currency(totals.received)}</p></div>
        <div className="p-3 text-center sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">{tr('Outstanding', 'बकाया')}</p><p className="mt-1 text-base font-extrabold text-orange-600 sm:text-xl">{currency(totals.due)}</p></div>
      </div>

      {showTerms && (
        <form onSubmit={saveFeeTerms} className="border-b border-blue-100 bg-blue-50/50 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><IndianRupee className="h-4 w-4 text-blue-700" /><h3 className="text-sm font-bold text-gray-900">{tr('Fee Agreement', 'फीस समझौता')}</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs font-semibold text-gray-600">{tr('Agreed Professional Fee', 'तय पेशेवर फीस')} *</label><input type="number" min="1" value={termsForm.agreed_fee} onChange={event => setTermsForm(current => ({ ...current, agreed_fee: event.target.value }))} placeholder="₹ 0" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-gray-600">{tr('Opening Advance Received', 'प्रारंभिक अग्रिम प्राप्त')}</label><input type="number" min="0" value={termsForm.advance_received} onChange={event => setTermsForm(current => ({ ...current, advance_received: event.target.value }))} placeholder="₹ 0" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500" /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold text-gray-600">{tr('Fee Agreement / Instalment Note', 'फीस समझौता / किस्त टिप्पणी')}</label><input value={termsForm.fee_notes} onChange={event => setTermsForm(current => ({ ...current, fee_notes: event.target.value }))} placeholder={tr('e.g. Three instalments, court expenses separate', 'जैसे तीन किस्तें, न्यायालय खर्च अलग')} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500" /></div>
          </div>
          <div className="mt-4 flex justify-end"><button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? tr('Saving...', 'सेव हो रहा है...') : tr('Save Fee Terms', 'फीस की शर्तें सेव करें')}</button></div>
        </form>
      )}

      {showForm && (
        <form onSubmit={addPayment} className="border-b border-emerald-100 bg-emerald-50/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-700" /><h3 className="text-sm font-bold text-gray-900">{tr('New Payment Entry', 'नई भुगतान प्रविष्टि')}</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs font-semibold text-gray-600">{tr('Amount', 'राशि')} *</label><input type="number" min="1" max={totals.due || undefined} value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} placeholder="₹ 0" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-gray-600">{tr('Payment Date', 'भुगतान तारीख')} *</label><input type="date" value={form.paid_on} onChange={event => setForm(current => ({ ...current, paid_on: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-gray-600">{tr('Payment Mode', 'भुगतान माध्यम')}</label><select value={form.mode} onChange={event => setForm(current => ({ ...current, mode: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500">{PAYMENT_MODES.map(mode => <option key={mode} value={mode}>{isHindi ? PAYMENT_MODE_HI[mode] : mode}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-semibold text-gray-600">{tr('Reference / Cheque No.', 'रेफरेंस / चेक नंबर')}</label><input value={form.reference} onChange={event => setForm(current => ({ ...current, reference: event.target.value }))} placeholder={tr('Optional transaction reference', 'वैकल्पिक ट्रांजैक्शन रेफरेंस')} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500" /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold text-gray-600">{tr('Payment Note', 'भुगतान टिप्पणी')}</label><input value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} placeholder={tr('Instalment, court expense or other note', 'किस्त, न्यायालय खर्च या अन्य टिप्पणी')} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500" /></div>
          </div>
          <div className="mt-4 flex justify-end"><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? tr('Saving...', 'सेव हो रहा है...') : tr('Save Payment & Generate Receipt No.', 'भुगतान सेव करें और रसीद नंबर बनाएँ')}</button></div>
        </form>
      )}

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1"><label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-blue-800"><CalendarClock className="h-3.5 w-3.5" />{tr('Next Payment Follow-up', 'अगला भुगतान फॉलो-अप')}</label><input type="date" value={followUpDate} onChange={event => setFollowUpDate(event.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm sm:max-w-xs" /></div>
          <button type="button" onClick={saveFollowUp} disabled={saving} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60">{tr('Save Follow-up', 'फॉलो-अप सेव करें')}</button>
        </div>

        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-gray-900">{tr('Payment History', 'भुगतान इतिहास')}</h3><span className="text-xs text-gray-400">{payments.length + (totals.openingAdvance > 0 ? 1 : 0)} {tr('entries', 'प्रविष्टियाँ')}</span></div>
        {payments.length === 0 && totals.openingAdvance === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center"><ReceiptText className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-2 text-sm font-medium text-gray-500">{tr('No payment recorded yet', 'अभी कोई भुगतान दर्ज नहीं है')}</p></div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
            {totals.openingAdvance > 0 && (
              <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" /><div><p className="text-sm font-bold text-gray-800">{tr('Opening Advance', 'प्रारंभिक अग्रिम')}</p><p className="text-[11px] text-gray-400">{tr('Recorded when the case was created', 'केस बनाते समय दर्ज')}</p></div></div><p className="font-extrabold text-emerald-700">{currency(totals.openingAdvance)}</p></div>
            )}
            {payments.map(payment => (
              <div key={payment.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="flex min-w-0 items-start gap-3"><div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50"><IndianRupee className="h-4 w-4 text-emerald-600" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-gray-900">{currency(payment.amount)}</p><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{isHindi ? PAYMENT_MODE_HI[payment.mode] || payment.mode : payment.mode}</span></div><p className="mt-0.5 text-xs text-gray-500">{formatDate(payment.paid_on)} · {payment.receipt_number}</p>{payment.reference && <p className="mt-0.5 truncate text-[11px] text-gray-400">Ref: {payment.reference}</p>}{payment.note && <p className="mt-1 text-xs text-gray-600">{payment.note}</p>}</div></div>
                <button type="button" onClick={() => deletePayment(payment)} disabled={saving} aria-label={tr('Delete payment', 'भुगतान हटाएँ')} className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        {metadata.fee_notes && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600"><strong>{tr('Fee note:', 'फीस टिप्पणी:')}</strong> {String(metadata.fee_notes)}</p>}
      </div>
    </section>
  )
}
