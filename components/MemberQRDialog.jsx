'use client'

import { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

export default function MemberQRDialog({ open, onOpenChange, member, gymId }) {
  const [base, setBase] = useState('')
  useEffect(() => { setBase(typeof window !== 'undefined' ? window.location.origin : '') }, [])
  if (!member) return null
  const url = `${base}/checkin/${gymId}?member=${member.id}`
  const canvasId = `qr-member-${member.id}`

  const download = () => {
    const canvas = document.getElementById(canvasId)
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${member.name.replace(/\s+/g, '-')}-QR.png`
    a.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{member.name}’s Attendance QR</DialogTitle>
          <DialogDescription>Scan to instantly mark attendance — no phone number entry needed.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="p-4 bg-white border-2 border-slate-200 rounded-xl">
            <QRCodeCanvas id={canvasId} value={url} size={240} level="H" includeMargin />
          </div>
          <div className="text-xs text-slate-500 font-mono break-all text-center">{url}</div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={download}><Download className="w-4 h-4 mr-1" /> Download PNG</Button>
            <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copied') }}>Copy Link</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
