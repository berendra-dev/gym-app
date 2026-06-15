'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Loader2, Pencil, Trash2, Megaphone, ExternalLink } from 'lucide-react'

const empty = { id: null, title: '', body: '', ctaLabel: '', ctaUrl: '', active: true }

function Page() {
  const [offers, setOffers] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'platformOffers'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      setOffers(list)
    })
    return () => unsub()
  }, [])

  const save = async () => {
    if (!form.title || !form.body) { toast.error('Title and body required'); return }
    setBusy(true)
    try { await api.saveOffer(form); toast.success(form.id ? 'Updated' : 'Published to all gyms'); setOpen(false) }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const remove = async (o) => {
    if (!confirm(`Delete "${o.title}"?`)) return
    try { await api.deleteOffer(o.id); toast.success('Deleted') } catch (e) { toast.error(e.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Megaphone className="w-7 h-7 text-orange-600" />Platform Offers & Announcements</h1>
          <p className="text-slate-500 mt-1">Published instantly to all gym owner dashboards. Read-only for gym owners.</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true) }} className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" />New Offer</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {offers.map(o => (
          <Card key={o.id} className={!o.active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{o.title}</CardTitle>
                <Badge className={o.active ? 'bg-emerald-600' : 'bg-slate-500'}>{o.active ? 'Live' : 'Hidden'}</Badge>
              </div>
              <CardDescription className="text-sm whitespace-pre-wrap">{o.body}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              {o.ctaUrl && <a href={o.ctaUrl} target="_blank" rel="noopener" className="text-sm text-orange-600 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />{o.ctaLabel || 'Link'}</a>}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setForm({ ...empty, ...o }); setOpen(true) }}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(o)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!offers.length && <p className="text-slate-500 col-span-2 text-center py-12">No offers yet. Click “New Offer”.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'New'} Offer</DialogTitle><DialogDescription>Visible to all gym owners in real-time.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. New Year Special!" /></div>
            <div><Label>Body</Label><Textarea rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Detailed announcement..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CTA Label (optional)</Label><Input value={form.ctaLabel} onChange={e => setForm({ ...form, ctaLabel: e.target.value })} placeholder="Learn more" /></div>
              <div><Label>CTA URL (optional)</Label><Input value={form.ctaUrl} onChange={e => setForm({ ...form, ctaUrl: e.target.value })} placeholder="https://..." /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Active</Label></div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function OffersPage() {
  return <AppShell allow={['super_admin']}><Page /></AppShell>
}
