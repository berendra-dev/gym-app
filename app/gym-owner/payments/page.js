'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, setDoc, addDoc, doc, updateDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Loader2, IndianRupee, AlertTriangle, Calendar, Bell, FileDown, RefreshCw } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { generateReceiptPDF, makeReceiptNo } from '@/lib/receipt'

function Page() {
  const { profile } = useAuth()
  const [gym, setGym] = useState(null)
  const [members, setMembers] = useState([])
  const [payments, setPayments] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Form
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [planSource, setPlanSource] = useState('plan') // 'plan' | 'custom'
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [customMonths, setCustomMonths] = useState(1)
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const isReceptionist = profile?.role === 'receptionist'

  // Load subscription plans (live)
  useEffect(() => {
    if (!profile?.gymId) return
    const unsub = onSnapshot(collection(db, 'subscriptionPlans'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }))
        .filter(p => p.active && (!p.gymId || p.gymId === profile.gymId))
      list.sort((a, b) => (a.durationMonths || 0) - (b.durationMonths || 0))
      setPlans(list)
    })
    return () => unsub()
  }, [profile])

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

  const selectedMember = members.find(m => m.id === selectedMemberId)
  const selectedPlan = plans.find(p => p.id === selectedPlanId)

  // Derived: months & price preview
  const today = new Date().toISOString().slice(0, 10)
  const months = planSource === 'plan'
    ? (selectedPlan?.durationMonths || 0)
    : Math.max(1, Number(customMonths) || 1)

  // Compute base date for new expiry (strict rule):
  //   • If member is still active (expiryDate >= today) → expiryDate + months
  //   • Else (expired or no expiry)                       → today + months
  const computeNewExpiry = (member, m) => {
    if (!member || !m) return ''
    const expStr = member.expiryDate
    const baseStr = (expStr && expStr >= today) ? expStr : today
    const base = new Date(baseStr + 'T00:00:00')
    base.setMonth(base.getMonth() + m)
    return base.toISOString().slice(0, 10)
  }
  const newExpiryStr = computeNewExpiry(selectedMember, months)
  const wasExpired = selectedMember?.expiryDate ? selectedMember.expiryDate < today : true
  const suggestedPlanPrice = (() => {
    if (planSource !== 'plan' || !selectedPlan) return null
    let f = selectedPlan.price || 0
    if (selectedPlan.discountPct) f = f * (1 - selectedPlan.discountPct / 100)
    if (selectedPlan.discountFlat) f = f - selectedPlan.discountFlat
    return Math.max(0, Math.round(f))
  })()

  // Autofill amount when plan changes
  useEffect(() => {
    if (planSource === 'plan' && suggestedPlanPrice !== null && (!amount || amount === '')) {
      setAmount(String(suggestedPlanPrice))
    }
  }, [selectedPlanId, planSource]) // eslint-disable-line

  const resetForm = () => {
    setSelectedMemberId(''); setSelectedPlanId(''); setCustomMonths(1)
    setAmount(''); setNotes(''); setPaymentMode('cash'); setPlanSource('plan')
    setPaymentDate(new Date().toISOString().slice(0, 10))
  }

  const addPayment = async (e) => {
    e.preventDefault()
    if (!selectedMember) { toast.error('Select a member'); return }
    if (!months || months < 1) { toast.error('Select a plan or enter months'); return }
    if (!amount || Number(amount) < 0) { toast.error('Enter a valid amount'); return }
    setBusy(true)
    try {
      const paymentId = uuidv4()
      const receiptNo = makeReceiptNo(profile.gymId)
      const planLabel = planSource === 'plan'
        ? (selectedPlan?.name || 'Custom')
        : `Custom (${months}mo)`

      const paymentDoc = {
        id: paymentId,
        receiptNo,
        gymId: profile.gymId,
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        memberPhone: selectedMember.phone || null,
        amount: Number(amount),
        plan: planLabel,
        planId: selectedPlan?.id || null,
        durationMonths: months,
        mode: paymentMode,
        paymentDate,
        notes: notes || null,
        previousExpiry: selectedMember.expiryDate || null,
        newExpiry: newExpiryStr,
        wasExpired,
        reactivated: wasExpired,
        recordedBy: profile.uid,
        recordedByRole: profile.role,
        recordedByName: profile.displayName || profile.email,
        createdAt: serverTimestamp(),
      }
      // setDoc with explicit id ensures we can locate this payment later by id
      await setDoc(doc(db, 'payments', paymentId), paymentDoc)

      // Update member: extend expiry, mark active, save plan label
      await updateDoc(doc(db, 'members', selectedMember.id), {
        expiryDate: newExpiryStr,
        plan: planLabel,
        status: 'active',
        lastRenewalDate: paymentDate,
        lastReceiptNo: receiptNo,
      })

      // Audit log
      await addDoc(collection(db, 'auditLogs'), {
        gymId: profile.gymId,
        action: wasExpired ? 'payment.reactivate' : 'payment.renew',
        targetType: 'member',
        targetId: selectedMember.id,
        performedBy: profile.uid,
        performedByRole: profile.role,
        performedByName: profile.displayName || profile.email,
        before: { expiryDate: selectedMember.expiryDate || null, plan: selectedMember.plan, status: selectedMember.status || null },
        after: { expiryDate: newExpiryStr, plan: planLabel, status: 'active', amount: Number(amount), receiptNo },
        timestamp: serverTimestamp(),
      })

      toast.success(`${wasExpired ? 'Reactivated' : 'Renewed'} • valid till ${newExpiryStr}`)

      // Auto-generate receipt PDF
      try {
        await generateReceiptPDF({
          gym: gym || {},
          member: selectedMember,
          payment: { ...paymentDoc, paymentDate, receiptNo },
        })
      } catch (e) { console.warn('Receipt PDF failed:', e) }

      setOpen(false); resetForm(); refresh()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  const reprintReceipt = async (p) => {
    try {
      const m = members.find(x => x.id === p.memberId) || { name: p.memberName, phone: p.memberPhone, id: p.memberId }
      await generateReceiptPDF({ gym: gym || {}, member: m, payment: p })
    } catch (e) { toast.error('Receipt generation failed: ' + e.message) }
  }

  const in7 = new Date(); in7.setDate(in7.getDate() + 7); const in7Str = in7.toISOString().slice(0, 10)
  const expired = members.filter(m => m.expiryDate && m.expiryDate < today)
  const expiringSoon = members.filter(m => m.expiryDate && m.expiryDate >= today && m.expiryDate <= in7Str)

  const totalRevenue = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const thisMonth = payments.filter(p => p.paymentDate?.slice(0, 7) === today.slice(0, 7)).reduce((s, p) => s + (Number(p.amount) || 0), 0)

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments &amp; Renewals</h1>
          <p className="text-slate-500 mt-1">
            Active members get expiry extended from current expiry. Expired members are reactivated from today.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={async () => {
            try {
              const r = await api.sendExpiryAlerts({ gymId: profile.gymId, daysAhead: 7 })
              toast.success(`Alerts: ${r.totalCandidates} candidates · ${r.tokensSent} tokens · pushed ${r.push?.successCount ?? 0}`)
            } catch (e) { toast.error(e.message) }
          }}><Bell className="w-4 h-4 mr-1" />Send Expiry Alerts</Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm() }}>
            <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" />Record Payment</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Record Payment &amp; Renew</DialogTitle>
                <DialogDescription>Membership will be {wasExpired ? 'reactivated' : 'extended'} automatically. A PDF receipt is generated on save.</DialogDescription>
              </DialogHeader>
              <form onSubmit={addPayment} className="space-y-3">
                <div>
                  <Label>Member</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>{members.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {m.phone} {m.expiryDate ? `· exp ${m.expiryDate}` : ''}
                      </SelectItem>
                    ))}</SelectContent>
                  </Select>
                  {selectedMember && (
                    <div className="text-xs mt-1 flex items-center gap-2">
                      <Badge className={wasExpired ? 'bg-red-600' : 'bg-emerald-600'}>
                        {wasExpired ? 'Expired' : 'Active'}
                      </Badge>
                      <span className="text-slate-500">Current expiry: {selectedMember.expiryDate || '—'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Plan Source</Label>
                  <Select value={planSource} onValueChange={setPlanSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plan">From Subscription Plans</SelectItem>
                      <SelectItem value="custom">Custom (months only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {planSource === 'plan' ? (
                  <div>
                    <Label>Subscription Plan</Label>
                    <Select value={selectedPlanId} onValueChange={(v) => { setSelectedPlanId(v); setAmount('') }}>
                      <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                      <SelectContent>
                        {plans.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">No plans defined.</div>}
                        {plans.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.durationMonths}mo · ₹{p.price}
                            {p.offerName ? ` · ${p.offerName}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPlan && suggestedPlanPrice !== null && (
                      <p className="text-xs text-slate-500 mt-1">Suggested price after offers: ₹{suggestedPlanPrice.toLocaleString()}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <Label>Duration (months)</Label>
                    <Input type="number" min="1" value={customMonths} onChange={e => setCustomMonths(e.target.value)} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label>Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Payment Date</Label>
                  <Input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>

                {selectedMember && months > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">{wasExpired ? 'Reactivate from' : 'Extend from'}:</span>
                      <span className="font-mono">{(selectedMember.expiryDate && selectedMember.expiryDate >= today) ? selectedMember.expiryDate : today}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-slate-600">Add:</span>
                      <span className="font-mono">+{months} month(s)</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 font-bold text-orange-700">
                      <span>New expiry:</span>
                      <span className="font-mono">{newExpiryStr}</span>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit" disabled={busy || !selectedMember || !months}
                          className="bg-orange-600 hover:bg-orange-700">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            (wasExpired ? <><RefreshCw className="w-4 h-4 mr-1" />Reactivate &amp; Receipt</>
                                        : <><Plus className="w-4 h-4 mr-1" />Renew &amp; Receipt</>)}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Total Revenue</div><div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{totalRevenue.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">This Month</div><div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{thisMonth.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Expired</div><div className="text-2xl font-bold text-red-600">{expired.length}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Expiring in 7d</div><div className="text-2xl font-bold text-amber-600">{expiringSoon.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="dues">
        <TabsList>
          <TabsTrigger value="dues">Dues ({expired.length + expiringSoon.length})</TabsTrigger>
          <TabsTrigger value="history">Payment History ({payments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="dues">
          <div className="space-y-2">
            {[...expired, ...expiringSoon].map(m => (
              <Card key={m.id}><CardContent className="pt-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-5 h-5 ${expired.includes(m) ? 'text-red-600' : 'text-amber-600'}`} />
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-slate-500">{m.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={expired.includes(m) ? 'bg-red-600' : 'bg-amber-600'}>
                    {expired.includes(m) ? 'Expired' : 'Expiring'} • {m.expiryDate}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedMemberId(m.id); setOpen(true) }}>
                    <RefreshCw className="w-3 h-3 mr-1" />Renew
                  </Button>
                </div>
              </CardContent></Card>
            ))}
            {!expired.length && !expiringSoon.length && <p className="text-slate-500 text-center py-8">No dues. Great job! 🎉</p>}
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className="space-y-2">
            {payments.map(p => (
              <Card key={p.id}><CardContent className="pt-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {p.memberName}
                    {p.reactivated && <Badge variant="outline" className="border-amber-500 text-amber-700">Reactivated</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.paymentDate} • {p.mode} • {p.plan}
                    {p.receiptNo && ` • ${p.receiptNo}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-lg flex items-center"><IndianRupee className="w-4 h-4" />{Number(p.amount).toLocaleString()}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3" />Exp: {p.newExpiry}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => reprintReceipt(p)}>
                    <FileDown className="w-3 h-3 mr-1" />Receipt
                  </Button>
                </div>
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
  // Receptionist can also access (to record initial collection); both can view & reprint receipts.
  return <AppShell allow={['gym_owner', 'receptionist']}><Page /></AppShell>
}
