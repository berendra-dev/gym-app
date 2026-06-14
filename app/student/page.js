'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Calendar, IndianRupee, ChevronLeft, ChevronRight, Check, X, Minus } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [member, setMember] = useState(null)
  const [gym, setGym] = useState(null)
  const [attendance, setAttendance] = useState({})
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })

  useEffect(() => {
    if (!profile?.gymId) return
    (async () => {
      const gymSnap = await getDoc(doc(db, 'gyms', profile.gymId))
      setGym(gymSnap.exists() ? gymSnap.data() : null)
      // Find this student's member record by linkedMemberId or by email/phone
      let memberDoc = null
      if (profile.linkedMemberId) {
        const memSnap = await getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId), where('id', '==', profile.linkedMemberId)))
        if (!memSnap.empty) memberDoc = memSnap.docs[0].data()
      }
      if (!memberDoc) {
        const memSnap = await getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId), where('email', '==', profile.email)))
        if (!memSnap.empty) memberDoc = memSnap.docs[0].data()
      }
      setMember(memberDoc)
      if (memberDoc) {
        const paySnap = await getDocs(query(collection(db, 'payments'), where('gymId', '==', profile.gymId), where('memberId', '==', memberDoc.id)))
        const pays = paySnap.docs.map(d => d.data())
        pays.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))
        setPayments(pays)
      }
      setLoading(false)
    })()
  }, [profile])

  useEffect(() => {
    if (!member) return
    (async () => {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString().slice(0, 10)
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10)
      const snap = await getDocs(query(collection(db, 'attendance'),
        where('gymId', '==', profile.gymId), where('memberId', '==', member.id),
        where('date', '>=', start), where('date', '<=', end)))
      const map = {}; snap.forEach(d => { const data = d.data(); map[data.date] = data })
      setAttendance(map)
    })()
  }, [member, cursor, profile])

  const days = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth()
    const firstDow = new Date(y, m, 1).getDay()
    const num = new Date(y, m + 1, 0).getDate()
    const arr = []
    for (let i = 0; i < firstDow; i++) arr.push(null)
    for (let d = 1; d <= num; d++) arr.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    return arr
  }, [cursor])

  const today = new Date().toISOString().slice(0, 10)
  const stats = useMemo(() => {
    const m = cursor.getMonth(), y = cursor.getFullYear()
    let present = 0, absent = 0
    Object.entries(attendance).forEach(([d, v]) => {
      const dd = new Date(d)
      if (dd.getMonth() === m && dd.getFullYear() === y) {
        if (v.status === 'present') present++; else if (v.status === 'absent') absent++
      }
    })
    return { present, absent }
  }, [attendance, cursor])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  const expired = member?.expiryDate && member.expiryDate < today
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {member?.photoURL ? <img src={member.photoURL} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-orange-100" /> : <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-2xl font-bold">{(profile.displayName || profile.email)?.charAt(0)}</div>}
        <div>
          <h1 className="text-3xl font-bold">Hi {member?.name || profile.displayName}!</h1>
          <p className="text-slate-500">{gym?.name}</p>
        </div>
      </div>

      {!member && (
        <Card className="border-amber-300 bg-amber-50"><CardContent className="pt-6 text-sm">Your account isn’t linked to a member record yet. Please ask the reception to link you.</CardContent></Card>
      )}

      {member && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Plan</div><div className="text-lg font-semibold capitalize">{member.plan}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Membership</div><Badge className={expired ? 'bg-red-600' : 'bg-emerald-600'}>{expired ? 'Expired' : 'Active'}</Badge><div className="text-xs mt-1 text-slate-500">until {member.expiryDate}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Present this month</div><div className="text-2xl font-bold text-emerald-600">{stats.present}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-slate-500">Total paid</div><div className="text-lg font-bold flex items-center"><IndianRupee className="w-4 h-4" />{totalPaid.toLocaleString()}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-600" />My Attendance</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <div className="font-semibold w-36 text-center text-sm">{monthLabel}</div>
                <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1.5">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>)}
                {days.map((dateStr, i) => {
                  if (!dateStr) return <div key={i} />
                  const status = attendance[dateStr]?.status
                  const bg = status === 'present' ? 'bg-emerald-500 text-white' : status === 'absent' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'
                  return <div key={i} className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs font-medium ${bg}`}><span>{parseInt(dateStr.slice(-2), 10)}</span>{status === 'present' && <Check className="w-3 h-3" />}{status === 'absent' && <X className="w-3 h-3" />}{!status && <Minus className="w-3 h-3" />}</div>
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Payment History</CardTitle><CardDescription>{payments.length} payments</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div><div className="font-medium text-sm capitalize">{p.plan} renewal</div><div className="text-xs text-slate-500">{p.paymentDate} · {p.mode}</div></div>
                  <div className="text-right"><div className="font-bold flex items-center"><IndianRupee className="w-4 h-4" />{Number(p.amount).toLocaleString()}</div><div className="text-xs text-slate-500">Until {p.newExpiry}</div></div>
                </div>
              ))}
              {!payments.length && <p className="text-slate-500 text-center py-6 text-sm">No payments yet.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default function StudentPage() {
  return <AppShell allow={['student']}><Page /></AppShell>
}
