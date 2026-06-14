'use client'

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { app, db } from './client'
import { toast } from 'sonner'

const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

let messagingInstance = null
let foregroundUnsub = null

export async function initFCM(uid) {
  try {
    if (typeof window === 'undefined') return null
    if (!(await isSupported())) return null
    if (!('serviceWorker' in navigator)) return null
    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    // Request notification permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    // Get FCM token
    if (!messagingInstance) messagingInstance = getMessaging(app)
    const token = await getToken(messagingInstance, { vapidKey: VAPID, serviceWorkerRegistration: registration })
    if (token && uid) {
      await updateDoc(doc(db, 'users', uid), {
        fcmTokens: arrayUnion(token),
        fcmUpdatedAt: serverTimestamp(),
      })
    }
    // Foreground message handler
    if (foregroundUnsub) foregroundUnsub()
    foregroundUnsub = onMessage(messagingInstance, (payload) => {
      const title = payload.notification?.title || 'Notification'
      const body = payload.notification?.body || ''
      toast.info(title, { description: body })
    })
    return token
  } catch (e) {
    console.warn('[FCM] init failed:', e.message)
    return null
  }
}
