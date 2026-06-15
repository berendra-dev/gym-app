'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, Check, X, Minus, AlertTriangle } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [members, setMembers] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [attendance, setAttendance] = useState({})  // { 'YYYY-MM-DD': {...} }
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [manualDialog, setManualDialog] = useState(null)
  const [manualStatus, setManualStatus] = useState('present')
  const [manualReason, setManualReason] = useState('')

  // Load members
  useEffect(() => {
    if (!profile?.gymId) return
    (async () => {
      const snap = await getDocs(query(collection(db, 'members'), where('gymId', '==', profile.gymId)))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setMembers(list)
      if (list.length && !selectedMemberId) setSelectedMemberId(list[0].id)
      setLoading(false)
    })()
  }, [profile])

  // Load attendance for selected member via the UNIFIED API
  const loadAttendance = async () => {
    if (!profile?.gymId || !selectedMemberId) return
    try {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString().slice(0, 10)
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10)
      const r = await api.listAttendance({ gymId: profile.gymId, memberId: selectedMemberId, from: start, to: end })
      const map = {}
      ;(r.records || []).forEach(d => { map[d.date] = d })
      setAttendance(map)
    } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { loadAttendance() }, [profile, selectedMemberId, cursor]) // eslint-disable-line

  const days = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth()
    const firstDow = new Date(year, month, 1).getDay()
    const numDays = new Date(year, month + 1, 0).getDate()
    const arr = []
    for (let i = 0; i < firstDow; i++) arr.push(null)
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      arr.push(dateStr)
    }
    return arr
  }, [cursor])

  const todayStr = new Date().toISOString().slice(0, 10)
  const selectedMember = members.find(m => m.id === selectedMemberId)

  const openManual = (dateStr) => {
    if (dateStr > todayStr) { toast.error('Cannot mark future dates'); return }
    const current = attendance[dateStr]
    setManualStatus(current?.status || 'present')
    setManualReason('')
    setManualDialog({ date: dateStr, currentStatus: current?.status })
  }

  const submitManual = async () => {
    if (!manualDialog || !selectedMember) return
    setBusy(true)
    try {
      console.log('[attendance.manual] dispatch →', {
        gymId: profile.gymId, memberId: selectedMember.id, memberName: selectedMember.name,
        date: manualDialog.date, status: manualStatus, via: 'manual',
      })
      const result = await api.markAttendance({
        gymId: profile.gymId,
        memberId: selectedMember.id,
        date: manualDialog.date,
        via: 'manual',
        status: manualStatus,
        reason: manualReason || undefined,
      })
      setAttendance(prev => ({
        ...prev,
        [manualDialog.date]: {
          ...(prev[manualDialog.date] || {}),
          status: manualStatus, date: manualDialog.date, via: 'manual',
          memberId: selectedMember.id, memberName: selectedMember.name,
        },
      }))
      toast.success(`${result.duplicate ? 'Updated' : 'Marked'} ${manualStatus}`)
      setManualDialog(null)
    } catch (e) {
      // Surface MEMBERSHIP EXPIRED specifically
      const msg = e.message || 'Failed to mark attendance'
      toast.error(msg.includes('EXPIRED') ? '❌ MEMBERSHIP EXPIRED — renew before marking attendance.' : msg)
    } finally { setBusy(false) }
  }

  const clearMark = async (dateStr) => {
    if (!confirm('Clear this attendance mark?')) return
    try {
      console.log('[attendance.clear] dispatch →', { gymId: profile.gymId, memberId: selectedMember.id, date: dateStr })
      await api.clearAttendance({ gymId: profile.gymId, memberId: selectedMember.id, date: dateStr })
      setAttendance(prev => { const c = { ...prev }; delete c[dateStr]; return c })
      toast.success('Cleared')
    } catch (e) { toast.error(e.message) }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const memberExpired = selectedMember?.expiryDate && selectedMember.expiryDate < todayStr

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Calendar</h1>
        <p className="text-slate-500 mt-1">Unified API · path: <span className="font-mono text-xs">attendance/{'{gymId}'}/{'{memberId}'}/{'{date}'}</span></p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} · {m.phone}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <div className="font-semibold w-44 text-center">{monthLabel}</div>
              <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Present</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Absent</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 inline-block" /> Not marked</span>
          </div>
        </CardHeader>
        <CardContent>
          {memberExpired && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 flex items-center gap-2 text-red-800 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <strong>Membership expired on {selectedMember.expiryDate}.</strong>
              <span>Attendance is blocked by the API until renewal.</span>
            </div>
          )}
          {!selectedMember ? <p className="text-slate-500 text-center py-12">Add members first to mark attendance.</p> : (
            <div className="grid grid-cols-7 gap-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>)}
              {days.map((dateStr, i) => {
                if (!dateStr) return <div key={i} />
                const data = attendance[dateStr]
                const status = data?.status
                const isFuture = dateStr > todayStr
                const isToday = dateStr === todayStr
                const bg = status === 'present' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' :
                           status === 'absent' ? 'bg-red-500 hover:bg-red-600 text-white' :
                           isFuture ? 'bg-slate-100 text-slate-300 cursor-not-allowed' :
                           'bg-slate-100 hover:bg-slate-200 text-slate-700'
                const dayNum = parseInt(dateStr.slice(-2), 10)
                return (
                  <button key={i} disabled={isFuture}
                    onClick={() => openManual(dateStr)}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium transition ${bg} ${isToday ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}>
                    <span>{dayNum}</span>
                    {status === 'present' && <Check className="w-3 h-3 mt-0.5" />}
                    {status === 'absent' && <X className="w-3 h-3 mt-0.5" />}
                    {!status && !isFuture && <Minus className="w-3 h-3 mt-0.5 text-slate-400" />}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!manualDialog} onOpenChange={(o) => !o && setManualDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
            <DialogDescription>{selectedMember?.name} • {manualDialog?.date}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={manualStatus} onValueChange={setManualStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reason (optional, for audit log)</Label><Textarea value={manualReason} onChange={e => setManualReason(e.target.value)} placeholder="e.g. Forgot phone, QR failed…" /></div>
          </div>
          <DialogFooter className="gap-2">
            {manualDialog?.currentStatus && <Button variant="outline" onClick={() => { clearMark(manualDialog.date); setManualDialog(null) }}>Clear</Button>}
            <Button onClick={submitManual} disabled={busy} className="bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AttendancePage() {
  return <AppShell allow={['gym_owner', 'receptionist']}><Page /></AppShell>
}
