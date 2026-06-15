'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Loader2, Copy, Crown, UserPlus } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [gym, setGym] = useState(null)
  const [trainers, setTrainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [creds, setCreds] = useState(null)

  const refresh = async () => {
    if (!profile?.gymId) return
    setLoading(true)
    const [gymSnap, tSnap] = await Promise.all([
      getDoc(doc(db, 'gyms', profile.gymId)),
      getDocs(query(collection(db, 'users'), where('gymId', '==', profile.gymId), where('role', '==', 'trainer'))),
    ])
    setGym(gymSnap.exists() ? gymSnap.data() : null)
    setTrainers(tSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }
  useEffect(() => { refresh() }, [profile])

  const isPremium = gym?.plan === 'premium' || gym?.plan === 'diamond'

  const genPwd = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
    let p = ''; for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
    return p + '!9'
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!isPremium) { toast.error('Trainers are a Premium plan feature'); return }
    setBusy(true)
    try {
      // Secure server-side creation with custom claims
      const result = await api.createUser({ email, displayName: name, role: 'trainer' })
      setCreds({ email: result.email, password: result.password, name })
      setName(''); setEmail(''); setOpen(false); refresh()
      toast.success('Trainer created (secure)')
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">Trainers {isPremium && <Crown className="w-6 h-6 text-amber-500" />}</h1>
          <p className="text-slate-500 mt-1">{isPremium ? 'Manage trainer accounts for your gym.' : 'Upgrade to Premium to add trainers.'}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700" disabled={!isPremium}><Plus className="w-4 h-4 mr-1" />Add Trainer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Trainer</DialogTitle><DialogDescription>Trainer will receive a temporary password.</DialogDescription></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div><Label>Name</Label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>Email</Label><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={busy} className="bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!isPremium && (
        <Card className="mb-4 border-amber-300 bg-amber-50">
          <CardContent className="pt-5 flex items-center gap-3">
            <Crown className="w-6 h-6 text-amber-600" />
            <div><div className="font-semibold">Premium feature</div><div className="text-sm text-slate-600">Ask Super Admin to upgrade your gym to Premium to manage trainers.</div></div>
          </CardContent>
        </Card>
      )}

      {creds && (
        <Card className="mb-6 border-orange-300 bg-orange-50">
          <CardHeader><CardTitle className="text-orange-900">Temp credentials for {creds.name}</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3 text-sm">
            <div className="font-mono bg-white px-3 py-2 rounded border">{creds.email}</div>
            <div className="font-mono bg-white px-3 py-2 rounded border">{creds.password}</div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`); toast.success('Copied') }}><Copy className="w-4 h-4 mr-1" />Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreds(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {trainers.map(t => (
          <Card key={t.uid}><CardContent className="pt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center"><UserPlus className="w-5 h-5 text-orange-600" /></div>
            <div><div className="font-medium">{t.displayName}</div><div className="text-xs text-slate-500">{t.email}</div></div>
          </CardContent></Card>
        ))}
        {!trainers.length && <p className="text-slate-500 col-span-3 text-center py-8">No trainers yet.</p>}
      </div>
    </div>
  )
}

export default function TrainersPage() {
  return <AppShell allow={['gym_owner']}><Page /></AppShell>
}
