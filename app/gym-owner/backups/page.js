'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Database, Download, Plus } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    if (!profile?.gymId) return
    setLoading(true)
    try {
      const r = await api.listBackups(profile.gymId)
      setBackups(r.backups || [])
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [profile])

  const create = async () => {
    setBusy(true)
    try {
      const r = await api.createBackup({ gymId: profile.gymId })
      toast.success(`Backup created · ${Object.entries(r.stats).map(([k, v]) => `${k}:${v}`).join(' ')}`)
      refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Database className="w-7 h-7 text-orange-600" />Backups & Restore</h1><p className="text-slate-500 mt-1">Create on-demand snapshots of all gym data. Download as JSON to keep offline copies.</p></div>
        <Button onClick={create} disabled={busy} className="bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Create Backup Now</Button>
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin text-orange-600" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {backups.map(b => (
            <Card key={b.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{b.createdAt?.toDate?.()?.toLocaleString() || b.createdAt}</CardTitle><CardDescription className="text-xs">by {b.createdByRole}</CardDescription></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(b.stats || {}).map(([k, v]) => <Badge key={k} variant="outline" className="text-xs">{k}: {v}</Badge>)}
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => api.downloadBackup(b.id)}><Download className="w-3 h-3 mr-1" />Download JSON</Button>
              </CardContent>
            </Card>
          ))}
          {!backups.length && <p className="text-slate-500 col-span-3 text-center py-12">No backups yet. Click “Create Backup Now”.</p>}
        </div>
      )}
    </div>
  )
}

export default function BackupsPage() {
  return <AppShell allow={['gym_owner', 'super_admin']}><Page /></AppShell>
}
