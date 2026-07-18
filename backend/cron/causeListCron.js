/* eslint-disable @typescript-eslint/no-require-imports */
const cron = require('node-cron')
const { format } = require('date-fns')
const { createClient } = require('@supabase/supabase-js')
const { syncCauseList } = require('../functions/causeListScraper')

function createCauseListCron({ supabase, urlTemplate, courtName = 'Kanpur Court' }) {
  if (!supabase || !urlTemplate) throw new Error('Supabase and CAUSE_LIST_URL_TEMPLATE are required')
  return cron.schedule('0 8 * * *', async () => {
    const causeDate = format(new Date(), 'yyyy-MM-dd')
    try {
      const result = await syncCauseList({ supabase, urlTemplate, causeDate, courtName })
      console.info('Cause list sync finished', result)
    } catch (error) {
      console.error('Cause list sync failed', error.message)
    }
  }, { timezone: 'Asia/Kolkata' })
}

function start() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const urlTemplate = process.env.CAUSE_LIST_URL_TEMPLATE
  if (!url || !serviceRoleKey || !urlTemplate) throw new Error('Cause list scheduler environment is not configured')
  return createCauseListCron({
    supabase: createClient(url, serviceRoleKey),
    urlTemplate,
    courtName: process.env.CAUSE_LIST_COURT_NAME || 'Kanpur Court',
  })
}

if (require.main === module) start()

module.exports = { createCauseListCron, start }
