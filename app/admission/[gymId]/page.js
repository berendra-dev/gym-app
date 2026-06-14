'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Dumbbell, CheckCircle2, Loader2, MapPin, Phone } from 'lucide-react'

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = reject
  r.readAsDataURL(file)
})

export default function AdmissionPage() {
  const params = useParams()
  const gymId = params.gymId
  const [gym, setGym] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('male')
  const [plan, setPlan] = useState('monthly')
  const [photo, setPhoto] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/gym/${gymId}`)
        if (!res.ok) { setNotFound(true); return }
        setGym(await res.json())
      } catch (e) { setNotFound(true) }
    })()
  }, [gymId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let photoBase64 = null
      if (photo) {
        if (photo.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); setSubmitting(false); return }
        photoBase64 = await fileToBase64(photo)
      }
      const res = await fetch('/api/public/admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId, name, phone, email, gender, plan, photoBase64 }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Submission failed')
      setDone(true)
    } catch (err) { toast.error(err.message || 'Submission failed') }
    finally { setSubmitting(false) }
  }

  if (notFound) return <div className="min-h-screen flex items-center justify-center p-6"><Card className="max-w-md"><CardHeader><CardTitle>Gym Not Found</CardTitle><CardDescription>This gym is inactive or doesn’t exist.</CardDescription></CardHeader></Card></div>
  if (!gym) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>

  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-emerald-50 to-white">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
          <CardTitle>Application Received!</CardTitle>
          <CardDescription>{gym.name} will review your application and contact you on {phone}.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50">
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-6 pt-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4"><Dumbbell className="w-7 h-7 text-white" /></div>
          <h1 className="text-3xl font-bold">{gym.name}</h1>
          {gym.address && <p className="text-slate-600 mt-1 flex items-center justify-center gap-1"><MapPin className="w-4 h-4" /> {gym.address}</p>}
          {gym.phone && <p className="text-slate-600 flex items-center justify-center gap-1"><Phone className="w-4 h-4" /> {gym.phone}</p>}
        </div>
        <Card>
          <CardHeader><CardTitle>Join {gym.name}</CardTitle><CardDescription>Fill in your details to apply for membership.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Full Name</Label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
                <div><Label>Phone</Label><Input required value={phone} onChange={e => setPhone(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Gender</Label><Select value={gender} onValueChange={setGender}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              </div>
              <div><Label>Plan</Label><Select value={plan} onValueChange={setPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="halfyearly">Half-Yearly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent></Select></div>
              <div><Label>Profile Photo (optional, max 2MB)</Label><Input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} /></div>
              <Button type="submit" disabled={submitting} className="w-full bg-orange-600 hover:bg-orange-700">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Application'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
