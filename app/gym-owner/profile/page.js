'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Loader2, Building2, Upload, Mail, Info } from 'lucide-react'

function Page() {
  const { profile, user } = useAuth()
  const [gym, setGym] = useState(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [emailRequest, setEmailRequest] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.gymId) return
    (async () => {
      const snap = await getDoc(doc(db, 'gyms', profile.gymId))
      if (snap.exists()) {
        const g = snap.data()
        setGym(g); setName(g.name || ''); setAddress(g.address || ''); setPhone(g.phone || '')
      }
      setLoading(false)
    })()
  }, [profile])

  // Real-time listener for own email change requests
  useEffect(() => {
    if (!user?.uid) return
    const unsub = onSnapshot(query(collection(db, 'emailChangeRequests'), where('uid', '==', user.uid)), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }))
      const pending = list.find(r => r.status === 'pending')
      setEmailRequest(pending || null)
    })
    return () => unsub()
  }, [user])

  const saveProfile = async () => {
    setSaving(true)
    try {
      let logoURL = gym.logoURL
      if (logoFile) {
        if (logoFile.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); setSaving(false); return }
        const r = storageRef(storage, `${profile.gymId}/gym/logo.${logoFile.name.split('.').pop()}`)
        await uploadBytes(r, logoFile)
        logoURL = await getDownloadURL(r)
      }
      await updateDoc(doc(db, 'gyms', profile.gymId), { name, address, phone, logoURL: logoURL || null })
      toast.success('Profile updated')
      setGym({ ...gym, name, address, phone, logoURL })
      setLogoFile(null)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const requestEmail = async () => {
    if (!newEmail || !/.+@.+\..+/.test(newEmail)) { toast.error('Enter a valid email'); return }
    setEmailBusy(true)
    try {
      await api.requestEmailChange(newEmail)
      toast.success('Request submitted. Super Admin will review.')
      setNewEmail('')
    } catch (e) { toast.error(e.message) } finally { setEmailBusy(false) }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Gym Profile</h1>
        <p className="text-slate-500 mt-1">Edit your gym information. Subscription tier is managed by Super Admin.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-orange-600" />Gym Information</CardTitle><CardDescription>Customers see this on QR landing pages.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {gym?.logoURL && <img src={gym.logoURL} alt="logo" className="w-24 h-24 rounded-xl object-cover" />}
          <div><Label>Gym Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><Label>Upload Logo (optional, max 2MB)</Label><Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} /></div>
          <div className="flex items-center gap-4 pt-2">
            <Button onClick={saveProfile} disabled={saving} className="bg-orange-600 hover:bg-orange-700"><Upload className="w-4 h-4 mr-1" />{saving ? 'Saving...' : 'Save Profile'}</Button>
            <Badge variant="outline" className="capitalize">Plan: {gym?.plan || 'silver'}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-orange-600" />Login Email</CardTitle><CardDescription>Changing your login email requires Super Admin approval.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1"><Label>Current Email</Label><Input value={user?.email || ''} disabled /></div>
          </div>
          {emailRequest ? (
            <Alert className="border-amber-300 bg-amber-50"><Info className="h-4 w-4" /><AlertTitle>Pending approval</AlertTitle><AlertDescription>You have requested to change to <strong className="font-mono">{emailRequest.newEmail}</strong>. Once approved by Super Admin, your old email will be deactivated automatically.</AlertDescription></Alert>
          ) : (
            <>
              <div><Label>Request New Email</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@yourgym.com" /></div>
              <Button variant="outline" onClick={requestEmail} disabled={emailBusy || !newEmail}><Mail className="w-4 h-4 mr-1" />{emailBusy ? 'Submitting...' : 'Request Email Change'}</Button>
              <p className="text-xs text-slate-500">Submitting creates a request — the Super Admin reviews and approves. You’ll need to log in with the new email after approval (password remains the same).</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ProfilePage() {
  return <AppShell allow={['gym_owner']}><Page /></AppShell>
}
