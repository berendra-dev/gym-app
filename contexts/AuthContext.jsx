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
  // Track if we have ever seen a matching session — only then enforce single-device
  const seenMatchingSession = useRef(false)

  useEffect(() => {
    let unsubProfile = null
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null }
      if (!fbUser) {
        setUser(null); setProfile(null); setLoading(false)
        seenMatchingSession.current = false
        return
      }
      setUser(fbUser)
      seenMatchingSession.current = false

      // Fast path: getDoc once to resolve initial loading
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

      // Live updates (does NOT block UI)
      try {
        const ref = doc(db, 'users', fbUser.uid)
        unsubProfile = onSnapshot(ref, (snap) => {
          if (!snap.exists()) return
          const data = snap.data()
          // Single-device enforcement (safe: only kick out if we previously matched)
          const localSession = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
          if (data.activeSessionId && localSession) {
            if (data.activeSessionId === localSession) {
              seenMatchingSession.current = true
            } else if (seenMatchingSession.current) {
              // We previously matched, now diverged → another device logged in
              localStorage.removeItem(SESSION_KEY)
              signOut(auth).then(() => toast.error('Signed out: your account is active on another device'))
              return
            }
            // Else: initial mismatch (stale Firestore value) → accept, don't sign out
          }
          setProfile({ uid: fbUser.uid, ...data })
        }, (e) => { console.warn('[Auth] Snapshot error (non-fatal):', e.message) })
      } catch (e) { console.warn('[Auth] Subscribe failed:', e.message) }
    })
    return () => { unsub(); if (unsubProfile) unsubProfile() }
  }, [])

  const login = async (email, password) => {
    // Pre-set local session BEFORE auth so the check never mismatches
    const sessionId = uuidv4()
    if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, sessionId)
    await signInWithEmailAndPassword(auth, email, password)
    // Write activeSessionId to Firestore so the listener will mark "seen"
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        activeSessionId: sessionId,
        lastLoginAt: serverTimestamp(),
        lastLoginDevice: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
      })
      seenMatchingSession.current = true
    } catch (e) { /* doc may not exist yet */ }
    // FCM init is non-blocking
    initFCM(auth.currentUser.uid).catch(() => {})
  }

  const logout = async () => {
    try {
      if (auth.currentUser) await updateDoc(doc(db, 'users', auth.currentUser.uid), { activeSessionId: null })
    } catch (e) {}
    if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY)
    seenMatchingSession.current = false
    await signOut(auth)
  }

  return <AuthContext.Provider value={{ user, profile, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
