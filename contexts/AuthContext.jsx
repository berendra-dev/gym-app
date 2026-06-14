'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'
import { auth, db } from '@/lib/firebase/client'
import { initFCM } from '@/lib/firebase/messaging'
import { toast } from 'sonner'

const AuthContext = createContext(null)
const SESSION_KEY = 'gymtain_session'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null }
      if (!fbUser) {
        setUser(null); setProfile(null); setLoading(false); return
      }
      setUser(fbUser)

      // 1) Fast path: do a single getDoc first so loading state resolves quickly
      try {
        const ref = doc(db, 'users', fbUser.uid)
        const snap = await getDoc(ref)
        if (snap.exists()) setProfile({ uid: fbUser.uid, ...snap.data() })
        else setProfile({ uid: fbUser.uid, role: null })
      } catch (e) {
        console.error('[Auth] Initial profile fetch failed:', e.message)
        setProfile({ uid: fbUser.uid, role: null, _error: e.message })
      }
      setLoading(false)

      // 2) Slow path: subscribe for live updates (does not block UI)
      try {
        const ref = doc(db, 'users', fbUser.uid)
        unsubProfile = onSnapshot(ref, (snap) => {
          if (!snap.exists()) return
          const data = snap.data()
          // Single-device login enforcement
          const localSession = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
          if (data.activeSessionId && localSession && data.activeSessionId !== localSession) {
            localStorage.removeItem(SESSION_KEY)
            signOut(auth).then(() => toast.error('Signed out: your account is active on another device'))
            return
          }
          setProfile({ uid: fbUser.uid, ...data })
        }, (e) => { console.warn('[Auth] Snapshot error (non-fatal):', e.message) })
      } catch (e) { console.warn('[Auth] Subscribe failed:', e.message) }
    })
    return () => { unsub(); if (unsubProfile) unsubProfile() }
  }, [])

  const login = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password)
    const sessionId = uuidv4()
    if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, sessionId)
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        activeSessionId: sessionId,
        lastLoginAt: serverTimestamp(),
        lastLoginDevice: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
      })
    } catch (e) { /* may be a new user without these fields */ }
    // FCM init non-blocking
    initFCM(auth.currentUser.uid).catch(() => {})
  }

  const logout = async () => {
    try {
      if (auth.currentUser) await updateDoc(doc(db, 'users', auth.currentUser.uid), { activeSessionId: null })
    } catch (e) {}
    if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY)
    await signOut(auth)
  }

  return <AuthContext.Provider value={{ user, profile, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
