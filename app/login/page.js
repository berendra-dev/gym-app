'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
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

  useEffect(() => {
    if (!authLoading && user && profile?.role) router.replace('/dashboard')
  }, [user, profile, authLoading, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(err?.code === 'auth/invalid-credential' ? 'Invalid email or password' : (err.message || 'Login failed'))
    } finally { setLoading(false) }
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
        </CardContent>
      </Card>
    </div>
  )
}
