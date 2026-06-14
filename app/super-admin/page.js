'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, addDoc, doc, setDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, where } from 'firebase/firestore'
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
import { Building2, Plus, Loader2, Copy, Pause, Play, Trash2, RotateCcw } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

function Page() {
  const { profile } = useAuth()
  const [gyms, setGyms] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [creds, setCreds] = useState(null) // shown after creation

  // form fields
  const [gymName, setGymName] = useState('')
  const [gymAddress, setGymAddress] = useState('')
  const [gymPhone, setGymPhone] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [plan, setPlan] = useState('basic')
  const [creating, setCreating] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'gyms'), orderBy('createdAt', 'desc')))
      setGyms(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { toast.error('Could not load gyms: ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
    let p = ''
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
    return p + '!9'
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const tempPassword = generateTempPassword()
      // 1) create owner user via secondary app (doesn't sign out super admin)
      const ownerUid = await createUserWithoutSignout(ownerEmail, tempPassword)
      // 2) gym doc
      const gymId = uuidv4()
      await setDoc(doc(db, 'gyms', gymId), {
        id: gymId,
        name: gymName,
        address: gymAddress,
        phone: gymPhone,
        ownerUid,
        ownerEmail,
        ownerName,
        plan,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: profile.uid,
      })
      // 3) user profile doc
      await setDoc(doc(db, 'users', ownerUid), {
        uid: ownerUid,
        email: ownerEmail,
        displayName: ownerName,
        role: 'gym_owner',
        gymId,
        mustChangePassword: true,
        createdAt: serverTimestamp(),
      })
      toast.success('Gym created')
      setCreds({ email: ownerEmail, password: tempPassword, gymName })
      // reset
      setGymName(''); setGymAddress(''); setGymPhone(''); setOwnerName(''); setOwnerEmail(''); setPlan('basic')
      setOpen(false)
      refresh()
    } catch (err) {
      toast.error(err.message || 'Failed to create gym')
    } finally { setCreating(false) }
  }

  const toggleStatus = async (g, newStatus) => {
    try {
      await updateDoc(doc(db, 'gyms', g.id), { status: newStatus })
      toast.success(`Gym ${newStatus}`)
      refresh()
    } catch (e) { toast.error(e.message) }
  }

  const softDelete = async (g) => {
    if (!confirm(`Soft-delete "${g.name}"? It moves to Recycle Bin and can be restored.`)) return
    await updateDoc(doc(db, 'gyms', g.id), { status: 'deleted', deletedAt: serverTimestamp() })
    toast.success('Gym moved to Recycle Bin')
    refresh()
  }
  const restore = async (g) => {
    await updateDoc(doc(db, 'gyms', g.id), { status: 'active', deletedAt: null })
    toast.success('Gym restored')
    refresh()
  }

  const activeGyms = gyms.filter(g => g.status !== 'deleted')
  const deletedGyms = gyms.filter(g => g.status === 'deleted')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Control</h1>
          <p className="text-slate-500 mt-1">Manage gyms, owners, and subscriptions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" /> New Gym</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Gym</DialogTitle>
              <DialogDescription>Temporary credentials will be generated for the Gym Owner.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Gym Name</Label><Input required value={gymName} onChange={e => setGymName(e.target.value)} /></div>
                <div><Label>Phone</Label><Input value={gymPhone} onChange={e => setGymPhone(e.target.value)} /></div>
              </div>
              <div><Label>Address</Label><Input value={gymAddress} onChange={e => setGymAddress(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Owner Name</Label><Input required value={ownerName} onChange={e => setOwnerName(e.target.value)} /></div>
                <div><Label>Owner Email</Label><Input required type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} /></div>
              </div>
              <div>
                <Label>Subscription Plan</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating} className="bg-orange-600 hover:bg-orange-700">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Gym'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {creds && (
        <Card className="mb-6 border-orange-300 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900">Temporary Credentials for {creds.gymName}</CardTitle>
            <CardDescription className="text-orange-800">Share these securely. Owner must change password on first login.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4 text-sm">
            <div className="font-mono bg-white px-3 py-2 rounded border">{creds.email}</div>
            <div className="font-mono bg-white px-3 py-2 rounded border">{creds.password}</div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`); toast.success('Copied') }}><Copy className="w-4 h-4 mr-1" /> Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreds(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active">
        <TabsList><TabsTrigger value="active">Active Gyms ({activeGyms.length})</TabsTrigger><TabsTrigger value="bin">Recycle Bin ({deletedGyms.length})</TabsTrigger></TabsList>
        <TabsContent value="active">
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-orange-600" /> : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGyms.map(g => (
                <Card key={g.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-orange-600" />{g.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">{g.ownerEmail}</CardDescription>
                      </div>
                      <Badge variant={g.status === 'active' ? 'default' : 'secondary'} className={g.status === 'active' ? 'bg-emerald-600' : ''}>{g.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-slate-500 mb-3">Plan: <span className="capitalize font-medium text-slate-700">{g.plan}</span> · {g.address || 'No address'}</div>
                    <div className="flex gap-2">
                      {g.status === 'active' ? (
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(g, 'suspended')}><Pause className="w-3 h-3 mr-1" />Suspend</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(g, 'active')}><Play className="w-3 h-3 mr-1" />Activate</Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => softDelete(g)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!activeGyms.length && <p className="text-slate-500 col-span-3 text-center py-12">No gyms yet. Click “New Gym” to create one.</p>}
            </div>
          )}
        </TabsContent>
        <TabsContent value="bin">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deletedGyms.map(g => (
              <Card key={g.id} className="opacity-75">
                <CardHeader><CardTitle className="text-base">{g.name}</CardTitle><CardDescription>{g.ownerEmail}</CardDescription></CardHeader>
                <CardContent><Button size="sm" onClick={() => restore(g)}><RotateCcw className="w-3 h-3 mr-1" /> Restore</Button></CardContent>
              </Card>
            ))}
            {!deletedGyms.length && <p className="text-slate-500 col-span-3 text-center py-12">Recycle Bin is empty.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SuperAdminPage() {
  return <AppShell allow={['super_admin']}><Page /></AppShell>
}
