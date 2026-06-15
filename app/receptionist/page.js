'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, UserCheck, Loader2, Calendar } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [gym, setGym] = useState(null)

  useEffect(() => {
    if (!profile?.gymId) return
    (async () => {
      const today = new Date().toISOString().slice(0, 10)
      const [gymSnap, membersSnap, attResp] = await Promise.all([
        getDoc(doc(db, 'gyms', profile.gymId)),
        getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId))),
        api.listAttendance({ gymId: profile.gymId, from: today, to: today }).catch(() => ({ records: [] })),
      ])
      setGym(gymSnap.exists() ? gymSnap.data() : null)
      setStats({
        total: membersSnap.size,
        presentToday: (attResp.records || []).filter(d => d.status === 'present').length,
      })
    })()
  }, [profile])

  if (!stats) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reception Desk</h1>
        <p className="text-slate-500 mt-1">{gym?.name} • Welcome, {profile.displayName}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardContent className="pt-6"><div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3"><Users className="w-5 h-5" /></div><div className="text-3xl font-bold">{stats.total}</div><div className="text-sm text-slate-500">Total Members</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3"><UserCheck className="w-5 h-5" /></div><div className="text-3xl font-bold">{stats.presentToday}</div><div className="text-sm text-slate-500">Present Today</div></CardContent></Card>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/gym-owner/members"><Card className="hover:shadow-md transition cursor-pointer"><CardHeader><CardTitle>Members</CardTitle><CardDescription>Add and manage members (no permanent delete).</CardDescription></CardHeader></Card></Link>
        <Link href="/gym-owner/attendance"><Card className="hover:shadow-md transition cursor-pointer"><CardHeader><CardTitle>Attendance</CardTitle><CardDescription>Mark daily attendance with reason logging.</CardDescription></CardHeader></Card></Link>
      </div>
    </div>
  )
}

export default function ReceptionistPage() {
  return <AppShell allow={['receptionist']}><Page /></AppShell>
}
