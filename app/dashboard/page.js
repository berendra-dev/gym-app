'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function DashboardRouter() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (profile?.mustChangePassword) { router.replace('/change-password'); return }
    const role = profile?.role
    if (role === 'super_admin') router.replace('/super-admin')
    else if (role === 'gym_owner') router.replace('/gym-owner')
    else if (role === 'receptionist') router.replace('/receptionist')
    else if (role === 'trainer') router.replace('/trainer')
    else if (role === 'student') router.replace('/student')
    else router.replace('/login')
  }, [user, profile, loading, router])

  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>
}
