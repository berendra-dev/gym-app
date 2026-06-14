'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Dumbbell, ShieldCheck, Users, CalendarCheck, QrCode, Building2 } from 'lucide-react'

function Landing() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [needsSetup, setNeedsSetup] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)

  useEffect(() => {
    // Check if any super_admin exists; if not, redirect to /setup.
    // This relies on Firestore being in test mode initially.
    (async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'super_admin'), limit(1))
        const snap = await getDocs(q)
        setNeedsSetup(snap.empty)
      } catch (e) {
        // Firestore not accessible — likely rules block reads; allow user to try /setup anyway.
        setNeedsSetup(false)
      } finally {
        setCheckingSetup(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (loading || checkingSetup) return
    if (user && profile?.role) router.replace('/dashboard')
  }, [user, profile, loading, checkingSetup, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50">
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Gymtain</span>
        </div>
        <div className="flex items-center gap-3">
          {needsSetup && (
            <Link href="/setup"><Button variant="outline">Initial Setup</Button></Link>
          )}
          <Link href="/login"><Button className="bg-orange-600 hover:bg-orange-700">Sign In</Button></Link>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-medium mb-6">
          <ShieldCheck className="w-4 h-4" /> Multi-tenant • Role-based • Firebase-powered
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.05]">
          The Operating System for <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Modern Gyms</span>
        </h1>
        <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
          Manage thousands of gyms from a single platform. Members, attendance, payments, QR check-ins, subscriptions — fully isolated, fully secure.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/login"><Button size="lg" className="bg-orange-600 hover:bg-orange-700 h-12 px-7">Sign In to Dashboard</Button></Link>
          {needsSetup && (
            <Link href="/setup"><Button size="lg" variant="outline" className="h-12 px-7">Create First Super Admin</Button></Link>
          )}
        </div>
      </section>

      <section className="container mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: Building2, title: 'Multi-Tenant Architecture', desc: 'Every record scoped by gymId. Zero cross-gym data leakage.' },
          { icon: Users, title: 'Role-Based Access', desc: 'Super Admin · Gym Owner · Receptionist · Trainer · Student.' },
          { icon: CalendarCheck, title: 'Calendar Attendance', desc: 'Server-timestamped, color-coded daily attendance.' },
          { icon: QrCode, title: 'QR Workflows', desc: 'Public admission QR and instant attendance check-in.' },
          { icon: ShieldCheck, title: 'Enterprise Security', desc: 'Single-device sessions, audit logs, version history.' },
          { icon: Dumbbell, title: 'Built for Scale', desc: 'Firestore, Storage, FCM — production-ready from day one.' },
        ].map((f, i) => (
          <div key={i} className="p-6 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur hover:shadow-lg transition">
            <div className="w-11 h-11 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-slate-900">{f.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        Gymtain © 2025 — Project: gymtain-84128
      </footer>
    </div>
  )
}

export default function App() { return <Landing /> }
