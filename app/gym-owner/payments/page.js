'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Loader2, IndianRupee, AlertTriangle, Calendar } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

function Page() {
  const { profile } = useAuth()
  const [gym, setGym] = useState(null)
  const [members, setMembers] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [amount, setAmount] = useState('')
  const [planRenewal, setPlanRenewal] = useState('monthly')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const refresh = async () => {
    if (!profile?.gymId) return
    setLoading(true)
    try {
      const [gymSnap, memSnap, paySnap] = await Promise.all([
        getDoc(doc(db, 'gyms', profile.gymId)),
        getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId))),
        getDocs(query(collection(db, 'payments'), where('gymId', '==', profile.gymId))),
      ])
      setGym(gymSnap.exists() ? gymSnap.data() : null)
      const mem = memSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      mem.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setMembers(mem)
      const pay = paySnap.docs.map(d => ({ id: d.id, ...d.data() }))
      pay.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))
      setPayments(pay)
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [profile])

  const addPayment = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const member = members.find(m => m.id === selectedMemberId)
      if (!member) throw new Error('Member not required')
      const months = planRenewal === 'yearly' ? 12 : planRenewal === 'halfyearly' ? 6 : planRenewal === 'quarterly' ? 3 : 1
      const renewalMode = gym?.renewalMode || 'expiry'
      // Compute new expiry based on renewal mode
      const today = new Date()
      const previousExpiry = member.expiryDate ? new Date(member.expiryDate) : today
      let baseDate
      if (renewalMode === 'expiry' && previousExpiry > today) baseDate = previousExpiry
      else baseDate = today
      const newExpiry = new Date(baseDate); newExpiry.setMonth(newExpiry.getMonth() + months)
      const newExpiryStr = newExpiry.toISOString().slice(0, 10)

      const paymentId = uuidv4()
      await addDoc(collection(db, 'payments'), {
        id: paymentId,
        gymId: profile.gymId,
        memberId: member.id,
        memberName: member.name,
        amount: Number(amount),
        plan: planRenewal,
        mode: paymentMode,
        paymentDate,
        notes,
        previousExpiry: member.expiryDate || null,
        newExpiry: newExpiryStr,
        renewalMode,
        recordedBy: profile.uid,
        recordedByRole: profile.role,
        createdAt: serverTimestamp(),
      })
      // Update member expiry + plan
      await updateDoc(doc(db, 'members', member.id), {
        expiryDate: newExpiryStr,
        plan: planRenewal,
        status: 'active',
      })
      // Audit log
      await addDoc(collection(db, 'auditLogs'), {
        gymId: profile.gymId,
        action: 'payment.create',
        targetType: 'member',
        targetId: member.id,
        performedBy: profile.uid,
        performedByRole: profile.role,
        before: { expiryDate: member.expiryDate || null, plan: member.plan },
        after: { expiryDate: newExpiryStr, plan: planRenewal, amount: Number(amount) },
        timestamp: serverTimestamp(),
      })
      toast.success(`Payment recorded • expiry extended to ${newExpiryStr}`)
      setOpen(false); setAmount(''); setNotes(''); refresh()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(); in7.setDate(in7.getDate() + 7); const in7Str = in7.toISOString().slice(0, 10)
  const expired = members.filter(m => m.expiryDate && m.expiryDate < today)
  const expiringSoon = members.filter(m => m.expiryDate && m.expiryDate >= today && m.expiryDate <= in7Str)

  const totalRevenue = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const thisMonth = payments.filter(p => p.paymentDate?.slice(0, 7) === today.slice(0, 7)).reduce((s, p) => s + (Number(p.amount) || 0), 0)

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Renewals</h1>
          <p className="text-slate-500 mt-1">Renewal mode: <span className="font-medium text-slate-700">{gym?.renewalMode || 'expiry'}-based</span></p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" />Record Payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment & Renew</DialogTitle><DialogDescription>Member expiry will auto-extend.</DialogDescription></DialogHeader>
            <form onSubmit={addPayment} className="space-y-3">
              <div><Label>Member</Label><Select value={selectedMemberId} onValueChange={setSelectedMemberId}><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger><SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} · {m.phone}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount</Label><Input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                <div><Label>Plan</Label><Select value={planRenewal} onValueChange={setPlanRenewal}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly (+1mo)</SelectItem><SelectItem value="quarterly">Quarterly (+3mo)</SelectItem><SelectItem value="halfyearly">Half-Yearly (+6mo)</SelectItem><SelectItem value="yearly">Yearly (+12mo)</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Payment Mode</Label><Select value={paymentMode} onValueChange={setPaymentMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="bank">Bank Transfer</SelectItem></SelectContent></Select></div>
                <div><Label>Date</Label><Input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
              </div>
              <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={busy || !selectedMemberId} className="bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record & Renew'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Total Revenue</div><div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{totalRevenue.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">This Month</div><div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{thisMonth.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Expired</div><div className="text-2xl font-bold text-red-600">{expired.length}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Expiring in 7d</div><div className="text-2xl font-bold text-amber-600">{expiringSoon.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="dues">
        <TabsList><TabsTrigger value="dues">Dues ({expired.length + expiringSoon.length})</TabsTrigger><TabsTrigger value="history">Payment History ({payments.length})</TabsTrigger></TabsList>
        <TabsContent value="dues">
          <div className="space-y-2">
            {[...expired, ...expiringSoon].map(m => (
              <Card key={m.id}><CardContent className="pt-4 flex items-center justify-between">
                <div className="flex items-center gap-3"><AlertTriangle className={`w-5 h-5 ${expired.includes(m) ? 'text-red-600' : 'text-amber-600'}`} /><div><div className="font-medium">{m.name}</div><div className="text-xs text-slate-500">{m.phone}</div></div></div>
                <div className="text-right"><Badge className={expired.includes(m) ? 'bg-red-600' : 'bg-amber-600'}>{expired.includes(m) ? 'Expired' : 'Expiring'} • {m.expiryDate}</Badge></div>
              </CardContent></Card>
            ))}
            {!expired.length && !expiringSoon.length && <p className="text-slate-500 text-center py-8">No dues. Great job! 🎉</p>}
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className="space-y-2">
            {payments.map(p => (
              <Card key={p.id}><CardContent className="pt-4 flex items-center justify-between">
                <div><div className="font-medium">{p.memberName}</div><div className="text-xs text-slate-500">{p.paymentDate} • {p.mode} • {p.plan}</div></div>
                <div className="text-right"><div className="font-bold text-lg flex items-center"><IndianRupee className="w-4 h-4" />{Number(p.amount).toLocaleString()}</div><div className="text-xs text-slate-500 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3" />Exp: {p.newExpiry}</div></div>
              </CardContent></Card>
            ))}
            {!payments.length && <p className="text-slate-500 text-center py-8">No payments recorded yet.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function PaymentsPage() {
  return <AppShell allow={['gym_owner', 'receptionist']}><Page /></AppShell>
}
