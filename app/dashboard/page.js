'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

const ROLE_REDIRECT = {
  super_admin: '/super-admin',
  gym_owner:   '/owner',
  receptionist:'/reception',
  trainer:     '/trainer',
  student:     '/student',
}

export default function DashboardRouter() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    (async () => {
      if (loading) return
      if (!user) { router.replace('/login'); return }
      // If AuthContext has profile, use it
      let role = profile?.role
      let mustChange = profile?.mustChangePassword
      // Otherwise, fetch directly
      if (!role) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          if (snap.exists()) { role = snap.data().role; mustChange = snap.data().mustChangePassword }
        } catch (e) { console.error('[Dashboard] fetch profile failed', e) }
      }
      if (mustChange) { router.replace('/change-password'); return }
      const target = role ? ROLE_REDIRECT[role] : null
      router.replace(target || '/login')
    })()
  }, [user, profile, loading, router])

  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>
}
