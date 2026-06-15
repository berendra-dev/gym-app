'use client'

import { auth } from '@/lib/firebase/client'

// Frontend helper: get current user's Firebase ID token, then call a backend API route.
async function apiFetch(path, options = {}) {
  if (!auth.currentUser) throw new Error('Not signed in')
  const idToken = await auth.currentUser.getIdToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
    ...(options.headers || {}),
  }
  const res = await fetch(path, { ...options, headers })
  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export const api = {
  // Super Admin: create gym + owner (returns temp credentials)
  createGym: (payload) => apiFetch('/api/admin/gyms/create', { method: 'POST', body: JSON.stringify(payload) }),
  // Create user (gym owner can create trainer/receptionist in own gym)
  createUser: (payload) => apiFetch('/api/admin/users/create', { method: 'POST', body: JSON.stringify(payload) }),
  // Refresh own custom claims from Firestore role
  syncClaimsSelf: () => apiFetch('/api/admin/users/sync-claims-self', { method: 'POST' }),
  // Send FCM push
  sendNotification: (payload) => apiFetch('/api/admin/notifications/send', { method: 'POST', body: JSON.stringify(payload) }),
  // Send announcement to a gym's audience (saved to announcements collection + FCM push to subscribed tokens)
  sendAnnouncement: (payload) => apiFetch('/api/admin/announcements/send', { method: 'POST', body: JSON.stringify(payload) }),
  sendExpiryAlerts: (payload) => apiFetch('/api/admin/notifications/send-expiry-alerts', { method: 'POST', body: JSON.stringify(payload) }),
  createBackup: (payload) => apiFetch('/api/admin/backups/create', { method: 'POST', body: JSON.stringify(payload) }),
  listBackups: (gymId) => apiFetch(`/api/admin/backups/list?gymId=${encodeURIComponent(gymId)}`),
  downloadBackup: async (id) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    const idToken = await auth.currentUser.getIdToken()
    const res = await fetch(`/api/admin/backups/${id}/download`, { headers: { Authorization: `Bearer ${idToken}` } })
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `gymtain-backup-${id}.json`; a.click()
    URL.revokeObjectURL(url)
  },
  // Revoke all refresh tokens (single-device login server-side enforcement)
  enforceSingleDevice: () => apiFetch('/api/admin/single-device/enforce-logout', { method: 'POST' }),
  // Delete a user (super admin only)
  deleteUser: (uid) => apiFetch(`/api/admin/users/${uid}`, { method: 'DELETE' }),
  resetPassword: (uid) => apiFetch('/api/admin/users/reset-password', { method: 'POST', body: JSON.stringify({ uid }) }),
  listUsers: () => apiFetch('/api/admin/users/list'),
  savePlan: (payload) => apiFetch('/api/admin/plans/save', { method: 'POST', body: JSON.stringify(payload) }),
  deletePlan: (id) => apiFetch(`/api/admin/plans/${id}`, { method: 'DELETE' }),
  saveOffer: (payload) => apiFetch('/api/admin/offers/save', { method: 'POST', body: JSON.stringify(payload) }),
  deleteOffer: (id) => apiFetch(`/api/admin/offers/${id}`, { method: 'DELETE' }),
  requestEmailChange: (newEmail) => apiFetch('/api/admin/email-change/request', { method: 'POST', body: JSON.stringify({ newEmail }) }),
  approveEmailChange: (id) => apiFetch('/api/admin/email-change/approve', { method: 'POST', body: JSON.stringify({ id }) }),
  rejectEmailChange: (id, reason) => apiFetch('/api/admin/email-change/reject', { method: 'POST', body: JSON.stringify({ id, reason }) }),
  runExpireMembers: () => apiFetch('/api/admin/cron/expire-members', { method: 'POST' }),

  // ---- Unified Attendance API ----
  markAttendance: (payload) => apiFetch('/api/attendance', { method: 'POST', body: JSON.stringify(payload) }),
  listAttendance: ({ gymId, memberId, from, to }) => {
    const qp = new URLSearchParams({ gymId })
    if (memberId) qp.set('memberId', memberId)
    if (from) qp.set('from', from)
    if (to) qp.set('to', to)
    return apiFetch(`/api/attendance?${qp.toString()}`)
  },
  clearAttendance: ({ gymId, memberId, date }) =>
    apiFetch(`/api/attendance?gymId=${encodeURIComponent(gymId)}&memberId=${encodeURIComponent(memberId)}&date=${encodeURIComponent(date)}`,
      { method: 'DELETE' }),
}

// Health check (no auth)
export async function checkHealth() {
  const res = await fetch('/api/health')
  return res.json()
}
