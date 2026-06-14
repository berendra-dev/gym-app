'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Dumbbell, CheckCircle2, XCircle, Loader2, ScanLine } from 'lucide-react'

export default function CheckinPage() {
  const params = useParams()
  const gymId = params.gymId
  const [gym, setGym] = useState(null)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, 'gyms', gymId))
      if (snap.exists()) setGym(snap.data())
    })()
  }, [gymId])

  const handleCheckIn = async (e) => {
    e.preventDefault()
    setBusy(true); setResult(null)
    try {
      // Find member by phone within this gym
      const snap = await getDocs(query(collection(db, 'members'), where('gymId', '==', gymId), where('phone', '==', phone)))
      if (snap.empty) { setResult({ ok: false, message: 'No member found with this phone number.' }); setBusy(false); return }
      const member = snap.docs[0].data()
      // Membership validation
      const today = new Date().toISOString().slice(0, 10)
      if (member.expiryDate && member.expiryDate < today) {
        setResult({ ok: false, message: `Membership expired on ${member.expiryDate}. Please renew at reception.`, name: member.name })
        setBusy(false); return
      }
      // Duplicate prevention via deterministic doc id
      const docId = `${gymId}_${member.id}_${today}`
      const existing = await getDoc(doc(db, 'attendance', docId))
      if (existing.exists() && existing.data().status === 'present') {
        setResult({ ok: true, message: `Already checked in today, ${member.name}!`, name: member.name, dupe: true })
        setBusy(false); return
      }
      await setDoc(doc(db, 'attendance', docId), {
        gymId, memberId: member.id, memberName: member.name,
        date: today, status: 'present',
        markedBy: 'qr_self_checkin', markedByRole: 'student',
        markedAt: serverTimestamp(), manual: false,
      })
      setResult({ ok: true, message: `Welcome ${member.name}! Check-in successful.`, name: member.name })
      setPhone('')
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Check-in failed' })
    } finally { setBusy(false) }
  }

  if (!gym) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-3"><ScanLine className="w-6 h-6 text-white" /></div>
          <CardTitle>{gym.name} — Quick Check-in</CardTitle>
          <CardDescription>Enter your registered mobile number to mark attendance.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheckIn} className="space-y-3">
            <Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile number" type="tel" autoFocus className="text-lg h-12" />
            <Button type="submit" disabled={busy} className="w-full h-12 text-base bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check In'}</Button>
          </form>
          {result && (
            <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${result.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
              {result.ok ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" /> : <XCircle className="w-5 h-5 mt-0.5 text-red-600" />}
              <div className="text-sm font-medium">{result.message}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
