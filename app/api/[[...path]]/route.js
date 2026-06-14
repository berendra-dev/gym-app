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

    // -------- PUBLIC ROUTES (no auth — for QR flows) --------
    if (route.startsWith('/public/')) {
      if (!adminDb) return withCORS(NextResponse.json({ error: 'server not configured' }, { status: 503 }))

      // GET /api/public/gym/:gymId  — basic public gym info for QR landing
      const gymInfoMatch = route.match(/^\/public\/gym\/([^\/]+)$/)
      if (gymInfoMatch && method === 'GET') {
        const gymId = gymInfoMatch[1]
        const snap = await adminDb.collection('gyms').doc(gymId).get()
        if (!snap.exists) return withCORS(NextResponse.json({ error: 'not found' }, { status: 404 }))
        const g = snap.data()
        if (g.status !== 'active') return withCORS(NextResponse.json({ error: 'gym not active' }, { status: 403 }))
        return withCORS(NextResponse.json({ id: gymId, name: g.name, address: g.address || '', phone: g.phone || '' }))
      }

      // POST /api/public/checkin  body: { gymId, phone? OR memberId? }
      if (route === '/public/checkin' && method === 'POST') {
        const { gymId, phone, memberId } = await request.json()
        if (!gymId || (!phone && !memberId)) return withCORS(NextResponse.json({ error: 'gymId and (phone or memberId) required' }, { status: 400 }))
        const gymDoc = await adminDb.collection('gyms').doc(gymId).get()
        if (!gymDoc.exists || gymDoc.data().status !== 'active') return withCORS(NextResponse.json({ error: 'gym not found or inactive' }, { status: 404 }))
        // Look up member by memberId (preferred) or phone
        let memSnap
        if (memberId) {
          memSnap = await adminDb.collection('members').where('gymId', '==', gymId).where('id', '==', memberId).limit(1).get()
        } else {
          memSnap = await adminDb.collection('members').where('gymId', '==', gymId).where('phone', '==', phone).limit(1).get()
        }
        if (memSnap.empty) return withCORS(NextResponse.json({ ok: false, message: 'No member found.' }))
        const member = memSnap.docs[0].data()
        const today = new Date().toISOString().slice(0, 10)
        if (member.expiryDate && member.expiryDate < today) {
          return withCORS(NextResponse.json({ ok: false, message: `Membership expired on ${member.expiryDate}. Please renew at reception.`, name: member.name }))
        }
        const docId = `${gymId}_${member.id}_${today}`
        const existing = await adminDb.collection('attendance').doc(docId).get()
        if (existing.exists && existing.data().status === 'present') {
          return withCORS(NextResponse.json({ ok: true, dupe: true, message: `Already checked in today, ${member.name}!`, name: member.name }))
        }
        await adminDb.collection('attendance').doc(docId).set({
          gymId, memberId: member.id, memberName: member.name,
          date: today, status: 'present',
          markedBy: 'qr_self_checkin', markedByRole: 'student',
          markedAt: new Date(), manual: false,
        })
        return withCORS(NextResponse.json({ ok: true, message: `Welcome ${member.name}! Check-in successful.`, name: member.name }))
      }

      // POST /api/public/admission  body: { gymId, name, phone, email?, gender, plan, photoBase64? }
      if (route === '/public/admission' && method === 'POST') {
        const body = await request.json()
        const { gymId, name, phone, email = '', gender = 'male', plan = 'monthly', photoBase64 } = body
        if (!gymId || !name || !phone) return withCORS(NextResponse.json({ error: 'gymId, name, phone required' }, { status: 400 }))
        const gymDoc = await adminDb.collection('gyms').doc(gymId).get()
        if (!gymDoc.exists || gymDoc.data().status !== 'active') return withCORS(NextResponse.json({ error: 'gym not found or inactive' }, { status: 404 }))
        const memberId = uuidv4()
        let photoURL = null
        if (photoBase64) {
          try {
            const admin = (await import('firebase-admin')).default
            const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
            const m = photoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
            if (m) {
              const contentType = m[1]
              const buf = Buffer.from(m[2], 'base64')
              const ext = contentType.split('/')[1].replace('+xml', '')
              const filePath = `${gymId}/members/${memberId}/profile.${ext === 'jpeg' ? 'jpg' : ext}`
              const file = bucket.file(filePath)
              await file.save(buf, { metadata: { contentType }, public: true })
              photoURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`
            }
          } catch (e) { console.warn('[admission] photo upload failed:', e.message) }
        }
        const planMonths = plan === 'yearly' ? 12 : plan === 'halfyearly' ? 6 : plan === 'quarterly' ? 3 : 1
        const joinDate = new Date()
        const expiryDate = new Date(joinDate); expiryDate.setMonth(expiryDate.getMonth() + planMonths)
        await adminDb.collection('admissionRequests').add({
          id: memberId, gymId,
          name, phone, email, gender, plan,
          joinDate: joinDate.toISOString().slice(0, 10),
          expiryDate: expiryDate.toISOString().slice(0, 10),
          photoURL,
          status: 'pending',
          source: 'qr_public',
          createdAt: new Date(),
        })
        return withCORS(NextResponse.json({ ok: true, memberId }))
      }

      return withCORS(NextResponse.json({ error: `public route not found: ${route}` }, { status: 404 }))
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

      // POST /api/admin/notifications/send-expiry-alerts  body: { gymId, daysAhead? }
      if (route === '/admin/notifications/send-expiry-alerts' && method === 'POST') {
        const { gymId, daysAhead = 7 } = await request.json()
        if (!gymId) return withCORS(NextResponse.json({ error: 'gymId required' }, { status: 400 }))
        if (caller.profile?.role !== 'super_admin' && caller.profile?.gymId !== gymId) return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        const today = new Date().toISOString().slice(0, 10)
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + Number(daysAhead))
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        // Members with expiryDate <= cutoff
        const memSnap = await adminDb.collection('members').where('gymId', '==', gymId).get()
        const targets = []
        memSnap.forEach(d => {
          const m = d.data()
          if (m.expiryDate && m.expiryDate <= cutoffStr) targets.push(m)
        })
        // Look up linked student user accounts (if any) for FCM tokens
        const userSnap = await adminDb.collection('users').where('gymId', '==', gymId).where('role', '==', 'student').get()
        const userByMember = {}
        userSnap.forEach(d => { const u = d.data(); if (u.linkedMemberId) userByMember[u.linkedMemberId] = u })
        const tokens = []
        const alerts = []
        for (const m of targets) {
          const u = userByMember[m.id]
          const expired = m.expiryDate < today
          alerts.push({ memberId: m.id, name: m.name, expiryDate: m.expiryDate, expired, hasTokens: !!u?.fcmTokens?.length })
          if (u?.fcmTokens?.length) tokens.push(...u.fcmTokens)
        }
        let pushResult = null
        if (adminMessaging && tokens.length) {
          const resp = await adminMessaging.sendEachForMulticast({
            tokens,
            notification: { title: 'Membership expiring soon', body: 'Your gym membership needs renewal. Please visit the reception.' },
            data: { type: 'expiry_alert', gymId },
          })
          pushResult = { successCount: resp.successCount, failureCount: resp.failureCount }
        }
        // Log
        await adminDb.collection('announcements').add({
          gymId, title: 'Expiry alerts', body: `Auto-sent for ${alerts.length} members expiring by ${cutoffStr}`,
          audience: 'members', createdBy: caller.uid, createdByRole: caller.profile?.role,
          targetCount: alerts.length, tokenCount: tokens.length,
          createdAt: new Date(), auto: true,
        })
        return withCORS(NextResponse.json({ ok: true, totalCandidates: alerts.length, tokensSent: tokens.length, push: pushResult, alerts }))
      }

      // POST /api/admin/backups/create  body: { gymId }
      if (route === '/admin/backups/create' && method === 'POST') {
        if (caller.profile?.role !== 'super_admin' && caller.profile?.gymId !== (await request.clone().json()).gymId) {
          // re-parse safe
        }
        const body = await request.json()
        const { gymId } = body
        if (!gymId) return withCORS(NextResponse.json({ error: 'gymId required' }, { status: 400 }))
        if (caller.profile?.role !== 'super_admin' && caller.profile?.gymId !== gymId) return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        const collections = ['gyms', 'users', 'members', 'attendance', 'payments', 'admissionRequests', 'announcements', 'auditLogs', 'subscriptionHistory', 'memberVersions']
        const backup = { gymId, createdAt: new Date().toISOString(), data: {} }
        for (const col of collections) {
          if (col === 'gyms') {
            const d = await adminDb.collection(col).doc(gymId).get()
            backup.data[col] = d.exists ? [{ id: d.id, ...d.data() }] : []
          } else {
            const snap = await adminDb.collection(col).where('gymId', '==', gymId).get()
            backup.data[col] = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
          }
        }
        const id = uuidv4()
        await adminDb.collection('backups').doc(id).set({
          id, gymId, createdAt: new Date(),
          createdBy: caller.uid, createdByRole: caller.profile?.role,
          stats: Object.fromEntries(Object.entries(backup.data).map(([k, v]) => [k, v.length])),
          payload: JSON.stringify(backup).slice(0, 900000), // store inline (up to ~900KB)
        })
        return withCORS(NextResponse.json({ ok: true, id, stats: Object.fromEntries(Object.entries(backup.data).map(([k, v]) => [k, v.length])) }))
      }

      // GET /api/admin/backups/list?gymId=...
      if (route === '/admin/backups/list' && method === 'GET') {
        const url = new URL(request.url)
        const gymId = url.searchParams.get('gymId')
        if (caller.profile?.role !== 'super_admin' && caller.profile?.gymId !== gymId) return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        const snap = await adminDb.collection('backups').where('gymId', '==', gymId).get()
        const list = snap.docs.map(d => { const data = d.data(); delete data.payload; return { id: d.id, ...data } })
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        return withCORS(NextResponse.json({ backups: list }))
      }

      // GET /api/admin/backups/:id/download
      const backupDl = route.match(/^\/admin\/backups\/([^\/]+)\/download$/)
      if (backupDl && method === 'GET') {
        const id = backupDl[1]
        const doc = await adminDb.collection('backups').doc(id).get()
        if (!doc.exists) return withCORS(NextResponse.json({ error: 'not found' }, { status: 404 }))
        const data = doc.data()
        if (caller.profile?.role !== 'super_admin' && caller.profile?.gymId !== data.gymId) return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        return new NextResponse(data.payload, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename=backup-${data.gymId}-${id}.json`,
            'Access-Control-Allow-Origin': '*',
          },
        })
      }

      // POST /api/admin/announcements/send  body: { gymId, title, body, audience: 'all'|'staff'|'members', data? }
      if (route === '/admin/announcements/send' && method === 'POST') {
        const { gymId, title, body, audience = 'all', data } = await request.json()
        // Authorization: super_admin always; gym_owner/receptionist only for their own gym
        const callerRole = caller.profile?.role
        if (!gymId || !title || !body) return withCORS(NextResponse.json({ error: 'gymId, title, body required' }, { status: 400 }))
        if (callerRole !== 'super_admin' && !(['gym_owner', 'receptionist'].includes(callerRole) && caller.profile.gymId === gymId)) {
          return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
        }
        // Gather target users + tokens
        const staffRoles = ['gym_owner', 'receptionist', 'trainer']
        let q = adminDb.collection('users').where('gymId', '==', gymId)
        const snap = await q.get()
        const tokens = []
        const targets = []
        snap.forEach(d => {
          const u = d.data()
          const isStaff = staffRoles.includes(u.role)
          const include = audience === 'all' || (audience === 'staff' && isStaff) || (audience === 'members' && u.role === 'student')
          if (include && Array.isArray(u.fcmTokens)) { tokens.push(...u.fcmTokens); targets.push(d.id) }
        })
        // Persist announcement (history)
        const annRef = await adminDb.collection('announcements').add({
          gymId, title, body, audience, data: data || null,
          createdBy: caller.uid, createdByRole: callerRole,
          createdAt: new Date(),
          targetCount: targets.length, tokenCount: tokens.length,
        })
        // Send FCM if available
        let pushResult = null
        if (adminMessaging && tokens.length) {
          const resp = await adminMessaging.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: { announcementId: annRef.id, gymId, ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {}) },
          })
          pushResult = { successCount: resp.successCount, failureCount: resp.failureCount }
          // Best-effort: remove invalid tokens
          const invalid = []
          resp.responses.forEach((r, i) => {
            if (!r.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(r.error?.code)) invalid.push(tokens[i])
          })
          if (invalid.length) {
            const updates = snap.docs.map(async (d) => {
              const ft = d.data().fcmTokens || []
              const cleaned = ft.filter(t => !invalid.includes(t))
              if (cleaned.length !== ft.length) await d.ref.update({ fcmTokens: cleaned })
            })
            await Promise.all(updates)
          }
        }
        return withCORS(NextResponse.json({ ok: true, announcementId: annRef.id, targets: targets.length, tokens: tokens.length, push: pushResult }))
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
