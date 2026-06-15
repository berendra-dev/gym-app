'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, IndianRupee, TrendingUp, TrendingDown, Users, UserCheck, UserX, FileDown, Calendar, BarChart3 } from 'lucide-react'
import { generateReceiptPDF } from '@/lib/receipt'

function Page() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [gym, setGym] = useState(null)
  const [members, setMembers] = useState([])
  const [payments, setPayments] = useState([])

  // filters
  const todayStr = new Date().toISOString().slice(0, 10)
  const monthStart = todayStr.slice(0, 7) + '-01'
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(todayStr)

  useEffect(() => {
    if (!profile?.gymId) return
    (async () => {
      try {
        const [gymSnap, memSnap, paySnap] = await Promise.all([
          getDoc(doc(db, 'gyms', profile.gymId)),
          getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId))),
          getDocs(query(collection(db, 'payments'), where('gymId', '==', profile.gymId))),
        ])
        setGym(gymSnap.exists() ? gymSnap.data() : null)
        setMembers(memSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        const pay = paySnap.docs.map(d => ({ id: d.id, ...d.data() }))
        pay.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))
        setPayments(pay)
      } catch (e) { toast.error(e.message) }
      setLoading(false)
    })()
  }, [profile])

  // Derived data
  const stats = useMemo(() => {
    const today = todayStr
    const tStart = today.slice(0, 7) + '-01'
    const lm = new Date(); lm.setMonth(lm.getMonth() - 1); lm.setDate(1)
    const lastStart = lm.toISOString().slice(0, 10)
    const lastEnd = (() => { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10) })()

    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const thisMonth = payments.filter(p => p.paymentDate >= tStart && p.paymentDate <= today)
                              .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const lastMonth = payments.filter(p => p.paymentDate >= lastStart && p.paymentDate <= lastEnd)
                              .reduce((s, p) => s + (Number(p.amount) || 0), 0)

    const active = members.filter(m => m.expiryDate && m.expiryDate >= today && m.status !== 'inactive').length
    const expired = members.filter(m => !m.expiryDate || m.expiryDate < today).length
    const inactive = members.filter(m => m.status === 'inactive').length

    // Inside selected range
    const rangePayments = payments.filter(p => p.paymentDate >= from && p.paymentDate <= to)
    const rangeRevenue = rangePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const rangeReactivations = rangePayments.filter(p => p.reactivated).length

    // Last 6 months series
    const series = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const sum = payments.filter(p => p.paymentDate?.slice(0, 7) === key)
                          .reduce((s, p) => s + (Number(p.amount) || 0), 0)
      series.push({ key, label: d.toLocaleString('en-US', { month: 'short' }), value: sum })
    }
    const seriesMax = Math.max(1, ...series.map(s => s.value))

    // By plan
    const byPlan = {}
    rangePayments.forEach(p => {
      const k = p.plan || 'Unknown'
      byPlan[k] = (byPlan[k] || 0) + (Number(p.amount) || 0)
    })
    // By mode
    const byMode = {}
    rangePayments.forEach(p => {
      const k = (p.mode || 'cash').toUpperCase()
      byMode[k] = (byMode[k] || 0) + (Number(p.amount) || 0)
    })

    const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : (thisMonth > 0 ? 100 : 0)
    return {
      total, thisMonth, lastMonth, growth,
      active, expired, inactive,
      rangePayments, rangeRevenue, rangeReactivations,
      series, seriesMax, byPlan, byMode,
    }
  }, [payments, members, from, to, todayStr])

  const reprint = async (p) => {
    try {
      const m = members.find(x => x.id === p.memberId) || { name: p.memberName, phone: p.memberPhone, id: p.memberId }
      await generateReceiptPDF({ gym: gym || {}, member: m, payment: p })
    } catch (e) { toast.error(e.message) }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-orange-600" />Revenue Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Track payments, renewals & member status • {gym?.name}</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500">Total Revenue (All time)</div>
            <div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500">This Month</div>
            <div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{stats.thisMonth.toLocaleString()}</div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${stats.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {stats.growth >= 0 ? '+' : ''}{stats.growth}% vs last
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500">Last Month</div>
            <div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{stats.lastMonth.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500">Total Payments</div>
            <div className="text-2xl font-bold">{payments.length}</div>
            <div className="text-xs mt-1 text-slate-500">{stats.rangeReactivations} reactivations in range</div>
          </CardContent>
        </Card>
      </div>

      {/* Member status */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center"><UserCheck className="w-6 h-6" /></div>
            <div>
              <div className="text-3xl font-bold">{stats.active}</div>
              <div className="text-xs text-slate-500">Active Members</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-100 text-red-700 flex items-center justify-center"><UserX className="w-6 h-6" /></div>
            <div>
              <div className="text-3xl font-bold">{stats.expired}</div>
              <div className="text-xs text-slate-500">Expired Memberships</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center"><Users className="w-6 h-6" /></div>
            <div>
              <div className="text-3xl font-bold">{members.length}</div>
              <div className="text-xs text-slate-500">Total Members</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue (Last 6 months)</CardTitle>
          <CardDescription>Total collected per month, including renewals & reactivations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-3 items-end h-44">
            {stats.series.map(s => (
              <div key={s.key} className="flex flex-col items-center gap-2">
                <div className="text-xs font-mono text-slate-600">₹{s.value.toLocaleString()}</div>
                <div className="w-full bg-orange-100 rounded-md relative h-32 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-orange-600 to-orange-400 rounded-md transition-all"
                    style={{ height: `${(s.value / stats.seriesMax) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Range filter + breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Revenue Breakdown</CardTitle>
          <CardDescription>Filter by date range — defaults to current month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div className="ml-auto text-right">
              <div className="text-xs text-slate-500">Range Revenue</div>
              <div className="text-2xl font-bold flex items-center justify-end"><IndianRupee className="w-5 h-5" />{stats.rangeRevenue.toLocaleString()}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold mb-2">By Plan</div>
              {Object.entries(stats.byPlan).length === 0 && <div className="text-xs text-slate-500">No data in range.</div>}
              {Object.entries(stats.byPlan).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                const pct = stats.rangeRevenue > 0 ? Math.round((v / stats.rangeRevenue) * 100) : 0
                return (
                  <div key={k} className="mb-2">
                    <div className="flex justify-between text-xs"><span className="text-slate-600">{k}</span><span className="font-mono">₹{v.toLocaleString()} · {pct}%</span></div>
                    <div className="w-full bg-slate-100 rounded h-2 mt-1"><div className="bg-orange-600 h-2 rounded" style={{ width: `${pct}%` }} /></div>
                  </div>
                )
              })}
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">By Payment Mode</div>
              {Object.entries(stats.byMode).length === 0 && <div className="text-xs text-slate-500">No data in range.</div>}
              {Object.entries(stats.byMode).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                const pct = stats.rangeRevenue > 0 ? Math.round((v / stats.rangeRevenue) * 100) : 0
                return (
                  <div key={k} className="mb-2">
                    <div className="flex justify-between text-xs"><span className="text-slate-600">{k}</span><span className="font-mono">₹{v.toLocaleString()} · {pct}%</span></div>
                    <div className="w-full bg-slate-100 rounded h-2 mt-1"><div className="bg-emerald-600 h-2 rounded" style={{ width: `${pct}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent payments with receipt download */}
      <Card>
        <CardHeader><CardTitle>Recent Payments</CardTitle><CardDescription>Click Receipt to re-download the PDF.</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.rangePayments.slice(0, 50).map(p => (
              <div key={p.id} className="border rounded-lg p-3 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {p.memberName}
                    {p.reactivated && <Badge variant="outline" className="border-amber-500 text-amber-700">Reactivated</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    <span><Calendar className="w-3 h-3 inline mr-1" />{p.paymentDate}</span>
                    <span>{p.mode?.toUpperCase()}</span>
                    <span>{p.plan}</span>
                    {p.receiptNo && <span className="font-mono">{p.receiptNo}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-bold text-lg flex items-center"><IndianRupee className="w-4 h-4" />{Number(p.amount).toLocaleString()}</div>
                  <Button size="sm" variant="outline" onClick={() => reprint(p)}><FileDown className="w-3 h-3 mr-1" />Receipt</Button>
                </div>
              </div>
            ))}
            {!stats.rangePayments.length && <p className="text-slate-500 text-center py-8">No payments in selected range.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RevenuePage() {
  // Strict RBAC: Receptionist cannot access revenue.
  return <AppShell allow={['gym_owner']}><Page /></AppShell>
}
