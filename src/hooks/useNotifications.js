'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export function useNotifications() {
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const loadEvents = useCallback(async () => {
    const supabase = createClient(); const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setEvents([]); setLoading(false); return }
    const { data } = await supabase.from('notification_events').select('id, type, title, body, data, status, created_at, read_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50)
    setEvents(data || []); setLoading(false)
  }, [])
  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents()
  }, [loadEvents])
  useEffect(() => {
    let unsubscribe
    async function listen() {
      const { getFirebaseMessaging } = await import('@/src/firebase-config'); const { onMessage } = await import('firebase/messaging'); const messaging = await getFirebaseMessaging()
      if (messaging) unsubscribe = onMessage(messaging, payload => { toast.success(`${payload.notification?.title || 'VakilSaathi update'}: ${payload.notification?.body || ''}`); loadEvents() })
    }
    listen(); return () => unsubscribe?.()
  }, [loadEvents])
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') throw new Error('Notifications are not supported in this browser')
    const nextPermission = await Notification.requestPermission(); setPermission(nextPermission)
    if (nextPermission !== 'granted') throw new Error('Notification permission was not granted')
    const [{ getFirebaseMessaging, isFirebaseConfigured }, { getToken }] = await Promise.all([import('@/src/firebase-config'), import('firebase/messaging')])
    if (!isFirebaseConfigured) throw new Error('Firebase configuration is not ready yet')
    const messaging = await getFirebaseMessaging(); if (!messaging) throw new Error('Push notifications are not supported in this browser')
    const workerUrl = new URL('/firebase-messaging-sw.js', window.location.origin)
    workerUrl.searchParams.set('apiKey', process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '')
    workerUrl.searchParams.set('authDomain', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '')
    workerUrl.searchParams.set('projectId', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '')
    workerUrl.searchParams.set('messagingSenderId', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '')
    workerUrl.searchParams.set('appId', process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '')
    const registration = await navigator.serviceWorker.register(`${workerUrl.pathname}${workerUrl.search}`)
    const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration })
    if (!token) throw new Error('Could not get a device notification token')
    const supabase = createClient(); const { data: { session } } = await supabase.auth.getSession(); if (!session?.user) throw new Error('Please sign in first')
    const { error } = await supabase.from('notification_devices').upsert({ user_id: session.user.id, token, platform: 'web', last_seen_at: new Date().toISOString() }, { onConflict: 'token' })
    if (error) throw error
    toast.success('Push notifications enabled on this device'); return token
  }, [])
  const markRead = useCallback(async eventId => {
    const supabase = createClient(); const { error } = await supabase.from('notification_events').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', eventId)
    if (error) throw error
    setEvents(current => current.map(item => item.id === eventId ? { ...item, status: 'read', read_at: new Date().toISOString() } : item))
  }, [])
  return { permission, events, unreadCount: events.filter(item => item.status !== 'read').length, loading, requestPermission, markRead, refresh: loadEvents }
}
