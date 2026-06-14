'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, addDoc, doc, setDoc, getDocs, query, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db, createUserWithoutSignout } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Building2, Plus, Loader2, Copy, Pause, Play, Trash2, RotateCcw, Settings, Crown } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

function Page() {
  const { profile } = useAuth()
  const [gyms, setGyms] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [creds, setCreds] = useState(null)
  const [settingsGym, setSettingsGym] = useState(null)

  // create form
  const [gymName, setGymName] = useState('')
  const [gymAddress, setGymAddress] = useState('')
  const [gymPhone, setGymPhone] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [plan, setPlan] = useState('basic')
  const [creating, setCreating] = useState(false)

  // settings form
  const [sPlan, setSPlan] = useState('basic')
  const [sExpiry, setSExpiry] = useState('')
  const [sRenewal, setSRenewal] = useState('expiry')
  const [sGrace, setSGrace] = useState(3)
  const [savingSettings, setSavingSettings] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'gyms'), orderBy('createdAt', 'desc')))
      setGyms(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { toast.error('Could not load gyms: ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const genPwd = () => {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
    let p = ''; for (let i = 0; i < 10; i++) p += c[Math.floor(Math.random() * c.length)]
    return p + '!9'
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const tempPassword = genPwd()
      const ownerUid = await createUserWithoutSignout(ownerEmail, tempPassword)
      const gymId = uuidv4()
      const defaultExpiry = new Date(); defaultExpiry.setMonth(defaultExpiry.getMonth() + 1)
      await setDoc(doc(db, 'gyms', gymId), {
        id: gymId, name: gymName, address: gymAddress, phone: gymPhone,
        ownerUid, ownerEmail, ownerName, plan,
        subscriptionExpiry: defaultExpiry.toISOString().slice(0, 10),
        renewalMode: 'expiry', gracePeriodDays: 3,
        status: 'active',
        createdAt: serverTimestamp(), createdBy: profile.uid,
      })
      await setDoc(doc(db, 'users', ownerUid), {
        uid: ownerUid, email: ownerEmail, displayName: ownerName,
        role: 'gym_owner', gymId, mustChangePassword: true,
        createdAt: serverTimestamp(),
      })
      // subscription history
      await addDoc(collection(db, 'subscriptionHistory'), {
        gymId, plan, action: 'created',
        expiryDate: defaultExpiry.toISOString().slice(0, 10),
        performedBy: profile.uid, timestamp: serverTimestamp(),
      })
      setCreds({ email: ownerEmail, password: tempPassword, gymName })
      setGymName(''); setGymAddress(''); setGymPhone(''); setOwnerName(''); setOwnerEmail(''); setPlan('basic')
      setOpen(false); refresh()
      toast.success('Gym created')
    } catch (err) { toast.error(err.message) } finally { setCreating(false) }
  }

  const toggleStatus = async (g, ns) => {
    await updateDoc(doc(db, 'gyms', g.id), { status: ns })
    await addDoc(collection(db, 'auditLogs'), { gymId: g.id, action: `gym.${ns}`, performedBy: profile.uid, performedByRole: 'super_admin', timestamp: serverTimestamp() })
    toast.success(`Gym ${ns}`); refresh()
  }
  const softDelete = async (g) => {
    if (!confirm(`Soft-delete "${g.name}"?`)) return
    await updateDoc(doc(db, 'gyms', g.id), { status: 'deleted', deletedAt: serverTimestamp() })
    toast.success('Moved to Recycle Bin'); refresh()
  }
  const restore = async (g) => {
    await updateDoc(doc(db, 'gyms', g.id), { status: 'active', deletedAt: null })
    toast.success('Restored'); refresh()
  }

  const openSettings = (g) => {
    setSPlan(g.plan || 'basic')
    setSExpiry(g.subscriptionExpiry || '')
    setSRenewal(g.renewalMode || 'expiry')
    setSGrace(g.gracePeriodDays || 3)
    setSettingsGym(g)
  }
  const saveSettings = async () => {
    if (!settingsGym) return
    setSavingSettings(true)
    try {
      const before = { plan: settingsGym.plan, subscriptionExpiry: settingsGym.subscriptionExpiry, renewalMode: settingsGym.renewalMode, gracePeriodDays: settingsGym.gracePeriodDays }
      const after = { plan: sPlan, subscriptionExpiry: sExpiry, renewalMode: sRenewal, gracePeriodDays: Number(sGrace) }
      await updateDoc(doc(db, 'gyms', settingsGym.id), after)
      await addDoc(collection(db, 'subscriptionHistory'), {
        gymId: settingsGym.id, plan: sPlan, expiryDate: sExpiry,
        action: 'updated', before, after,
        performedBy: profile.uid, timestamp: serverTimestamp(),
      })
      toast.success('Settings saved')
      setSettingsGym(null); refresh()
    } catch (e) { toast.error(e.message) } finally { setSavingSettings(false) }
  }

  const active = gyms.filter(g => g.status !== 'deleted')
  const deleted = gyms.filter(g => g.status === 'deleted')
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold tracking-tight">Platform Control</h1><p className="text-slate-500 mt-1">Manage gyms, subscriptions, and access.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" /> New Gym</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create New Gym</DialogTitle><DialogDescription>Temp credentials are generated for the owner.</DialogDescription></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3"><div><Label>Gym Name</Label><Input required value={gymName} onChange={e => setGymName(e.target.value)} /></div><div><Label>Phone</Label><Input value={gymPhone} onChange={e => setGymPhone(e.target.value)} /></div></div>
              <div><Label>Address</Label><Input value={gymAddress} onChange={e => setGymAddress(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Owner Name</Label><Input required value={ownerName} onChange={e => setOwnerName(e.target.value)} /></div><div><Label>Owner Email</Label><Input required type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} /></div></div>
              <div><Label>Plan</Label><Select value={plan} onValueChange={setPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="basic">Basic</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="premium">Premium</SelectItem></SelectContent></Select></div>
              <DialogFooter><Button type="submit" disabled={creating} className="bg-orange-600 hover:bg-orange-700">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {creds && (
        <Card className="mb-6 border-orange-300 bg-orange-50">
          <CardHeader><CardTitle className="text-orange-900">Temp credentials for {creds.gymName}</CardTitle><CardDescription className="text-orange-800">Share securely. Owner must change password on first login.</CardDescription></CardHeader>
          <CardContent className="flex items-center gap-3 text-sm flex-wrap">
            <div className="font-mono bg-white px-3 py-2 rounded border">{creds.email}</div>
            <div className="font-mono bg-white px-3 py-2 rounded border">{creds.password}</div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`); toast.success('Copied') }}><Copy className="w-4 h-4 mr-1" />Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreds(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active">
        <TabsList><TabsTrigger value="active">Active ({active.length})</TabsTrigger><TabsTrigger value="bin">Recycle Bin ({deleted.length})</TabsTrigger></TabsList>
        <TabsContent value="active">
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-orange-600" /> : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map(g => {
                const expired = g.subscriptionExpiry && g.subscriptionExpiry < today
                return (
                  <Card key={g.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-orange-600" />{g.name}</CardTitle><CardDescription className="text-xs mt-1">{g.ownerEmail}</CardDescription></div>
                        <Badge className={g.status === 'active' ? 'bg-emerald-600' : 'bg-amber-600'}>{g.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="capitalize">{g.plan === 'premium' && <Crown className="w-3 h-3 mr-1 text-amber-500" />}{g.plan}</Badge>
                        <span className={expired ? 'text-red-600 font-medium' : 'text-slate-500'}>Exp: {g.subscriptionExpiry || '—'}</span>
                      </div>
                      <div className="text-xs text-slate-500">{g.address || 'No address'}</div>
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => openSettings(g)}><Settings className="w-3 h-3 mr-1" />Plan</Button>
                        {g.status === 'active' ? <Button size="sm" variant="outline" onClick={() => toggleStatus(g, 'suspended')}><Pause className="w-3 h-3 mr-1" />Suspend</Button>
                          : <Button size="sm" variant="outline" onClick={() => toggleStatus(g, 'active')}><Play className="w-3 h-3 mr-1" />Activate</Button>}
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => softDelete(g)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {!active.length && <p className="text-slate-500 col-span-3 text-center py-12">No gyms yet. Click “New Gym”.</p>}
            </div>
          )}
        </TabsContent>
        <TabsContent value="bin">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deleted.map(g => (
              <Card key={g.id} className="opacity-75"><CardHeader><CardTitle className="text-base">{g.name}</CardTitle><CardDescription>{g.ownerEmail}</CardDescription></CardHeader><CardContent><Button size="sm" onClick={() => restore(g)}><RotateCcw className="w-3 h-3 mr-1" />Restore</Button></CardContent></Card>
            ))}
            {!deleted.length && <p className="text-slate-500 col-span-3 text-center py-12">Bin empty.</p>}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!settingsGym} onOpenChange={(o) => !o && setSettingsGym(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Subscription Settings</DialogTitle><DialogDescription>{settingsGym?.name}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Plan</Label><Select value={sPlan} onValueChange={setSPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="basic">Basic</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="premium">Premium (Trainers, QR, FCM)</SelectItem></SelectContent></Select></div>
            <div><Label>Subscription Expiry</Label><Input type="date" value={sExpiry} onChange={e => setSExpiry(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Renewal Mode</Label><Select value={sRenewal} onValueChange={setSRenewal}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expiry">Expiry-based</SelectItem><SelectItem value="payment">Payment-based</SelectItem></SelectContent></Select></div>
              <div><Label>Grace Period (days)</Label><Input type="number" min="0" max="30" value={sGrace} onChange={e => setSGrace(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveSettings} disabled={savingSettings} className="bg-orange-600 hover:bg-orange-700">{savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SuperAdminPage() {
  return <AppShell allow={['super_admin']}><Page /></AppShell>
}
