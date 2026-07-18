import { getApp, getApps, initializeApp } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId)
export const firebaseApp = isFirebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null

export async function getFirebaseMessaging() {
  if (!firebaseApp || typeof window === 'undefined' || !(await isSupported())) return null
  return getMessaging(firebaseApp)
}
