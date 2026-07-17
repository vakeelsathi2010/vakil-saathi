/* eslint-disable @typescript-eslint/no-require-imports */
const cron = require('node-cron')
const firebaseAdmin = require('firebase-admin')

const IST_OFFSET = '+05:30'

const CASE_MESSAGES = {
  Bail: [
    '{caseLabel} - 3 दिन बाकी जमानत की तैयारी के लिए',
    '{caseLabel} - कल deadline है! Surety aur bail papers follow up karein.',
    '{caseLabel} - आज जमानत की तैयारी पूरी करो.',
  ],
  Property: [
    '{caseLabel} - Court decision आने वाला है 3 दिन में.',
    'Property case - कल judge का फैसला है!',
    '{caseLabel} - आज arguments की तैयारी पूरी करो.',
  ],
  Criminal: [
    '{caseLabel} - 3 दिन बाकी witness examination के लिए.',
    '{caseLabel} - कल witness examination है - तैयारी करो!',
    '{caseLabel} - आज witness से अंतिम बार मिल लो.',
  ],
  Civil: [
    '{caseLabel} - 3 दिन बाकी documents तैयार करने के लिए.',
    '{caseLabel} - कल document submission deadline है!',
    '{caseLabel} - आज next arguments की तैयारी पूरी करो.',
  ],
}

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00${IST_OFFSET}`)
  return Number.isNaN(parsed.getTime()) ? null : value
}

function addDays(date, amount) {
  const value = new Date(`${date}T00:00:00${IST_OFFSET}`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function scheduledAt(date, hour) {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00${IST_OFFSET}`).toISOString()
}

function displayTime(iso) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  }).format(new Date(iso))
}

function reminderSpecs(deadline, caseType, caseLabel) {
  const templates = CASE_MESSAGES[caseType] || CASE_MESSAGES.Civil
  const label = String(caseLabel || 'Case').trim()
  const message = index => templates[index].replaceAll('{caseLabel}', label)
  return [
    { level: 1, scheduledTime: scheduledAt(addDays(deadline, -3), 9), message: message(0), type: 'INFO', color: 'yellow', sound: 'none', vibration: false, action: 'Just notify' },
    { level: 2, scheduledTime: scheduledAt(addDays(deadline, -1), 17), message: message(1), type: 'WARNING', color: 'orange', sound: 'default', vibration: false, action: 'Recommend follow-up call to client' },
    { level: 3, scheduledTime: scheduledAt(deadline, 7), message: message(2), type: 'CRITICAL', color: 'red', sound: 'default', vibration: true, action: 'Do now' },
  ]
}

/**
 * Create all three reminder records in one insert. Passing a Supabase client
 * keeps credentials outside this module and allows Netlify/server jobs to use
 * their secure service-role client.
 */
async function scheduleReminders(caseId, deadline, caseType, advocatePhone, options = {}) {
  if (!caseId || typeof caseId !== 'string') return { success: false, error: 'Case ID is required' }
  if (!dateKey(deadline)) return { success: false, error: 'Deadline must use YYYY-MM-DD format' }
  if (!options.supabase) return { success: false, error: 'Supabase client is required' }

  const specs = reminderSpecs(deadline, caseType, options.caseLabel || caseId)
  const records = specs.map(spec => ({
    case_id: caseId,
    level: spec.level,
    scheduled_time: spec.scheduledTime,
    message: spec.message,
    status: 'pending',
    advocate_phone: advocatePhone || null,
    fcm_token: options.fcmToken || null,
    payload: { type: spec.type, color: spec.color, sound: spec.sound, vibration: spec.vibration, action: spec.action },
  }))

  // A single multi-row insert is atomic in PostgreSQL: all three records are
  // created together or none are created if the query fails.
  const { data, error } = await options.supabase.from('reminders').insert(records).select('id, level, scheduled_time, message')
  if (error) return { success: false, error: error.message }

  return {
    success: true,
    caseId,
    remindersCreated: data.length,
    details: data.map(reminder => ({ level: reminder.level, reminderId: reminder.id, scheduledFor: displayTime(reminder.scheduled_time), message: reminder.message })),
  }
}

function getMessaging() {
  if (firebaseAdmin.apps.length) return firebaseAdmin.messaging()
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) return null
  firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert({ projectId, clientEmail, privateKey }) })
  return firebaseAdmin.messaging()
}

async function sendReminderNotification(reminder, messaging = getMessaging()) {
  if (!messaging) throw new Error('Firebase Messaging is not configured')
  if (!reminder.fcm_token) throw new Error('Advocate device token is missing')
  const payload = reminder.payload || {}
  await messaging.send({
    token: reminder.fcm_token,
    notification: { title: `${payload.type || 'Reminder'}: VakilSaathi`, body: reminder.message },
    data: { reminderId: reminder.id, caseId: reminder.case_id, level: String(reminder.level), action: payload.action || 'Open app' },
    android: { priority: reminder.level === 3 ? 'high' : 'normal', notification: { sound: payload.sound === 'none' ? undefined : 'default', color: payload.color === 'red' ? '#dc2626' : payload.color === 'orange' ? '#ea580c' : '#ca8a04', vibrateTimingsMillis: payload.vibration ? [0, 500, 250, 500] : undefined } },
  })
}

async function processDueReminders({ supabase, messaging, now = new Date() }) {
  if (!supabase) throw new Error('Supabase client is required')
  const { data: reminders, error } = await supabase.from('reminders').select('*').eq('status', 'pending').lte('scheduled_time', now.toISOString()).lt('retry_count', 3)
  if (error) throw error
  const results = []
  for (const reminder of reminders || []) {
    try {
      await sendReminderNotification(reminder, messaging)
      await supabase.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', reminder.id)
      results.push({ id: reminder.id, status: 'sent' })
    } catch (error) {
      const nextRetryCount = Number(reminder.retry_count || 0) + 1
      const retryAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const status = nextRetryCount >= 3 ? 'failed' : 'pending'
      await supabase.from('reminders').update({ status, retry_count: nextRetryCount, scheduled_time: status === 'pending' ? retryAt : reminder.scheduled_time, last_error: error instanceof Error ? error.message : 'Notification failed' }).eq('id', reminder.id)
      results.push({ id: reminder.id, status, retryCount: nextRetryCount })
    }
  }
  return { success: true, processed: results.length, results }
}

async function snoozeReminder(reminderId, options = {}) {
  if (!reminderId || !options.supabase) return { success: false, error: 'Reminder ID and Supabase client are required' }
  const { data: reminder, error } = await options.supabase.from('reminders').select('id, level, status').eq('id', reminderId).single()
  if (error || !reminder) return { success: false, error: 'Reminder not found' }
  if (reminder.level !== 2) return { success: false, error: 'Only Level 2 reminders can be snoozed' }
  if (reminder.status !== 'pending') return { success: false, error: 'Only pending reminders can be snoozed' }
  const scheduledTime = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const { error: updateError } = await options.supabase.from('reminders').update({ scheduled_time: scheduledTime, snoozed_until: scheduledTime }).eq('id', reminderId)
  if (updateError) return { success: false, error: updateError.message }
  return { success: true, reminderId, scheduledFor: displayTime(scheduledTime) }
}

function startReminderCron({ supabase, messaging, timezone = 'Asia/Kolkata' }) {
  return cron.schedule('0 * * * *', () => {
    processDueReminders({ supabase, messaging }).catch(error => console.error('Reminder scheduler failed:', error.message))
  }, { timezone })
}

module.exports = { scheduleReminders, processDueReminders, snoozeReminder, startReminderCron, reminderSpecs }
