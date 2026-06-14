'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldAlert, Search } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const conds = []
        if (profile.role !== 'super_admin') conds.push(where('gymId', '==', profile.gymId))
        const snap = await getDocs(query(collection(db, 'auditLogs'), ...conds))
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
        setLogs(list.slice(0, 500))
      } catch (e) { /* rules */ }
      setLoading(false)
    })()
  }, [profile])

  const filtered = logs.filter(l => !search || JSON.stringify(l).toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 mb-1"><ShieldAlert className="w-7 h-7 text-orange-600" /> Audit Logs</h1>
      <p className="text-slate-500 mb-4">Recent {filtered.length} actions · immutable history</p>
      <div className="relative max-w-sm mb-4"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><Input className="pl-9" placeholder="Search action / user / target…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="space-y-2">
        {filtered.map(l => (
          <Card key={l.id}><CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">{l.action}</Badge>
                  <span className="text-xs text-slate-500">by {l.performedByName || l.performedBy?.slice(0, 8)} ({l.performedByRole})</span>
                </div>
                {l.reason && <div className="text-xs text-amber-700 mt-1">Reason: {l.reason}</div>}
                {l.before && <div className="text-xs text-slate-500 mt-1">Before: <code className="bg-red-50 px-1 rounded">{JSON.stringify(l.before)}</code></div>}
                {l.after && <div className="text-xs text-slate-500">After: <code className="bg-emerald-50 px-1 rounded">{JSON.stringify(l.after)}</code></div>}
              </div>
              <div className="text-xs text-slate-400 shrink-0">{l.timestamp?.toDate?.()?.toLocaleString() || ''}</div>
            </div>
          </CardContent></Card>
        ))}
        {!filtered.length && <p className="text-slate-500 text-center py-8">No audit logs yet.</p>}
      </div>
    </div>
  )
}

export default function AuditLogsPage() {
  return <AppShell allow={['gym_owner', 'super_admin']}><Page /></AppShell>
}
