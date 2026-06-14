'use client'

import AppShell from '@/components/AppShell'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dumbbell } from 'lucide-react'

function Page() {
  const { profile } = useAuth()
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Trainer Dashboard</h1>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Dumbbell className="w-5 h-5 text-orange-600" /> Welcome {profile.displayName}</CardTitle></CardHeader>
        <CardContent className="text-sm text-slate-600">Workout plans & member assignments coming soon.</CardContent>
      </Card>
    </div>
  )
}
export default function TrainerDashboard() { return <AppShell allow={['trainer']}><Page /></AppShell> }
