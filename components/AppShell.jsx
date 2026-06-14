'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Dumbbell, LogOut, Loader2 } from 'lucide-react'

const NAV = {
  super_admin: [{ href: '/super-admin', label: 'Gyms' }],
  gym_owner: [
    { href: '/gym-owner', label: 'Dashboard' },
    { href: '/gym-owner/members', label: 'Members' },
    { href: '/gym-owner/attendance', label: 'Attendance' },
    { href: '/gym-owner/payments', label: 'Payments' },
    { href: '/gym-owner/admissions', label: 'Admissions' },
    { href: '/gym-owner/announcements', label: 'Announcements' },
    { href: '/gym-owner/trainers', label: 'Trainers' },
    { href: '/gym-owner/qr', label: 'QR' },
    { href: '/gym-owner/reports', label: 'Reports' },
  ],
  receptionist: [
    { href: '/receptionist', label: 'Dashboard' },
    { href: '/gym-owner/members', label: 'Members' },
    { href: '/gym-owner/attendance', label: 'Attendance' },
    { href: '/gym-owner/payments', label: 'Payments' },
    { href: '/gym-owner/admissions', label: 'Admissions' },
    { href: '/gym-owner/announcements', label: 'Announcements' },
    { href: '/gym-owner/qr', label: 'QR' },
    { href: '/gym-owner/reports', label: 'Reports' },
  ],
  trainer: [{ href: '/trainer', label: 'Dashboard' }],
  student: [{ href: '/student', label: 'My Profile' }],
}

export default function AppShell({ children, allow }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, loading, logout } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (profile && profile.mustChangePassword && pathname !== '/change-password') { router.replace('/change-password'); return }
    if (profile && allow && !allow.includes(profile.role)) { router.replace('/dashboard') }
  }, [user, profile, loading, allow, router, pathname])

  if (loading || !user || !profile?.role) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>
  }
  const links = NAV[profile.role] || []
  const roleLabel = profile.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center"><Dumbbell className="w-4 h-4 text-white" /></div>
              <span className="font-bold text-lg">Gymtain</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
              {links.map(l => (
                <Link key={l.href} href={l.href} className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition ${pathname === l.href ? 'bg-orange-100 text-orange-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>{l.label}</Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block"><div className="text-sm font-medium text-slate-900">{profile.displayName || profile.email}</div><div className="text-xs text-slate-500">{roleLabel}</div></div>
            <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
