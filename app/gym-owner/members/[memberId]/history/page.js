'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Loader2, ArrowLeft, UserPlus, Trash2, IndianRupee, CheckCircle2, XCircle,
  Mail, KeyRound, RefreshCcw, FileEdit, AlertTriangle, Calendar, Clock,
} from 'lucide-react'

// Map audit log actions to visual treatment
const ACTION_META = {
  'member.create':      { icon: UserPlus,     color: 'bg-emerald-500',  label: 'Member created' },
  'member.delete':      { icon: Trash2,       color: 'bg-red-500',      label: 'Member deleted' },
  'member.update':      { icon: FileEdit,     color: 'bg-blue-500',     label: 'Profile updated' },
  'admission.approve':  { icon: CheckCircle2, color: 'bg-emerald-500',  label: 'Admission approved' },
  'admission.reject':   { icon: XCircle,      color: 'bg-red-500',      label: 'Admission rejected' },
  'payment.renew':      { icon: IndianRupee,  color: 'bg-orange-500',   label: 'Payment & renewal' },
  'payment.reactivate': { icon: RefreshCcw,   color: 'bg-amber-500',    label: 'Reactivation payment' },
  'attendance.manual':  { icon: Calendar,     color: 'bg-slate-500',    label: 'Manual attendance' },
  'attendance.clear':   { icon: XCircle,      color: 'bg-slate-400',    label: 'Attendance cleared' },
  'cron.auto_expire':   { icon: AlertTriangle,color: 'bg-amber-600',    label: 'Auto-expired by system' },
  'user.create':        { icon: KeyRound,     color: 'bg-blue-500',     label: 'Login created' },
  'user.password_reset':{ icon: KeyRound,     color: 'bg-blue-400',     label: 'Password reset' },
  'email.change.approve':{ icon: Mail,        color: 'bg-emerald-500',  label: 'Email change approved' },
  'email.change.reject':{ icon: Mail,         color: 'bg-red-500',      label: 'Email change rejected' },
}

function fmtTime(ts) {
  if (!ts) return '—'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return String(ts) }
}

function Diff({ before, after }) {
  if (!before && !after) return null
  const keys = new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])])
  const rows = []
  for (const k of keys) {
    const b = before?.[k]; const a = after?.[k]
    // Skip if both are deeply equal
    if (JSON.stringify(b) === JSON.stringify(a)) continue
    rows.push({ k, b, a })
  }
  if (!rows.length) {
    // Fallback: show whichever side has data
    const src = after || before
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
        {Object.entries(src || {}).slice(0, 6).map(([k, v]) => (
          <div key={k} className="contents">
            <div className="text-slate-500 capitalize">{k}:</div>
            <div className="font-mono truncate">{formatVal(v)}</div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="mt-2 space-y-1">
      {rows.slice(0, 8).map(({ k, b, a }) => (
        <div key={k} className="text-xs flex items-baseline gap-2">
          <span className="text-slate-500 capitalize min-w-[100px]">{k}:</span>
          {b !== undefined && b !== null && (
            <span className="font-mono line-through text-red-500 truncate max-w-[180px]" title={String(b)}>{formatVal(b)}</span>
          )}
          {a !== undefined && a !== null && (
            <span className="font-mono text-emerald-700 truncate max-w-[200px]" title={String(a)}>{formatVal(a)}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function formatVal(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60)
  return String(v).slice(0, 60)
}

function Page() {
  const { memberId } = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState(null)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    if (!profile?.gymId || !memberId) return
    (async () => {
      try {
        const memSnap = await getDoc(doc(db, 'members', memberId))
        if (memSnap.exists() && memSnap.data().gymId === profile.gymId) {
          setMember({ id: memSnap.id, ...memSnap.data() })
        }
        // Pull all audit logs for THIS member
        const snap = await getDocs(query(
          collection(db, 'auditLogs'),
          where('gymId', '==', profile.gymId),
          where('targetId', '==', memberId),
        ))
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => {
          const ta = a.timestamp?.toMillis?.() || 0
          const tb = b.timestamp?.toMillis?.() || 0
          return tb - ta
        })
        setLogs(list)
      } catch (e) { toast.error(e.message) }
      setLoading(false)
    })()
  }, [profile, memberId])

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-orange-600" />
            Version History
          </h1>
          <p className="text-slate-500 text-sm">
            {member ? <>For <strong>{member.name}</strong> · {member.phone}</> : <>Member ID: <span className="font-mono">{memberId}</span> (deleted)</>}
          </p>
        </div>
      </div>

      {member && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Current State</CardTitle>
              <Badge className={member.status === 'active' && member.expiryDate >= new Date().toISOString().slice(0, 10) ? 'bg-emerald-600' : 'bg-red-600'}>
                {member.status === 'active' && member.expiryDate >= new Date().toISOString().slice(0, 10) ? 'Active' : 'Expired'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-slate-500">Plan</div><div className="font-medium">{member.plan || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Joined</div><div className="font-medium">{member.joinDate || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Expires</div><div className="font-medium">{member.expiryDate || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Email</div><div className="font-medium truncate">{member.email || '—'}</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>{logs.length} events • Latest first • Read-only audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          {!logs.length ? (
            <p className="text-slate-500 text-center py-12">No history events captured yet.</p>
          ) : (
            <ol className="relative border-l-2 border-slate-200 ml-3 space-y-5">
              {logs.map(l => {
                const meta = ACTION_META[l.action] || { icon: FileEdit, color: 'bg-slate-400', label: l.action }
                const Icon = meta.icon
                return (
                  <li key={l.id} className="ml-6 relative">
                    <span className={`absolute -left-[34px] top-0 w-7 h-7 rounded-full ${meta.color} text-white flex items-center justify-center ring-4 ring-white`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="bg-white border rounded-lg p-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="font-medium text-slate-900">{meta.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            by {l.performedByName || l.performedBy || 'system'}
                            {l.performedByRole && ` · ${l.performedByRole}`}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{fmtTime(l.timestamp)}</div>
                      </div>
                      {(l.reason) && <div className="text-xs text-slate-600 mt-2 italic">Reason: {l.reason}</div>}
                      <Diff before={l.before} after={l.after} />
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function MemberHistoryPage() {
  return <AppShell allow={['gym_owner', 'receptionist', 'super_admin']}><Page /></AppShell>
}
