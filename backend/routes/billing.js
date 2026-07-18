/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express')
const { createClient } = require('@supabase/supabase-js')

function createBillingRoute() {
  const router = express.Router()
  router.use(async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
      if (!token) return res.status(401).json({ success: false, error: 'Sign in is required' })
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return res.status(401).json({ success: false, error: 'Invalid session' })
      const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
      if (!advocate) return res.status(404).json({ success: false, error: 'Advocate profile not found' })
      req.supabase = supabase; req.advocateId = advocate.id; next()
    } catch (error) { next(error) }
  })
  router.get('/api/billing', async (req, res) => {
    const { data, error } = await req.supabase.from('billing').select('*, cases!inner(case_number, case_title, advocate_id), clients(full_name, phone)').eq('cases.advocate_id', req.advocateId).order('due_date', { ascending: true })
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.json({ success: true, bills: data || [] })
  })
  router.post('/api/billing', async (req, res) => {
    const body = req.body || {}; const amount = Number(body.feeAmount)
    if (!body.caseId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, error: 'Case and a valid fee amount are required' })
    const { data: caseRow } = await req.supabase.from('cases').select('id, client_id').eq('id', body.caseId).eq('advocate_id', req.advocateId).single()
    if (!caseRow) return res.status(404).json({ success: false, error: 'Case not found' })
    const { data, error } = await req.supabase.from('billing').insert({ case_id: caseRow.id, client_id: body.clientId || caseRow.client_id || null, fee_amount: amount, fee_status: 'Pending', due_date: body.dueDate || null, notes: String(body.notes || '') }).select('*').single()
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.status(201).json({ success: true, bill: data })
  })
  router.patch('/api/billing/:id', async (req, res) => {
    const patch = {}; if (req.body.action === 'paid') Object.assign(patch, { fee_status: 'Paid', paid_date: new Date().toISOString().slice(0, 10), payment_mode: req.body.paymentMode || 'Cash' }); if (req.body.action === 'reminder') patch.reminder_sent = true
    const { data, error } = await req.supabase.from('billing').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single()
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.json({ success: true, bill: data })
  })
  return router
}
module.exports = { createBillingRoute }
