/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express')
const { createClient } = require('@supabase/supabase-js')

function toJudge(row) {
  return { id: row.id, name: row.name, court: row.court, bailGrantRate: row.bail_grant_rate, avgCaseDuration: row.avg_case_duration, totalCases: row.total_cases, worksOn: row.works_on || [], preferences: row.preferences, tips: row.tips || [], workingHours: row.working_hours, caseTypeSuccess: row.case_type_success || {}, rating: row.rating, source: row.source }
}

function createJudgesRoute() {
  const router = express.Router()
  router.use(async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
      if (!token) return res.status(401).json({ success: false, error: 'Sign in is required' })
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return res.status(401).json({ success: false, error: 'Invalid session' })
      const { data: advocate, error } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
      if (error || !advocate) return res.status(404).json({ success: false, error: 'Advocate profile not found' })
      req.supabase = supabase; req.advocateId = advocate.id; next()
    } catch (error) { next(error) }
  })

  router.get('/api/judges', async (req, res) => {
    const query = req.supabase.from('judges').select('*').eq('advocate_id', req.advocateId).order('name')
    if (req.query.court) query.ilike('court', `%${String(req.query.court)}%`)
    const { data, error } = await query
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.json({ success: true, judges: data.map(toJudge) })
  })

  router.post('/api/judges', async (req, res) => {
    const body = req.body || {}
    const name = String(body.name || '').trim(); const court = String(body.court || '').trim()
    if (!name || !court) return res.status(400).json({ success: false, error: 'Judge name and court are required' })
    const rate = body.bailGrantRate == null || body.bailGrantRate === '' ? null : Number(body.bailGrantRate)
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) return res.status(400).json({ success: false, error: 'Bail outcome record must be between 0 and 100' })
    const payload = { advocate_id: req.advocateId, name, court, bail_grant_rate: rate, avg_case_duration: body.avgCaseDuration || null, total_cases: Number(body.totalCases) || 0, works_on: Array.isArray(body.worksOn) ? body.worksOn : [], preferences: body.preferences || null, tips: Array.isArray(body.tips) ? body.tips : [], working_hours: body.workingHours || null, case_type_success: body.caseTypeSuccess || {}, source: 'manual', updated_at: new Date().toISOString() }
    const { data, error } = await req.supabase.from('judges').upsert(payload, { onConflict: 'advocate_id,name,court' }).select('*').single()
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.status(201).json({ success: true, judge: toJudge(data) })
  })
  return router
}

module.exports = { createJudgesRoute, toJudge }
