'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Loader2, Trash2, Phone, Calendar, KeyRound, Copy } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

function Page() {
  const { profile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [studentCreds, setStudentCreds] = useState(null)

  // form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('male')
  const [plan, setPlan] = useState('monthly')
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10))
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10)
  })

  const isReceptionist = profile?.role === 'receptionist'

  const refresh = async () => {
    if (!profile?.gymId) return
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId)))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.joinDate || '').localeCompare(a.joinDate || ''))
      setMembers(list)
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [profile])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const id = uuidv4()
      await addDoc(collection(db, 'members'), {
        id,
        gymId: profile.gymId,
        name, phone, email, gender, plan,
        joinDate, expiryDate,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: profile.uid,
      })
      toast.success('Member added')
      setName(''); setPhone(''); setEmail('')
      setOpen(false); refresh()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  const handleDelete = async (m) => {
    if (profile.role !== 'gym_owner') { toast.error('Only Gym Owner can delete members'); return }
    if (!confirm(`Permanently delete ${m.name}?`)) return
    await deleteDoc(doc(db, 'members', m.id))
    toast.success('Deleted'); refresh()
  }

  const createLogin = async (m) => {
    if (!m.email) { toast.error('Member must have an email to create login'); return }
    try {
      const r = await api.createUser({ email: m.email, displayName: m.name, role: 'student' })
      // Link this auth user to the member record
      const { updateDoc, doc: docFn } = await import('firebase/firestore')
      await updateDoc(docFn(db, 'users', r.uid), { linkedMemberId: m.id })
      setStudentCreds({ name: m.name, email: r.email, password: r.password })
      toast.success('Student login created')
    } catch (e) { toast.error(e.message) }
  }

  const filtered = members.filter(m => !search || (m.name?.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search)))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-slate-500 mt-1">{members.length} total • Multi-tenant scope: <span className="font-mono text-xs">{profile?.gymId?.slice(0, 8)}…</span></p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" />Add Member</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Member</DialogTitle><DialogDescription>Member is automatically scoped to your gym.</DialogDescription></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Full Name</Label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
                <div><Label>Phone</Label><Input required value={phone} onChange={e => setPhone(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Plan</Label>
                  <Select value={plan} onValueChange={setPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="halfyearly">Half-Yearly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent></Select>
                </div>
                <div><Label>Join Date</Label><Input type="date" required value={joinDate} onChange={e => setJoinDate(e.target.value)} /></div>
                <div><Label>Expiry Date</Label><Input type="date" required value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Member'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Input className="max-w-sm mb-4" placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />

      {studentCreds && (
        <Card className="mb-4 border-blue-300 bg-blue-50">
          <CardContent className="pt-4 flex items-center gap-3 text-sm flex-wrap">
            <div><strong>Login created for {studentCreds.name}:</strong></div>
            <div className="font-mono bg-white px-2 py-1 rounded border">{studentCreds.email}</div>
            <div className="font-mono bg-white px-2 py-1 rounded border">{studentCreds.password}</div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`Email: ${studentCreds.email}\nPassword: ${studentCreds.password}`); toast.success('Copied') }}><Copy className="w-3 h-3 mr-1" />Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setStudentCreds(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(m => {
            const expired = m.expiryDate && new Date(m.expiryDate) < new Date()
            return (
              <Card key={m.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{m.name}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" />Expires {m.expiryDate}</div>
                    </div>
                    <Badge className={expired ? 'bg-red-600' : 'bg-emerald-600'}>{expired ? 'Expired' : m.plan}</Badge>
                  </div>
                  {!isReceptionist && (
                    <div className="flex gap-1 mt-3">
                      <Button size="sm" variant="ghost" className="text-blue-600 h-7 px-2" onClick={() => createLogin(m)}><KeyRound className="w-3 h-3 mr-1" />Create Login</Button>
                      <Button size="sm" variant="ghost" className="text-red-600 h-7 px-2" onClick={() => handleDelete(m)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {!filtered.length && <p className="text-slate-500 col-span-3 text-center py-12">No members yet. Add your first one!</p>}
        </div>
      )}
    </div>
  )
}

export default function MembersPage() {
  return <AppShell allow={['gym_owner', 'receptionist']}><Page /></AppShell>
}
