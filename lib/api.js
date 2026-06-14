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
}

// Health check (no auth)
export async function checkHealth() {
  const res = await fetch('/api/health')
  return res.json()
}
