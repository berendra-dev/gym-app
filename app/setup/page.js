'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { ShieldCheck, Loader2 } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [alreadySetup, setAlreadySetup] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'super_admin'), limit(1))
        const snap = await getDocs(q)
        setAlreadySetup(!snap.empty)
      } catch (e) {} finally { setChecking(false) }
    })()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email,
        displayName: name,
        role: 'super_admin',
        gymId: null,
        mustChangePassword: false,
        createdAt: serverTimestamp(),
      })
      toast.success('Super Admin created. Redirecting…')
      router.push('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Failed to create super admin')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  if (alreadySetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Already Set Up</CardTitle><CardDescription>A Super Admin already exists for this platform.</CardDescription></CardHeader>
          <CardContent><Button onClick={() => router.push('/login')} className="w-full bg-orange-600 hover:bg-orange-700">Go to Login</Button></CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-orange-50">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader>
          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-orange-600" />
          </div>
          <CardTitle>Initial Platform Setup</CardTitle>
          <CardDescription>Create the first Super Admin. This is a one-time action.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Full Name</Label><Input required value={name} onChange={e => setName(e.target.value)} placeholder="Jane Admin" /></div>
            <div><Label>Email</Label><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@gymtain.com" /></div>
            <div><Label>Password (min 6)</Label><Input required type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Super Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
