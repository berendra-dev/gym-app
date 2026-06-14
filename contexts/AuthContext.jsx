'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)        // firebase auth user
  const [profile, setProfile] = useState(null)  // firestore users/{uid}
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null }
      if (!fbUser) {
        setUser(null); setProfile(null); setLoading(false); return
      }
      setUser(fbUser)
      // Live listen to profile (role, gymId, mustChangePassword)
      const ref = doc(db, 'users', fbUser.uid)
      unsubProfile = onSnapshot(ref, (snap) => {
        if (snap.exists()) setProfile({ uid: fbUser.uid, ...snap.data() })
        else setProfile({ uid: fbUser.uid, role: null })
        setLoading(false)
      }, () => { setLoading(false) })
    })
    return () => { unsub(); if (unsubProfile) unsubProfile() }
  }, [])

  const login = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password)
  }
  const logout = async () => { await signOut(auth) }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
