'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Mail, Check, X, ArrowRight } from 'lucide-react'

function Page() {
  const [requests, setRequests] = useState([])
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'emailChangeRequests'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      setRequests(list)
    })
    return () => unsub()
  }, [])

  const approve = async (r) => {
    if (!confirm(`Approve email change to ${r.newEmail}? The old email ${r.currentEmail} will be deactivated.`)) return
    setBusy(r.id)
    try { await api.approveEmailChange(r.id); toast.success('Email updated. Old email deactivated.') }
    catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }
  const reject = async (r) => {
    const reason = prompt('Reason for rejection?') || ''
    setBusy(r.id)
    try { await api.rejectEmailChange(r.id, reason); toast.success('Rejected') }
    catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const past = requests.filter(r => r.status !== 'pending')

  const RequestCard = ({ r }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{r.requestedByName}</CardTitle>
          <Badge variant="outline" className="capitalize">{r.requestedByRole?.replace('_', ' ')}</Badge>
          <Badge className={r.status === 'pending' ? 'bg-amber-600' : r.status === 'approved' ? 'bg-emerald-600' : 'bg-red-600'}>{r.status}</Badge>
        </div>
        <CardDescription className="flex items-center gap-2 text-sm font-mono mt-1">
          <span className="line-through text-slate-400">{r.currentEmail}</span>
          <ArrowRight className="w-4 h-4 text-orange-600" />
          <span className="text-slate-900 font-medium">{r.newEmail}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {r.status === 'pending' ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy === r.id} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approve(r)}>{busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Approve</>}</Button>
            <Button size="sm" variant="outline" className="text-red-600" disabled={busy === r.id} onClick={() => reject(r)}><X className="w-3 h-3 mr-1" />Reject</Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">{r.status === 'approved' ? 'Approved' : 'Rejected'} · {r.rejectionReason || ''}</p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 mb-1"><Mail className="w-7 h-7 text-orange-600" />Email Change Requests</h1>
      <p className="text-slate-500 mb-6">Approve to update the Firebase Auth email — old email is automatically deactivated for login.</p>
      <Tabs defaultValue="pending">
        <TabsList><TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger><TabsTrigger value="past">History ({past.length})</TabsTrigger></TabsList>
        <TabsContent value="pending"><div className="grid md:grid-cols-2 gap-3">{pending.map(r => <RequestCard key={r.id} r={r} />)}{!pending.length && <p className="text-slate-500 col-span-2 text-center py-12">No pending requests.</p>}</div></TabsContent>
        <TabsContent value="past"><div className="grid md:grid-cols-2 gap-3">{past.map(r => <RequestCard key={r.id} r={r} />)}{!past.length && <p className="text-slate-500 col-span-2 text-center py-12">No history.</p>}</div></TabsContent>
      </Tabs>
    </div>
  )
}

export default function EmailRequestsPage() {
  return <AppShell allow={['super_admin']}><Page /></AppShell>
}
