'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Loader2, Copy, UserCog, Trash2, Mail, KeyRound } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [creds, setCreds] = useState(null)

  const refresh = async () => {
    if (!profile?.gymId) return
    setLoading(true)
    const snap = await getDocs(query(collection(db, 'users'), where('gymId', '==', profile.gymId), where('role', '==', 'receptionist')))
    setList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }
  useEffect(() => { refresh() }, [profile])

  const handleAdd = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const result = await api.createUser({ email, displayName: name, role: 'receptionist' })
      setCreds({ name, email: result.email, password: result.password })
      setName(''); setEmail(''); setOpen(false); refresh()
      toast.success('Receptionist created (must change password on first login)')
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  const remove = async (u) => {
    if (!confirm(`Remove receptionist ${u.displayName || u.email}? They will lose access immediately.`)) return
    try {
      await api.deleteUser(u.uid)
      toast.success('Receptionist removed')
      refresh()
    } catch (e) { toast.error(e.message) }
  }

  const resetPw = async (u) => {
    if (!confirm(`Reset password for ${u.email}? A new temporary password will be generated.`)) return
    try {
      const r = await api.resetPassword(u.uid)
      setCreds({ name: u.displayName || u.email, email: u.email, password: r.password })
      toast.success('Password reset · share securely')
    } catch (e) { toast.error(e.message) }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><UserCog className="w-7 h-7 text-orange-600" />Receptionists</h1>
          <p className="text-slate-500 mt-1">Receptionists can add members, mark attendance, and manage daily operations — but cannot delete members or manage subscriptions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" />Add Receptionist</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Receptionist</DialogTitle><DialogDescription>Temporary password is generated. Receptionist will be forced to change it on first login.</DialogDescription></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div><Label>Full Name</Label><Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya Sharma" /></div>
              <div><Label>Email</Label><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="priya@yourgym.com" /></div>
              <DialogFooter><Button type="submit" disabled={busy} className="bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Receptionist'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {creds && (
        <Card className="mb-6 border-orange-300 bg-orange-50">
          <CardHeader><CardTitle className="text-orange-900">Temp credentials for {creds.name}</CardTitle><CardDescription className="text-orange-800">Share securely. Must change password on first login.</CardDescription></CardHeader>
          <CardContent className="flex items-center gap-3 text-sm flex-wrap">
            <div className="font-mono bg-white px-3 py-2 rounded border">{creds.email}</div>
            <div className="font-mono bg-white px-3 py-2 rounded border">{creds.password}</div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`); toast.success('Copied') }}><Copy className="w-4 h-4 mr-1" />Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreds(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map(u => (
          <Card key={u.uid}>
            <CardContent className="pt-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center"><UserCog className="w-5 h-5 text-orange-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.displayName || u.email}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Mail className="w-3 h-3" />{u.email}</div>
                {u.mustChangePassword && <div className="text-xs text-amber-600 mt-1">Pending first login</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => resetPw(u)}><KeyRound className="w-3 h-3 mr-1" />Reset PW</Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(u)}><Trash2 className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {!list.length && <p className="text-slate-500 col-span-3 text-center py-12">No receptionists yet. Click “Add Receptionist”.</p>}
      </div>
    </div>
  )
}

export default function ReceptionistsPage() {
  return <AppShell allow={['gym_owner']}><Page /></AppShell>
}
