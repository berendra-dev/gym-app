import { NextResponse } from 'next/server'
import { adminAuth, adminDb, adminMessaging } from '@/lib/firebase/admin'
import { v4 as uuidv4 } from 'uuid'

// CORS
function withCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}
export async function OPTIONS() { return withCORS(new NextResponse(null, { status: 200 })) }

// Auth helpers
async function getCaller(request) {
  if (!adminAuth) throw new Error('Admin SDK not configured')
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) throw new Error('Missing bearer token')
  const decoded = await adminAuth.verifyIdToken(token)
  // Fetch live profile (role/gymId) — single source of truth
  const snap = await adminDb.collection('users').doc(decoded.uid).get()
  const profile = snap.exists ? snap.data() : null
  return { uid: decoded.uid, email: decoded.email, profile, claims: decoded }
}

function genTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
  let p = ''
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p + '!9'
}

async function handle(request, { params }) {
  const path = (params?.path || []).join('/')
  const method = request.method
  const route = `/${path}`

  try {
    // Public health
    if (route === '/' && method === 'GET') return withCORS(NextResponse.json({ ok: true, service: 'gymtain-api' }))
    if (route === '/health' && method === 'GET') {
      return withCORS(NextResponse.json({
        ok: true,
        adminSDK: !!adminAuth,
        projectId: process.env.FIREBASE_PROJECT_ID || null,
      }))
    }

    // -------- ADMIN SDK ROUTES (all require auth) --------
    if (route.startsWith('/admin/')) {
      const caller = await getCaller(request)

      // POST /api/admin/users/create  body: { email, displayName, role, gymId? }
      if (route === '/admin/users/create' && method === 'POST') {
        if (caller.profile?.role !== 'super_admin' && caller.profile?.role !== 'gym_owner') {
          return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        }
        const body = await request.json()
        const { email, displayName, role, gymId: targetGymId } = body
        // Validation: gym_owner may only create trainer/receptionist within their own gym
        let gymId = targetGymId
        if (caller.profile.role === 'gym_owner') {
          if (!['trainer', 'receptionist'].includes(role)) return withCORS(NextResponse.json({ error: 'gym owner can only create trainer/receptionist' }, { status: 403 }))
          gymId = caller.profile.gymId
        }
        if (!email || !role) return withCORS(NextResponse.json({ error: 'email and role required' }, { status: 400 }))
        const tempPassword = genTempPassword()
        const userRecord = await adminAuth.createUser({ email, password: tempPassword, displayName })
        // Set custom claims so Firestore rules can check request.auth.token.role
        await adminAuth.setCustomUserClaims(userRecord.uid, { role, gymId: gymId || null })
        // Firestore profile
        await adminDb.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid, email, displayName, role,
          gymId: gymId || null,
          mustChangePassword: true,
          createdAt: new Date(),
          createdBy: caller.uid,
        })
        return withCORS(NextResponse.json({ uid: userRecord.uid, email, password: tempPassword }))
      }

      // POST /api/admin/users/set-claims  body: { uid, role, gymId }
      if (route === '/admin/users/set-claims' && method === 'POST') {
        if (caller.profile?.role !== 'super_admin') return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        const { uid, role, gymId } = await request.json()
        await adminAuth.setCustomUserClaims(uid, { role, gymId: gymId || null })
        await adminDb.collection('users').doc(uid).update({ role, gymId: gymId || null })
        return withCORS(NextResponse.json({ ok: true }))
      }

      // POST /api/admin/users/sync-claims-self — refresh own custom claims from Firestore
      if (route === '/admin/users/sync-claims-self' && method === 'POST') {
        const p = caller.profile
        if (!p?.role) return withCORS(NextResponse.json({ error: 'no profile' }, { status: 400 }))
        await adminAuth.setCustomUserClaims(caller.uid, { role: p.role, gymId: p.gymId || null })
        return withCORS(NextResponse.json({ ok: true, role: p.role, gymId: p.gymId || null }))
      }

      // DELETE /api/admin/users/:uid
      const userDelMatch = route.match(/^\/admin\/users\/([^\/]+)$/)
      if (userDelMatch && method === 'DELETE') {
        if (caller.profile?.role !== 'super_admin') return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        const uid = userDelMatch[1]
        await adminAuth.deleteUser(uid).catch(() => {})
        await adminDb.collection('users').doc(uid).delete().catch(() => {})
        return withCORS(NextResponse.json({ ok: true }))
      }

      // POST /api/admin/gyms/create  body: { name, address, phone, ownerName, ownerEmail, plan }
      if (route === '/admin/gyms/create' && method === 'POST') {
        if (caller.profile?.role !== 'super_admin') return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        const { name, address, phone, ownerName, ownerEmail, plan = 'basic' } = await request.json()
        if (!name || !ownerEmail) return withCORS(NextResponse.json({ error: 'name and ownerEmail required' }, { status: 400 }))
        const gymId = uuidv4()
        const tempPassword = genTempPassword()
        const ownerRecord = await adminAuth.createUser({ email: ownerEmail, password: tempPassword, displayName: ownerName })
        await adminAuth.setCustomUserClaims(ownerRecord.uid, { role: 'gym_owner', gymId })
        const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 1)
        const expStr = expiry.toISOString().slice(0, 10)
        await adminDb.collection('gyms').doc(gymId).set({
          id: gymId, name, address: address || '', phone: phone || '',
          ownerUid: ownerRecord.uid, ownerEmail, ownerName,
          plan, subscriptionExpiry: expStr, renewalMode: 'expiry', gracePeriodDays: 3,
          status: 'active',
          createdAt: new Date(), createdBy: caller.uid,
        })
        await adminDb.collection('users').doc(ownerRecord.uid).set({
          uid: ownerRecord.uid, email: ownerEmail, displayName: ownerName,
          role: 'gym_owner', gymId, mustChangePassword: true, createdAt: new Date(),
        })
        await adminDb.collection('subscriptionHistory').add({
          gymId, plan, action: 'created', expiryDate: expStr, performedBy: caller.uid, timestamp: new Date(),
        })
        return withCORS(NextResponse.json({ gymId, ownerUid: ownerRecord.uid, email: ownerEmail, password: tempPassword, expiry: expStr }))
      }

      // POST /api/admin/notifications/send  body: { tokens: [], title, body, data? }
      if (route === '/admin/notifications/send' && method === 'POST') {
        if (!adminMessaging) return withCORS(NextResponse.json({ error: 'FCM not configured' }, { status: 503 }))
        const { tokens, title, body, data } = await request.json()
        if (!Array.isArray(tokens) || !tokens.length) return withCORS(NextResponse.json({ error: 'tokens required' }, { status: 400 }))
        const resp = await adminMessaging.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
        })
        return withCORS(NextResponse.json({ ok: true, successCount: resp.successCount, failureCount: resp.failureCount }))
      }

      // POST /api/admin/single-device/enforce-logout — force-logout from all other devices
      if (route === '/admin/single-device/enforce-logout' && method === 'POST') {
        // Revokes all refresh tokens for the caller
        await adminAuth.revokeRefreshTokens(caller.uid)
        return withCORS(NextResponse.json({ ok: true }))
      }

      return withCORS(NextResponse.json({ error: `admin route not found: ${route}` }, { status: 404 }))
    }

    return withCORS(NextResponse.json({ error: `route not found: ${route}` }, { status: 404 }))
  } catch (e) {
    const status = e?.message?.includes('bearer') || e?.message?.includes('decode') ? 401 : 500
    return withCORS(NextResponse.json({ error: e.message || 'server error' }, { status }))
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
