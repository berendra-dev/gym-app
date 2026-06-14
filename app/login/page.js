'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { auth, db } from '@/lib/firebase/client'
import { api } from '@/lib/api'
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs, serverTimestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Dumbbell, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login, user, profile, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!authLoading && user && profile?.role) router.replace('/dashboard')
  }, [user, profile, authLoading, router])

  // Recovery: if logged in but no Firestore profile (e.g. Firestore was disabled at signup time)
  useEffect(() => {
    if (authLoading || !user || profile?.role || recovering) return
    let cancelled = false
    const t = setTimeout(async () => {
      if (cancelled) return
      setRecovering(true)
      try {
        // Check if any super_admin exists
        const saSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'super_admin'), limit(1)))
        if (saSnap.empty) {
          // Bootstrap: promote current user to super_admin
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.email.split('@')[0],
            role: 'super_admin',
            gymId: null,
            mustChangePassword: false,
            createdAt: serverTimestamp(),
            recoveredAt: serverTimestamp(),
          })
          try { await api.syncClaimsSelf(); await user.getIdToken(true) } catch (e) {}
          toast.success('Profile recovered as Super Admin')
        } else {
          toast.error('Your account has no role assigned. Please ask your admin to grant access.', { duration: 8000 })
        }
      } catch (e) {
        toast.error('Recovery failed: ' + (e.message || ''))
      } finally {
        setRecovering(false)
      }
    }, 1500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [authLoading, user, profile, recovering])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
    } catch (err) {
      const code = err?.code || ''
      const msg = code === 'auth/invalid-credential' ? 'Invalid email or password'
        : code === 'auth/operation-not-allowed' ? 'Email/Password sign-in is not enabled in Firebase Console'
        : (err.message || 'Login failed')
      toast.error(msg)
    } finally { setLoading(false) }
  }

  // Show recovery state
  if (user && !profile?.role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-orange-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Setting up your account…</CardTitle>
            <CardDescription>Recovering missing profile data. This will take a moment.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-orange-50">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader>
          <Link href="/" className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Gymtain</span>
          </Link>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your gym management dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Email</Label><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input required type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-slate-500">
            First time? <Link href="/setup" className="text-orange-600 font-medium hover:underline">Initial Setup</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
