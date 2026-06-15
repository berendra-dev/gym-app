'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Search, KeyRound, Trash2, Copy, Shield, Users } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)
  const [resetDialog, setResetDialog] = useState(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const r = await api.listUsers()
      setUsers(r.users || [])
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const reset = async (u) => {
    if (!confirm(`Reset password for ${u.email}? They will be forced to change it on next login.`)) return
    setBusy(u.uid)
    try {
      const r = await api.resetPassword(u.uid)
      setResetDialog({ email: u.email, password: r.password })
      toast.success('Password reset')
    } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }

  const remove = async (u) => {
    if (u.uid === profile.uid) { toast.error('Cannot delete yourself'); return }
    if (!confirm(`Delete user ${u.email}? This is permanent and removes Auth + Firestore data.`)) return
    setBusy(u.uid)
    try { await api.deleteUser(u.uid); toast.success('User deleted'); refresh() }
    catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }

  const filtered = users.filter(u => !search || (u.email?.toLowerCase().includes(search.toLowerCase()) || u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.role?.includes(search)))
  const roleColor = { super_admin: 'bg-purple-600', gym_owner: 'bg-orange-600', receptionist: 'bg-blue-600', trainer: 'bg-cyan-600', student: 'bg-emerald-600' }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Users className="w-7 h-7 text-orange-600" />User Management</h1>
        <p className="text-slate-500 mt-1">Reset passwords and manage all users across all gyms. Self-service password reset is intentionally disabled — only Super Admin can reset.</p>
      </div>

      <div className="relative max-w-sm mb-4"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><Input className="pl-9" placeholder="Search email, name, role…" value={search} onChange={e => setSearch(e.target.value)} /></div>

      {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div> : (
        <div className="space-y-2">
          {filtered.map(u => (
            <Card key={u.uid}>
              <CardContent className="pt-4 flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-600">{u.displayName?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{u.displayName || '—'}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
                <Badge className={roleColor[u.role] || 'bg-slate-600'}>{u.role || 'no-role'}</Badge>
                {u.gymId && <Badge variant="outline" className="text-xs font-mono">gym:{u.gymId.slice(0, 6)}…</Badge>}
                {u.mustChangePassword && <Badge variant="outline" className="text-amber-600 border-amber-300">Pending 1st login</Badge>}
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={busy === u.uid} onClick={() => reset(u)}><KeyRound className="w-3 h-3 mr-1" />Reset PW</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" disabled={busy === u.uid || u.uid === profile.uid} onClick={() => remove(u)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!filtered.length && <p className="text-slate-500 text-center py-12">No users found.</p>}
        </div>
      )}

      <Dialog open={!!resetDialog} onOpenChange={(o) => !o && setResetDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-600" />Password Reset Successfully</DialogTitle>
            <DialogDescription>Share the temporary password securely. User will be forced to change it on first login.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <div className="font-mono bg-slate-50 p-3 rounded border text-sm break-all">{resetDialog?.email}</div>
            <div className="font-mono bg-orange-50 p-3 rounded border text-sm break-all border-orange-300">{resetDialog?.password}</div>
            <Button className="w-full" variant="outline" onClick={() => { navigator.clipboard.writeText(`Email: ${resetDialog?.email}\nPassword: ${resetDialog?.password}`); toast.success('Copied') }}><Copy className="w-4 h-4 mr-1" />Copy Both</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function UsersPage() {
  return <AppShell allow={['super_admin']}><Page /></AppShell>
}
