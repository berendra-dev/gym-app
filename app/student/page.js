'use client'

import AppShell from '@/components/AppShell'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function Page() {
  const { profile } = useAuth()
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Profile</h1>
      <Card>
        <CardHeader><CardTitle>{profile.displayName}</CardTitle></CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <div><strong>Email:</strong> {profile.email}</div>
          <div><strong>Role:</strong> Student</div>
          <div><strong>Gym:</strong> {profile.gymId}</div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function StudentPage() {
  return <AppShell allow={['student']}><Page /></AppShell>
}
