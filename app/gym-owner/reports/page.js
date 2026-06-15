'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx-js-style'

function Page() {
  const { profile } = useAuth()
  const [start, setStart] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)

  const fetch = async (col, dateField, dateRange) => {
    const conds = [where('gymId', '==', profile.gymId)]
    if (dateRange) { conds.push(where(dateField, '>=', start), where(dateField, '<=', end)) }
    const snap = await getDocs(query(collection(db, col), ...conds))
    return snap.docs.map(d => d.data())
  }

  const exportPDF = (title, columns, rows, filename) => {
    const docPdf = new jsPDF()
    docPdf.setFontSize(16); docPdf.text(title, 14, 18)
    docPdf.setFontSize(10); docPdf.setTextColor(120); docPdf.text(`Period: ${start} to ${end} • Generated: ${new Date().toLocaleString()}`, 14, 25)
    autoTable(docPdf, { startY: 30, head: [columns], body: rows, styles: { fontSize: 9 }, headStyles: { fillColor: [234, 88, 12] } })
    docPdf.save(filename)
  }

  const exportXLSX = (sheetName, columns, rows, filename) => {
    const ws = XLSX.utils.aoa_to_sheet([columns, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
  }

  const runAttendance = async (format) => {
    setBusy(true)
    try {
      // Unified API — server aggregates over nested attendance/{gymId}/{memberId}/{date}
      const r = await api.listAttendance({ gymId: profile.gymId, from: start, to: end })
      const data = (r.records || []).filter(d => d.status === 'present' || d.status === 'absent')
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const cols = ['Date', 'Member', 'Status', 'Via', 'Marked By Role']
      const rows = data.map(d => [d.date, d.memberName, d.status, d.via || (d.manual ? 'manual' : 'qr'), d.markedByRole || ''])
      if (format === 'pdf') exportPDF('Attendance Report', cols, rows, `attendance-${start}-to-${end}.pdf`)
      else exportXLSX('Attendance', cols, rows, `attendance-${start}-to-${end}.xlsx`)
      toast.success(`Exported ${data.length} records`)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const runPayments = async (format) => {
    setBusy(true)
    try {
      const data = await fetch('payments', 'paymentDate', true)
      data.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))
      const cols = ['Date', 'Member', 'Amount', 'Plan', 'Mode', 'New Expiry']
      const rows = data.map(d => [d.paymentDate, d.memberName, d.amount, d.plan, d.mode, d.newExpiry])
      const total = data.reduce((s, p) => s + Number(p.amount || 0), 0)
      rows.push(['', 'TOTAL', total, '', '', ''])
      if (format === 'pdf') exportPDF('Payments Report', cols, rows, `payments-${start}-to-${end}.pdf`)
      else exportXLSX('Payments', cols, rows, `payments-${start}-to-${end}.xlsx`)
      toast.success(`Exported ${data.length} payments • Total: ₹${total.toLocaleString()}`)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const runMembers = async (format) => {
    setBusy(true)
    try {
      const data = await fetch('members', null, false)
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      const cols = ['Name', 'Phone', 'Email', 'Plan', 'Join Date', 'Expiry', 'Status']
      const rows = data.map(d => [d.name, d.phone, d.email || '', d.plan, d.joinDate, d.expiryDate, d.status])
      if (format === 'pdf') exportPDF('Members Report', cols, rows, `members.pdf`)
      else exportXLSX('Members', cols, rows, `members.xlsx`)
      toast.success(`Exported ${data.length} members`)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const runDues = async (format) => {
    setBusy(true)
    try {
      const data = await fetch('members', null, false)
      const today = new Date().toISOString().slice(0, 10)
      const dues = data.filter(d => d.expiryDate && d.expiryDate < today)
      const cols = ['Name', 'Phone', 'Plan', 'Expired On', 'Days Overdue']
      const rows = dues.map(d => {
        const days = Math.floor((new Date(today) - new Date(d.expiryDate)) / 86400000)
        return [d.name, d.phone, d.plan, d.expiryDate, days]
      })
      if (format === 'pdf') exportPDF('Dues Report (Expired)', cols, rows, `dues.pdf`)
      else exportXLSX('Dues', cols, rows, `dues.xlsx`)
      toast.success(`Exported ${dues.length} due members`)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const reports = [
    { title: 'Attendance', desc: 'All attendance entries in date range.', run: runAttendance, dateRange: true },
    { title: 'Payments', desc: 'All payments + revenue summary.', run: runPayments, dateRange: true },
    { title: 'Members', desc: 'Full member roster snapshot.', run: runMembers, dateRange: false },
    { title: 'Dues / Expired', desc: 'All members with expired memberships.', run: runDues, dateRange: false },
  ]

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Reports</h1><p className="text-slate-500 mt-1">Export PDF or Excel of operational data.</p></div>
      <Card>
        <CardHeader><CardTitle>Date Range</CardTitle><CardDescription>Used for date-bound reports (Attendance, Payments).</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 max-w-md">
          <div><Label>Start</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><Label>End</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {reports.map(r => (
          <Card key={r.title}>
            <CardHeader><CardTitle>{r.title}</CardTitle><CardDescription>{r.desc}</CardDescription></CardHeader>
            <CardContent className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => r.run('pdf')}><FileText className="w-4 h-4 mr-1" /> PDF</Button>
              <Button variant="outline" disabled={busy} onClick={() => r.run('xlsx')}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
              {busy && <Loader2 className="w-4 h-4 animate-spin self-center" />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return <AppShell allow={['gym_owner', 'receptionist']}><Page /></AppShell>
}
