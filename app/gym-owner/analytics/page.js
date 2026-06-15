'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, BarChart3, Activity, UserCheck, UserX, RefreshCcw, TrendingUp, Calendar } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [attendance, setAttendance] = useState([])

  const todayStr = new Date().toISOString().slice(0, 10)
  const monthStart = todayStr.slice(0, 7) + '-01'
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(todayStr)

  const load = async () => {
    if (!profile?.gymId) return
    setLoading(true)
    try {
      const [memSnap, attSnap] = await Promise.all([
        getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId))),
        getDocs(query(
          collection(db, 'attendance'),
          where('gymId', '==', profile.gymId),
          where('date', '>=', from),
          where('date', '<=', to),
        )),
      ])
      setMembers(memSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setAttendance(attSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [profile, from, to])

  const stats = useMemo(() => {
    const present = attendance.filter(a => a.status === 'present')
    const absent = attendance.filter(a => a.status === 'absent')
    const manual = attendance.filter(a => a.manual === true).length
    const qr = attendance.filter(a => a.manual === false || a.markedBy === 'qr_self_checkin').length

    // Days in range
    const start = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1)

    // Unique members who attended at least once
    const uniqueAttended = new Set(present.map(a => a.memberId))
    const avgPerDay = present.length / days

    // Daily series
    const byDate = {}
    present.forEach(a => { byDate[a.date] = (byDate[a.date] || 0) + 1 })
    const series = []
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      series.push({ key, label: d.getDate(), value: byDate[key] || 0 })
    }
    const seriesMax = Math.max(1, ...series.map(s => s.value))

    // Per-member counts
    const byMember = {}
    present.forEach(a => {
      const k = a.memberId
      if (!byMember[k]) byMember[k] = { id: k, name: a.memberName || 'Unknown', count: 0, lastDate: null }
      byMember[k].count += 1
      if (!byMember[k].lastDate || a.date > byMember[k].lastDate) byMember[k].lastDate = a.date
    })

    // Inactive: members with 0 check-ins in range (but with valid expiry)
    const allMemberIds = new Set(members.map(m => m.id))
    const attendedIds = new Set(Object.keys(byMember))
    const inactiveInRange = members.filter(m => !attendedIds.has(m.id))
                                   .filter(m => m.expiryDate && m.expiryDate >= from) // had/has membership in range

    const memberRows = Object.values(byMember).sort((a, b) => b.count - a.count)

    return {
      total: attendance.length, presentCount: present.length, absentCount: absent.length,
      manual, qr, days, avgPerDay,
      uniqueAttended: uniqueAttended.size, totalMembers: allMemberIds.size,
      participationPct: allMemberIds.size > 0 ? Math.round((uniqueAttended.size / allMemberIds.size) * 100) : 0,
      series, seriesMax, memberRows, inactiveInRange,
    }
  }, [attendance, members, from, to])

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-orange-600" />Attendance Analytics
          </h1>
          <p className="text-slate-500 mt-1">Track gym-wide participation & per-member visit frequency</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCcw className="w-4 h-4 mr-1" />Refresh</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                const d = new Date(); d.setDate(d.getDate() - 6)
                setFrom(d.toISOString().slice(0, 10)); setTo(todayStr)
              }}>Last 7 days</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const d = new Date(); d.setDate(d.getDate() - 29)
                setFrom(d.toISOString().slice(0, 10)); setTo(todayStr)
              }}>Last 30 days</Button>
              <Button size="sm" variant="outline" onClick={() => {
                setFrom(todayStr.slice(0, 7) + '-01'); setTo(todayStr)
              }}>This month</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5">
          <div className="text-xs text-slate-500">Total Check-ins</div>
          <div className="text-2xl font-bold flex items-center gap-1"><Activity className="w-5 h-5 text-orange-600" />{stats.presentCount}</div>
          <div className="text-xs text-slate-500 mt-1">over {stats.days} days</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="text-xs text-slate-500">Avg per Day</div>
          <div className="text-2xl font-bold flex items-center gap-1"><TrendingUp className="w-5 h-5 text-emerald-600" />{stats.avgPerDay.toFixed(1)}</div>
          <div className="text-xs text-slate-500 mt-1">check-ins/day</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="text-xs text-slate-500">Unique Members</div>
          <div className="text-2xl font-bold flex items-center gap-1"><UserCheck className="w-5 h-5 text-blue-600" />{stats.uniqueAttended}</div>
          <div className="text-xs text-slate-500 mt-1">{stats.participationPct}% participation</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="text-xs text-slate-500">QR vs Manual</div>
          <div className="text-2xl font-bold">{stats.qr} <span className="text-sm text-slate-400">/ {stats.manual}</span></div>
          <div className="text-xs text-slate-500 mt-1">QR-scan / manual</div>
        </CardContent></Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Check-ins</CardTitle>
          <CardDescription>Present-marked attendance per day in selected range.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
            {stats.series.map(s => (
              <div key={s.key} className="flex flex-col items-center gap-1 min-w-[18px]">
                <div className="text-[10px] text-slate-500">{s.value || ''}</div>
                <div className="w-4 bg-slate-100 rounded flex items-end" style={{ height: '120px' }}>
                  <div className="w-full bg-gradient-to-t from-orange-600 to-orange-400 rounded"
                       style={{ height: `${(s.value / stats.seriesMax) * 100}%` }} />
                </div>
                <div className="text-[10px] text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="top">
        <TabsList>
          <TabsTrigger value="top">Top Attendees ({stats.memberRows.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({stats.inactiveInRange.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="top">
          <Card>
            <CardContent className="pt-4">
              {stats.memberRows.length === 0 ? <p className="text-slate-500 text-center py-8">No check-ins in selected range.</p> : (
                <div className="space-y-2">
                  {stats.memberRows.slice(0, 100).map((m, idx) => {
                    const pct = stats.days > 0 ? Math.round((m.count / stats.days) * 100) : 0
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{m.name}</div>
                            <div className="w-full bg-slate-100 rounded h-2 mt-1">
                              <div className="bg-orange-600 h-2 rounded" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold">{m.count}</div>
                          <div className="text-xs text-slate-500">last: {m.lastDate}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="inactive">
          <Card>
            <CardContent className="pt-4">
              {stats.inactiveInRange.length === 0 ? <p className="text-slate-500 text-center py-8">All members checked in at least once. 🎉</p> : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {stats.inactiveInRange.map(m => {
                    const expired = m.expiryDate && m.expiryDate < todayStr
                    return (
                      <div key={m.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />exp {m.expiryDate || '—'}</div>
                        </div>
                        <Badge className={expired ? 'bg-red-600' : 'bg-slate-500'}>
                          {expired ? 'Expired' : '0 visits'}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AnalyticsPage() {
  return <AppShell allow={['gym_owner']}><Page /></AppShell>
}
