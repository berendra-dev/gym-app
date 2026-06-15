'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Loader2, Pencil, Trash2, Sparkles, Tag, Clock, IndianRupee } from 'lucide-react'

const empty = { id: null, gymId: null, name: '', durationMonths: 1, price: 0, currency: 'INR', offerName: '', discountPct: 0, discountFlat: 0, active: true }

function Page() {
  const { profile } = useAuth()
  const [plans, setPlans] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)

  // Real-time listener - updates instantly across all gyms
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subscriptionPlans'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }))
      list.sort((a, b) => (a.durationMonths || 0) - (b.durationMonths || 0))
      setPlans(list)
    }, (e) => console.error('[Plans] snapshot error:', e))
    return () => unsub()
  }, [])

  const openCreate = () => { setForm(empty); setOpen(true) }
  const openEdit = (p) => { setForm({ ...empty, ...p }); setOpen(true) }

  const save = async () => {
    if (!form.name || !form.durationMonths || form.price === '') { toast.error('Name, duration, price required'); return }
    setBusy(true)
    try {
      await api.savePlan({ ...form, gymId: null /* super admin always creates global plans */ })
      toast.success(form.id ? 'Plan updated' : 'Plan created')
      setOpen(false)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const remove = async (p) => {
    if (!confirm(`Delete plan "${p.name}"? This cannot be undone.`)) return
    try { await api.deletePlan(p.id); toast.success('Plan deleted') }
    catch (e) { toast.error(e.message) }
  }

  const computeFinal = (p) => {
    let final = p.price || 0
    if (p.discountPct) final = final * (1 - p.discountPct / 100)
    if (p.discountFlat) final = final - p.discountFlat
    return Math.max(0, Math.round(final))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Sparkles className="w-7 h-7 text-orange-600" />Subscription Plans</h1>
          <p className="text-slate-500 mt-1">Global plans available to all gyms. Changes apply instantly across the platform.</p>
        </div>
        <Button onClick={openCreate} className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" />New Plan</Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(p => {
          const final = computeFinal(p)
          const hasDiscount = (p.discountPct > 0 || p.discountFlat > 0)
          return (
            <Card key={p.id} className={!p.active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription className="text-xs mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{p.durationMonths} month{p.durationMonths > 1 ? 's' : ''}</CardDescription>
                  </div>
                  <Badge variant={p.active ? 'default' : 'secondary'} className={p.active ? 'bg-emerald-600' : ''}>{p.active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  {hasDiscount && <span className="text-sm text-slate-400 line-through flex items-center"><IndianRupee className="w-3 h-3" />{p.price.toLocaleString()}</span>}
                  <span className="text-2xl font-bold text-slate-900 flex items-center"><IndianRupee className="w-5 h-5" />{final.toLocaleString()}</span>
                </div>
                {p.offerName && (
                  <div className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md w-fit">
                    <Tag className="w-3 h-3" /> <span className="font-medium">{p.offerName}</span>
                    {p.discountPct > 0 && <span>· {p.discountPct}% off</span>}
                    {p.discountFlat > 0 && <span>· ₹{p.discountFlat} off</span>}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(p)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {!plans.length && <p className="text-slate-500 col-span-3 text-center py-12">No plans yet. Click “New Plan” to create one.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit' : 'Create'} Subscription Plan</DialogTitle>
            <DialogDescription>Changes apply in real-time to all gym owner admission forms.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plan Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monthly Basic" /></div>
              <div><Label>Duration (months)</Label><Input type="number" min="1" value={form.durationMonths} onChange={e => setForm({ ...form, durationMonths: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (₹)</Label><Input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-t pt-3">
              <Label className="font-semibold flex items-center gap-1"><Tag className="w-4 h-4" />Optional Offer</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="col-span-3"><Label className="text-xs">Offer Name</Label><Input value={form.offerName} onChange={e => setForm({ ...form, offerName: e.target.value })} placeholder="Summer Sale" /></div>
                <div><Label className="text-xs">Discount %</Label><Input type="number" min="0" max="100" value={form.discountPct} onChange={e => setForm({ ...form, discountPct: e.target.value })} /></div>
                <div><Label className="text-xs">Flat Discount ₹</Label><Input type="number" min="0" value={form.discountFlat} onChange={e => setForm({ ...form, discountFlat: e.target.value })} /></div>
                <div className="flex items-end"><div className="text-xs text-slate-500">Final: <span className="font-bold text-slate-900">₹{computeFinal(form).toLocaleString()}</span></div></div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label>Active (visible to gym owners)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (form.id ? 'Update Plan' : 'Create Plan')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PlansPage() {
  return <AppShell allow={['super_admin']}><Page /></AppShell>
}
