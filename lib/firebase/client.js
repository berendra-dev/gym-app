'use client'

import { initializeApp, getApps, getApp, deleteApp, initializeApp as initializeSecondaryApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut as signOutFn } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export { app }

// Secondary app trick: create users without signing out the current admin.
// We init a second Firebase app instance, create the user there, then delete it.
export async function createUserWithoutSignout(email, password) {
  const secondaryName = `secondary-${Date.now()}`
  const secondaryApp = initializeSecondaryApp(firebaseConfig, secondaryName)
  try {
    const secondaryAuth = getAuth(secondaryApp)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid = cred.user.uid
    await signOutFn(secondaryAuth)
    return uid
  } finally {
    try { await deleteApp(secondaryApp) } catch (e) {}
  }
}
