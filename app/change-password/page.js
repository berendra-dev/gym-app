'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePassword } from 'firebase/auth'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { KeyRound, Loader2 } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await updatePassword(auth.currentUser, password)
      await updateDoc(doc(db, 'users', user.uid), {
        mustChangePassword: false,
        passwordChangedAt: serverTimestamp(),
      })
      toast.success('Password updated')
      router.push('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Failed to update password')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-3"><KeyRound className="w-6 h-6 text-orange-600" /></div>
          <CardTitle>Change Your Password</CardTitle>
          <CardDescription>You must set a new password before continuing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>New Password</Label><Input required type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <div><Label>Confirm Password</Label><Input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
