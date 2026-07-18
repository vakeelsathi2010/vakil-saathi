/* global importScripts, firebase */
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js')
const config = new URL(self.location.href).searchParams
firebase.initializeApp({ apiKey: config.get('apiKey'), authDomain: config.get('authDomain'), projectId: config.get('projectId'), messagingSenderId: config.get('messagingSenderId'), appId: config.get('appId') })
const messaging = firebase.messaging()
messaging.onBackgroundMessage(payload => self.registration.showNotification(payload.notification?.title || 'VakilSaathi', { body: payload.notification?.body || '', data: payload.data || {}, icon: '/icon-192.png' }))
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow('/dashboard/reminders')) })
