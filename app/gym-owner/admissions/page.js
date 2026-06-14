'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Check, X, Phone, Mail } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

function Page() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const refresh = async () => {
    if (!profile?.gymId) return
    setLoading(true)
    const snap = await getDocs(query(collection(db, 'admissionRequests'), where('gymId', '==', profile.gymId), where('status', '==', 'pending')))
    setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }
  useEffect(() => { refresh() }, [profile])

  const approve = async (req) => {
    setBusy(req.id)
    try {
      const memberId = req.id || uuidv4()
      await addDoc(collection(db, 'members'), {
        id: memberId, gymId: req.gymId,
        name: req.name, phone: req.phone, email: req.email || '',
        gender: req.gender, plan: req.plan,
        joinDate: req.joinDate, expiryDate: req.expiryDate,
        photoURL: req.photoURL || null,
        status: 'active',
        source: 'qr_admission',
        createdAt: serverTimestamp(), createdBy: profile.uid,
      })
      await updateDoc(doc(db, 'admissionRequests', req.id), { status: 'approved', approvedBy: profile.uid, approvedAt: serverTimestamp() })
      toast.success(`${req.name} added as a member`)
      refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }
  const reject = async (req) => {
    if (!confirm(`Reject ${req.name}'s application?`)) return
    await updateDoc(doc(db, 'admissionRequests', req.id), { status: 'rejected', rejectedBy: profile.uid, rejectedAt: serverTimestamp() })
    toast.success('Rejected'); refresh()
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-1">Admission Requests</h1>
      <p className="text-slate-500 mb-6">{requests.length} pending applications from QR.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {requests.map(r => (
          <Card key={r.id}>
            <CardHeader className="pb-2 flex-row items-center gap-3 space-y-0">
              {r.photoURL ? <img src={r.photoURL} alt={r.name} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-slate-200" />}
              <div><CardTitle className="text-base">{r.name}</CardTitle><Badge variant="outline" className="mt-1 capitalize">{r.plan}</Badge></div>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</div>
              {r.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.email}</div>}
              <div className="text-slate-500">Wants to join from {r.joinDate} → {r.expiryDate}</div>
              <div className="flex gap-2 pt-3">
                <Button size="sm" disabled={busy === r.id} className="bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={() => approve(r)}>{busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Approve</>}</Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => reject(r)}><X className="w-3 h-3 mr-1" />Reject</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!requests.length && <p className="text-slate-500 col-span-3 text-center py-12">No pending applications.</p>}
      </div>
    </div>
  )
}

export default function AdmissionRequestsPage() {
  return <AppShell allow={['gym_owner', 'receptionist']}><Page /></AppShell>
}
