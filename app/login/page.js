'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Dumbbell, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

const ROLE_REDIRECT = {
  super_admin: '/super-admin',
  gym_owner:   '/owner',
  receptionist:'/reception',
  trainer:     '/trainer',
  student:     '/student',
}

const FRIENDLY_ERROR = {
  'auth/invalid-credential':        'Wrong email or password. (Tip: Firebase hides whether the account exists for security — double-check both.)',
  'auth/invalid-email':             'That email address is not valid.',
  'auth/user-not-found':            'No account exists with that email. Please run Initial Setup first.',
  'auth/wrong-password':            'Incorrect password.',
  'auth/user-disabled':             'This account has been disabled. Contact your admin.',
  'auth/too-many-requests':         'Too many failed attempts. Please wait a few minutes and try again.',
  'auth/operation-not-allowed':     'Email/Password sign-in is not enabled in Firebase Console → Authentication → Sign-in method.',
  'auth/network-request-failed':    'Network error. Check your internet connection.',
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('idle') // idle | signingIn | fetchingProfile | redirecting
  const [errorBox, setErrorBox] = useState(null) // {title, message, hint?}

  // Already logged-in handling
  useEffect(() => {
    if (auth.currentUser) {
      (async () => {
        const result = await resolveProfile(auth.currentUser.uid, auth.currentUser.email)
        if (result.ok) router.replace(result.redirect)
      })()
    }
  }, [router])

  const resolveProfile = async (uid, userEmail) => {
    console.log('[Login] Resolving profile for uid:', uid)
    try {
      const profileRef = doc(db, 'users', uid)
      const profileSnap = await getDoc(profileRef)

      if (!profileSnap.exists()) {
        console.warn('[Login] No Firestore document at users/' + uid)
        // Attempt auto-recovery: if NO super admin exists yet, promote this account
        try {
          const saQ = query(collection(db, 'users'), where('role', '==', 'super_admin'), limit(1))
          const saSnap = await getDocs(saQ)
          if (saSnap.empty) {
            console.log('[Login] No super admin exists - bootstrapping current account as super_admin')
            await setDoc(profileRef, {
              uid, email: userEmail,
              displayName: (userEmail || '').split('@')[0],
              role: 'super_admin', gymId: null,
              mustChangePassword: false,
              createdAt: serverTimestamp(),
              recoveredAt: serverTimestamp(),
            })
            try { await api.syncClaimsSelf(); await auth.currentUser.getIdToken(true) } catch (e) { console.warn('[Login] claim sync failed', e.message) }
            toast.success('Welcome! Profile created as Super Admin.')
            return { ok: true, redirect: '/super-admin' }
          }
        } catch (e) {
          console.error('[Login] Recovery check failed', e)
        }
        return { ok: false, title: 'No profile found', message: `Your Firebase Auth account exists but there is no document at users/${uid}. Please ask your admin to create your profile, or run Initial Setup.` }
      }

      const data = profileSnap.data()
      console.log('[Login] Profile data:', { role: data.role, gymId: data.gymId, mustChangePassword: data.mustChangePassword })

      if (!data.role) {
        return { ok: false, title: 'No role assigned', message: 'Your profile exists but no role has been assigned. Contact your administrator.' }
      }

      if (data.mustChangePassword) {
        return { ok: true, redirect: '/change-password' }
      }

      const target = ROLE_REDIRECT[data.role]
      if (!target) {
        return { ok: false, title: 'Unknown role', message: `Role "${data.role}" is not recognized. Expected one of: ${Object.keys(ROLE_REDIRECT).join(', ')}.` }
      }
      return { ok: true, redirect: target, role: data.role }
    } catch (e) {
      console.error('[Login] Profile fetch failed', e)
      const isPermission = e?.code === 'permission-denied' || /permission/i.test(e.message || '')
      return {
        ok: false,
        title: isPermission ? 'Firestore permission denied' : 'Profile fetch failed',
        message: isPermission
          ? 'Firestore security rules are blocking your profile read. Make sure Firestore is in test mode or rules allow self-reads.'
          : (e.message || 'Could not read your profile from Firestore.'),
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorBox(null)
    setLoading(true)
    setStage('signingIn')

    try {
      console.log('[Login] Attempting Firebase signInWithEmailAndPassword for', email)
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      console.log('[Login] Firebase auth success, uid =', cred.user.uid)

      setStage('fetchingProfile')
      const result = await resolveProfile(cred.user.uid, cred.user.email)
      if (!result.ok) {
        setErrorBox({ title: result.title, message: result.message })
        setLoading(false); setStage('idle')
        return
      }
      setStage('redirecting')
      toast.success(result.role ? `Welcome back · signing into ${result.role.replace('_', ' ')}` : 'Welcome back!')
      router.replace(result.redirect)
    } catch (err) {
      console.error('[Login] Sign-in failed', { code: err?.code, message: err?.message })
      const code = err?.code || ''
      const friendly = FRIENDLY_ERROR[code]
      setErrorBox({
        title: friendly ? 'Sign-in failed' : 'Unexpected error',
        message: friendly || err?.message || 'Unknown error',
        hint: code ? `Firebase error code: ${code}` : undefined,
      })
      setLoading(false); setStage('idle')
    }
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
          {errorBox && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{errorBox.title}</AlertTitle>
              <AlertDescription className="text-sm">
                {errorBox.message}
                {errorBox.hint && <div className="mt-1 font-mono text-xs opacity-70">{errorBox.hint}</div>}
              </AlertDescription>
            </Alert>
          )}

          {stage === 'fetchingProfile' && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Signed in to Firebase ✓</AlertTitle>
              <AlertDescription className="text-sm">Loading your profile from Firestore…</AlertDescription>
            </Alert>
          )}

          {stage === 'redirecting' && (
            <Alert className="mb-4 border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle>Profile loaded ✓</AlertTitle>
              <AlertDescription className="text-sm">Redirecting to your dashboard…</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            First time?{' '}
            <Link href="/setup" className="text-orange-600 font-medium hover:underline">
              Run Initial Setup
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
