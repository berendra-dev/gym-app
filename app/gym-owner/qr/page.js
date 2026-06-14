'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, ExternalLink, Loader2 } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [gym, setGym] = useState(null)
  const [base, setBase] = useState('')

  useEffect(() => {
    setBase(typeof window !== 'undefined' ? window.location.origin : '')
    if (!profile?.gymId) return
    (async () => {
      const snap = await getDoc(doc(db, 'gyms', profile.gymId))
      if (snap.exists()) setGym(snap.data())
    })()
  }, [profile])

  const admissionUrl = `${base}/admission/${profile?.gymId}`
  const checkinUrl = `${base}/checkin/${profile?.gymId}`

  const downloadQR = (id, name) => {
    const canvas = document.getElementById(id)
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url; a.download = `${name}.png`; a.click()
  }

  if (!gym) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">QR Codes</h1>
      <p className="text-slate-500 mb-6">Print and display these at your gym entrance.</p>
      <div className="grid md:grid-cols-2 gap-6">
        {[{ id: 'qr-admission', title: 'Admission QR', desc: 'Walk-ins scan to fill admission form with photo upload.', url: admissionUrl, name: `${gym.name}-Admission` },
          { id: 'qr-checkin', title: 'Attendance QR', desc: 'Members scan to check in via mobile number.', url: checkinUrl, name: `${gym.name}-CheckIn` }].map(qr => (
          <Card key={qr.id}>
            <CardHeader><CardTitle>{qr.title}</CardTitle><CardDescription>{qr.desc}</CardDescription></CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white border-2 border-slate-200 rounded-xl">
                <QRCodeCanvas id={qr.id} value={qr.url} size={240} level="H" includeMargin />
              </div>
              <div className="text-xs text-slate-500 font-mono break-all text-center">{qr.url}</div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => downloadQR(qr.id, qr.name)}><Download className="w-4 h-4 mr-1" /> Download PNG</Button>
                <Button variant="outline" className="flex-1" onClick={() => window.open(qr.url, '_blank')}><ExternalLink className="w-4 h-4 mr-1" /> Open</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function QRPage() {
  return <AppShell allow={['gym_owner', 'receptionist']}><Page /></AppShell>
}
