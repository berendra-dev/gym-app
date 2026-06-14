'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'
import { auth, db } from '@/lib/firebase/client'
import { toast } from 'sonner'

const AuthContext = createContext(null)
const SESSION_KEY = 'gymtain_session'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const justLoggedIn = useRef(false)

  useEffect(() => {
    let unsubProfile = null
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null }
      if (!fbUser) {
        setUser(null); setProfile(null); setLoading(false); return
      }
      setUser(fbUser)
      const ref = doc(db, 'users', fbUser.uid)
      unsubProfile = onSnapshot(ref, (snap) => {
        if (!snap.exists()) { setProfile({ uid: fbUser.uid, role: null }); setLoading(false); return }
        const data = snap.data()
        // Single-device login enforcement
        const localSession = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
        if (data.activeSessionId && localSession && data.activeSessionId !== localSession) {
          // another device took over
          localStorage.removeItem(SESSION_KEY)
          signOut(auth).then(() => toast.error('Signed out: your account is active on another device'))
          return
        }
        setProfile({ uid: fbUser.uid, ...data })
        setLoading(false)
      }, () => { setLoading(false) })
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
    } catch (e) { /* doc may not yet have these fields */ }
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
