export interface PaymentRecord {
  id: string
  amount: number
  paid_on: string
  mode: string
  reference?: string
  note?: string
  receipt_number: string
  created_at: string
}

export interface FeeMetadata {
  agreed_fee?: string
  advance_received?: string
  fee_notes?: string
  payment_history?: PaymentRecord[]
  fee_follow_up_date?: string
  [key: string]: unknown
}

export function parseFeeMetadata(notes?: string | null): FeeMetadata {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes) as FeeMetadata
    return {
      ...parsed,
      payment_history: Array.isArray(parsed.payment_history)
        ? parsed.payment_history.filter(payment => payment && Number(payment.amount) > 0)
        : [],
    }
  } catch {
    return { legacy_notes: notes, payment_history: [] }
  }
}

export function feeNumbers(metadata: FeeMetadata) {
  const agreed = Math.max(Number(metadata.agreed_fee || 0), 0)
  const openingAdvance = Math.max(Number(metadata.advance_received || 0), 0)
  const laterPayments = (metadata.payment_history ?? []).reduce((total, payment) => total + Math.max(Number(payment.amount || 0), 0), 0)
  const received = openingAdvance + laterPayments
  return {
    agreed,
    openingAdvance,
    received,
    due: Math.max(agreed - received, 0),
  }
}

export function createReceiptNumber() {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `VS-${date}-${Date.now().toString().slice(-6)}`
}

export function currency(value: number) {
  return `₹${value.toLocaleString('en-IN')}`
}
