'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Send, Megaphone, Users, Briefcase } from 'lucide-react'

const TEMPLATES = [
  { title: 'Holiday Notice', body: 'Dear members, the gym will remain closed on {{date}}. Plan your workouts accordingly.' },
  { title: 'Payment Reminder', body: 'Hi {{name}}, your membership expires on {{expiry}}. Please renew at the reception.' },
  { title: 'New Workout Session', body: 'New {{type}} class added every {{day}} at {{time}}. Register at reception.' },
  { title: 'Maintenance Alert', body: 'Equipment maintenance scheduled on {{date}}, {{time}}. Some machines may be unavailable.' },
]

function Page() {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState([])

  const refresh = async () => {
    if (!profile?.gymId) return
    try {
      const snap = await getDocs(query(collection(db, 'announcements'), where('gymId', '==', profile.gymId)))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        const at = a.createdAt?.toMillis?.() || 0
        const bt = b.createdAt?.toMillis?.() || 0
        return bt - at
      })
      setHistory(list.slice(0, 20))
    } catch (e) { /* ignore */ }
  }
  useEffect(() => { refresh() }, [profile])

  const send = async () => {
    if (!title || !body) { toast.error('Title and body required'); return }
    setBusy(true)
    try {
      const r = await api.sendAnnouncement({ gymId: profile.gymId, title, body, audience })
      toast.success(`Announcement sent · ${r.targets} users · ${r.push?.successCount ?? 0} push delivered`)
      setTitle(''); setBody(''); refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Megaphone className="w-7 h-7 text-orange-600" /> Announcements</h1>
        <p className="text-slate-500 mt-1">Send instant push notifications to your gym audience via Firebase Cloud Messaging.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Compose</CardTitle><CardDescription>Recipients must allow notifications in their browser.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Holiday Notice" /></div>
              <div><Label>Message</Label><Textarea rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Type your message..." /></div>
              <div>
                <Label>Audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><Users className="w-4 h-4 inline mr-2" />Everyone in the gym</SelectItem>
                    <SelectItem value="staff"><Briefcase className="w-4 h-4 inline mr-2" />Staff only (Owner / Receptionist / Trainer)</SelectItem>
                    <SelectItem value="members">Members only (Students)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={send} disabled={busy} className="bg-orange-600 hover:bg-orange-700">
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Send Announcement
              </Button>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader><CardTitle className="text-base">Templates</CardTitle><CardDescription>Click to use as a starting point.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => { setTitle(t.title); setBody(t.body) }} className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition">
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{t.body}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Announcements ({history.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.map(h => (
            <div key={h.id} className="p-3 border border-slate-200 rounded-lg flex items-start justify-between">
              <div>
                <div className="font-medium text-sm">{h.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">{h.body}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {h.audience} · {h.targetCount ?? 0} targets · {h.createdByRole?.replace('_', ' ')}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 capitalize">{h.audience}</Badge>
            </div>
          ))}
          {!history.length && <p className="text-slate-500 text-center py-6 text-sm">No announcements yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AnnouncementsPage() {
  return <AppShell allow={['gym_owner', 'receptionist', 'super_admin']}><Page /></AppShell>
}
