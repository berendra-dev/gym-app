'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dumbbell, CheckCircle2, XCircle, Loader2, ScanLine } from 'lucide-react'

export default function CheckinPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const gymId = params.gymId
  const memberIdFromQR = searchParams.get('member')

  const [gym, setGym] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [autoTried, setAutoTried] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/gym/${gymId}`)
        if (!res.ok) { setNotFound(true); return }
        setGym(await res.json())
      } catch (e) { setNotFound(true) }
    })()
  }, [gymId])

  // Auto check-in when QR contains memberId
  useEffect(() => {
    if (!gym || !memberIdFromQR || autoTried) return
    setAutoTried(true)
    ;(async () => {
      setBusy(true)
      try {
        const res = await fetch('/api/public/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gymId, memberId: memberIdFromQR }),
        })
        setResult(await res.json())
      } catch (err) {
        setResult({ ok: false, message: err.message || 'Check-in failed' })
      } finally { setBusy(false) }
    })()
  }, [gym, memberIdFromQR, gymId, autoTried])

  const handlePhoneCheckIn = async (e) => {
    e.preventDefault()
    setBusy(true); setResult(null)
    try {
      const res = await fetch('/api/public/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId, phone: phone.trim() }),
      })
      const data = await res.json()
      setResult(data)
      if (data.ok && !data.dupe) setPhone('')
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Check-in failed' })
    } finally { setBusy(false) }
  }

  if (notFound) return <div className="min-h-screen flex items-center justify-center p-6"><Card className="max-w-md"><CardHeader><CardTitle>Gym Not Found</CardTitle><CardDescription>This gym is inactive or doesn’t exist.</CardDescription></CardHeader></Card></div>
  if (!gym) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-3"><ScanLine className="w-6 h-6 text-white" /></div>
          <CardTitle>{gym.name} {memberIdFromQR ? '— Auto Check-in' : '— Quick Check-in'}</CardTitle>
          <CardDescription>{memberIdFromQR ? 'Personal QR detected, marking attendance…' : 'Enter your registered mobile number to mark attendance.'}</CardDescription>
        </CardHeader>
        <CardContent>
          {!memberIdFromQR && (
            <form onSubmit={handlePhoneCheckIn} className="space-y-3">
              <Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile number" type="tel" autoFocus className="text-lg h-12" />
              <Button type="submit" disabled={busy} className="w-full h-12 text-base bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check In'}</Button>
            </form>
          )}
          {memberIdFromQR && busy && <div className="flex justify-center py-6"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>}
          {result && (
            <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${result.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
              {result.ok ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" /> : <XCircle className="w-5 h-5 mt-0.5 text-red-600" />}
              <div className="text-sm font-medium">{result.message}</div>
            </div>
          )}
          {result && memberIdFromQR && (
            <Button variant="outline" className="w-full mt-3" onClick={() => { setAutoTried(false); setResult(null); }}>Check in again</Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
