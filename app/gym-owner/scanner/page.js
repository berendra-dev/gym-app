'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, ScanLine, CheckCircle2, XCircle, Camera, CameraOff } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const scannerRef = useRef(null)
  const containerRef = useRef(null)
  const [active, setActive] = useState(false)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear() } catch (e) {}
      scannerRef.current = null
    }
    setActive(false)
  }

  const handleScan = async (decoded) => {
    if (busy) return
    setBusy(true)
    await stopScanner()
    try {
      // Decoded should be a URL like https://.../checkin/<gymId>?member=<memberId>
      let gymId = null, memberId = null
      try {
        const url = new URL(decoded)
        const match = url.pathname.match(/\/checkin\/([^\/]+)/)
        if (match) gymId = match[1]
        memberId = url.searchParams.get('member')
      } catch (e) {
        // Maybe raw value like gymId:memberId
        const parts = decoded.split(/[:|]/)
        if (parts.length === 2) { gymId = parts[0]; memberId = parts[1] }
      }
      if (!gymId || !memberId) {
        setResult({ ok: false, message: `Unrecognized QR code: ${decoded.slice(0, 60)}...` })
        setBusy(false); return
      }
      if (gymId !== profile.gymId) {
        setResult({ ok: false, message: 'This QR belongs to a different gym.' })
        setBusy(false); return
      }
      const res = await fetch('/api/public/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId, memberId }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setResult({ ok: false, message: e.message || 'Scan failed' })
    } finally { setBusy(false) }
  }

  const startScanner = async () => {
    setResult(null)
    setActive(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader-region')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decoded) => handleScan(decoded),
        () => {}
      )
    } catch (e) {
      toast.error('Camera access denied or not supported: ' + e.message)
      setActive(false)
    }
  }

  useEffect(() => { return () => { stopScanner() } }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ScanLine className="w-7 h-7 text-orange-600" />Member QR Scanner</h1>
        <p className="text-slate-500 mt-1">Scan a member's personal QR code to instantly mark today's attendance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Camera</CardTitle>
          <CardDescription>Point your device camera at a member's QR code printed from their member card.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div id="qr-reader-region" ref={containerRef} className="rounded-xl overflow-hidden bg-slate-900 aspect-square max-w-md mx-auto" style={{ minHeight: active ? 320 : 0 }}>
            {!active && <div className="h-80 flex flex-col items-center justify-center text-slate-400"><Camera className="w-16 h-16 mb-3" /><p className="text-sm">Camera off</p></div>}
          </div>
          <div className="flex justify-center gap-2">
            {!active ? (
              <Button onClick={startScanner} className="bg-orange-600 hover:bg-orange-700"><Camera className="w-4 h-4 mr-1" />Start Scanning</Button>
            ) : (
              <Button onClick={stopScanner} variant="outline"><CameraOff className="w-4 h-4 mr-1" />Stop</Button>
            )}
            {busy && <Loader2 className="w-5 h-5 animate-spin self-center text-orange-600" />}
          </div>

          {result && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${result.ok ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'}`}>
              {result.ok ? <CheckCircle2 className="w-6 h-6 mt-0.5 text-emerald-600" /> : <XCircle className="w-6 h-6 mt-0.5 text-red-600" />}
              <div>
                {result.name && <div className="font-bold text-base">{result.name}</div>}
                <div className="text-sm">{result.message}</div>
                {result.ok && <Button size="sm" variant="outline" className="mt-2" onClick={() => { setResult(null); startScanner() }}>Scan another</Button>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ScannerPage() {
  return <AppShell allow={['gym_owner', 'receptionist']}><Page /></AppShell>
}
