/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js')
const { startReminderCron } = require('../functions/reminderScheduler')

// Start this only in a persistent Node worker. Netlify serverless functions do
// not keep a node-cron process alive; production Netlify should invoke a secure
// scheduled API route hourly instead.
function start() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase scheduler environment is not configured')
  const supabase = createClient(url, serviceRoleKey)
  return startReminderCron({ supabase })
}

if (require.main === module) start()

module.exports = { start }
