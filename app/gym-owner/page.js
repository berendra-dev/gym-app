'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import Link from 'next/link'
import PlatformOffersBanner from '@/components/PlatformOffersBanner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, UserCheck, UserX, CalendarClock, TrendingUp, Building2, Loader2 } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [gym, setGym] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.gymId) return
    (async () => {
      const today = new Date().toISOString().slice(0, 10)
      const [gymSnap, membersSnap, attResp] = await Promise.all([
        getDoc(doc(db, 'gyms', profile.gymId)),
        getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId))),
        api.listAttendance({ gymId: profile.gymId, from: today, to: today }).catch(() => ({ records: [] })),
      ])
      const members = membersSnap.docs.map(d => d.data())
      const presentToday = (attResp.records || []).filter(d => d.status === 'present').length
      const now = new Date()
      const expired = members.filter(m => m.expiryDate && new Date(m.expiryDate) < now).length
      const newThisMonth = members.filter(m => {
        if (!m.joinDate) return false
        const d = new Date(m.joinDate)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }).length
      setGym(gymSnap.exists() ? gymSnap.data() : null)
      setStats({
        total: members.length,
        active: members.filter(m => m.status !== 'inactive').length,
        presentToday,
        absentToday: Math.max(0, members.length - presentToday),
        expired,
        newThisMonth,
      })
      setLoading(false)
    })()
  }, [profile])

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  const kpis = [
    { label: 'Total Members', value: stats.total, icon: Users, color: 'bg-blue-100 text-blue-700' },
    { label: 'Active Members', value: stats.active, icon: UserCheck, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Present Today', value: stats.presentToday, icon: UserCheck, color: 'bg-green-100 text-green-700' },
    { label: 'Absent Today', value: stats.absentToday, icon: UserX, color: 'bg-red-100 text-red-700' },
    { label: 'Expired Memberships', value: stats.expired, icon: CalendarClock, color: 'bg-amber-100 text-amber-700' },
    { label: 'New This Month', value: stats.newThisMonth, icon: TrendingUp, color: 'bg-purple-100 text-purple-700' },
  ]

  return (
    <div className="space-y-6">
      <PlatformOffersBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Building2 className="w-7 h-7 text-orange-600" />{gym?.name || 'My Gym'}</h1>
          <p className="text-slate-500 mt-1">Welcome back, {profile.displayName}</p>
        </div>
        <Badge className="bg-orange-600">Plan: {gym?.plan || 'basic'}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${k.color}`}><k.icon className="w-5 h-5" /></div>
              <div className="text-3xl font-bold tracking-tight">{k.value}</div>
              <div className="text-xs text-slate-500 mt-1">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/gym-owner/members"><Card className="hover:shadow-md transition cursor-pointer h-full"><CardHeader><CardTitle>Manage Members</CardTitle><CardDescription>Add, view, and manage all gym members.</CardDescription></CardHeader></Card></Link>
        <Link href="/gym-owner/attendance"><Card className="hover:shadow-md transition cursor-pointer h-full"><CardHeader><CardTitle>Calendar Attendance</CardTitle><CardDescription>Mark and view attendance with color-coded calendar.</CardDescription></CardHeader></Card></Link>
        <Link href="/gym-owner/revenue"><Card className="hover:shadow-md transition cursor-pointer h-full"><CardHeader><CardTitle>Revenue Dashboard</CardTitle><CardDescription>Track payments, reactivations & member status.</CardDescription></CardHeader></Card></Link>
      </div>
    </div>
  )
}

export default function GymOwnerPage() {
  return <AppShell allow={['gym_owner']}><Page /></AppShell>
}
