/* eslint-disable @typescript-eslint/no-require-imports */
const firebaseAdmin = require('firebase-admin')
const TYPE_PREFERENCE = { reminder: 'reminders_enabled', case_update: 'case_updates_enabled', client_message: 'client_messages_enabled', urgent: 'urgent_enabled' }
function getMessaging() {
  if (firebaseAdmin.apps.length) return firebaseAdmin.messaging()
  const projectId = process.env.FIREBASE_PROJECT_ID; const clientEmail = process.env.FIREBASE_CLIENT_EMAIL; const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) return null
  firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert({ projectId, clientEmail, privateKey }) }); return firebaseAdmin.messaging()
}
function isQuietHour(preferences, date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(date)); const start = Number(String(preferences.quiet_start || '22:00').slice(0, 2)); const end = Number(String(preferences.quiet_end || '07:00').slice(0, 2))
  return start > end ? hour >= start || hour < end : hour >= start && hour < end
}
async function sendNotification(supabase, userId, message, data = {}) {
  if (!supabase || !userId) throw new Error('Supabase client and user ID are required')
  const type = data.type || 'reminder'; const title = message.title || 'VakilSaathi'; const body = message.body || String(message)
  const [{ data: preferences }, { data: devices, error: deviceError }] = await Promise.all([supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(), supabase.from('notification_devices').select('id, token').eq('user_id', userId)])
  if (deviceError) throw deviceError
  const prefs = preferences || { reminders_enabled: true, case_updates_enabled: true, client_messages_enabled: true, urgent_enabled: true, sound_enabled: true, vibration_enabled: true, quiet_start: '22:00', quiet_end: '07:00' }
  const muted = !prefs[TYPE_PREFERENCE[type] || 'reminders_enabled'] || (type !== 'urgent' && isQuietHour(prefs)); let status = muted ? 'queued' : 'sent'; const failures = []; const messaging = muted ? null : getMessaging()
  if (!muted && messaging) for (const device of devices || []) { try { await messaging.send({ token: device.token, notification: { title, body }, data: Object.fromEntries(Object.entries({ ...data, type }).map(([key, value]) => [key, String(value)])), android: { priority: type === 'urgent' ? 'high' : 'normal', notification: { sound: prefs.sound_enabled ? 'default' : undefined, vibrateTimingsMillis: prefs.vibration_enabled ? [0, 300, 200, 300] : undefined } } }) } catch (error) { failures.push(error instanceof Error ? error.message : 'FCM send failed') } }
  if (!muted && !messaging) status = 'queued'; if (failures.length) status = 'failed'
  const { data: event, error: logError } = await supabase.from('notification_events').insert({ user_id: userId, type, title, body, data, status, delivery_error: failures.join('; ') || null }).select().single()
  if (logError) throw logError
  return { success: status !== 'failed', status, event, sentTo: devices?.length || 0, failures }
}
module.exports = { sendNotification, isQuietHour }
