import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

function withCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}
export async function OPTIONS() { return withCORS(new NextResponse(null, { status: 200 })) }

/**
 * SINGLE SOURCE OF TRUTH for marking attendance.
 * Path layout (per user spec):  attendance/{gymId}/{memberId}/{date}
 *
 * @param {Object} p
 * @param {string} p.gymId   - required
 * @param {string} p.memberId - required
 * @param {string} p.date    - required (YYYY-MM-DD)
 * @param {string} p.via     - 'qr' | 'manual'
 * @param {string} [p.status='present']
 * @param {Object} [p.actor] - { uid, role, name } when via='manual'
 * @param {string} [p.reason]
 * @throws Error with .code === 'MEMBERSHIP_EXPIRED' when expired
 */
export async function recordAttendance({ gymId, memberId, date, via, status = 'present', actor = null, reason = null }) {
  if (!gymId || !memberId || !date || !via) {
    const e = new Error('gymId, memberId, date and via are required'); e.code = 'INVALID_INPUT'; throw e
  }
  if (!['qr', 'manual'].includes(via)) { const e = new Error('via must be "qr" or "manual"'); e.code = 'INVALID_INPUT'; throw e }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { const e = new Error('date must be YYYY-MM-DD'); e.code = 'INVALID_INPUT'; throw e }

  // Member lookup (doc id === memberId since we use setDoc with explicit id elsewhere)
  const memSnap = await adminDb.collection('members').doc(memberId).get()
  if (!memSnap.exists) { const e = new Error('Member not found'); e.code = 'NOT_FOUND'; throw e }
  const member = memSnap.data()
  if (member.gymId !== gymId) { const e = new Error('Member does not belong to this gym'); e.code = 'FORBIDDEN'; throw e }
  if (member.status === 'inactive') { const e = new Error('Member is inactive'); e.code = 'INACTIVE'; throw e }

  // Expiry check — accept either renewalDate or expiryDate field
  const renewalDate = member.renewalDate || member.expiryDate
  if (!renewalDate || renewalDate < date) {
    const e = new Error('MEMBERSHIP EXPIRED')
    e.code = 'MEMBERSHIP_EXPIRED'
    e.expiryDate = renewalDate || null
    e.memberName = member.name
    throw e
  }

  // Single canonical write — nested per user spec
  const ref = adminDb.collection('attendance').doc(gymId).collection(memberId).doc(date)
  const existing = await ref.get()
  const wasDuplicate = existing.exists && existing.data().status === 'present'

  const payload = {
    gymId, memberId, memberName: member.name,
    date, status, via,
    timestamp: new Date(),
    markedAt: new Date(),
    markedBy: actor?.uid || (via === 'qr' ? 'qr_self_checkin' : null),
    markedByRole: actor?.role || 'student',
    markedByName: actor?.name || null,
    reason: reason || null,
    manual: via === 'manual',
  }
  await ref.set(payload)

  return {
    ok: true,
    docPath: `attendance/${gymId}/${memberId}/${date}`,
    duplicate: wasDuplicate,
    memberName: member.name,
    status, via, date, memberId, gymId,
  }
}

async function getCallerOptional(request) {
  if (!adminAuth) return null
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const p = await adminDb.collection('users').doc(decoded.uid).get()
    return { uid: decoded.uid, email: decoded.email, profile: p.exists ? p.data() : null }
  } catch { return null }
}

// ---------------- POST: mark attendance ----------------
export async function POST(request) {
  try {
    if (!adminDb) return withCORS(NextResponse.json({ error: 'server not configured' }, { status: 503 }))
    const body = await request.json()
    const { gymId, memberId, date, via, status, reason } = body

    let actor = null
    if (via === 'manual') {
      const caller = await getCallerOptional(request)
      if (!caller?.profile) return withCORS(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
      const role = caller.profile.role
      if (!['super_admin', 'gym_owner', 'receptionist'].includes(role)) {
        return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      }
      if (role !== 'super_admin' && caller.profile.gymId !== gymId) {
        return withCORS(NextResponse.json({ error: 'forbidden: gym mismatch' }, { status: 403 }))
      }
      actor = { uid: caller.uid, role, name: caller.profile.displayName || caller.email }
    } else if (via !== 'qr') {
      return withCORS(NextResponse.json({ error: 'via must be "qr" or "manual"' }, { status: 400 }))
    }

    console.log('[attendance.api] mark →', { gymId, memberId, date, via, actor: actor?.uid || null })
    const result = await recordAttendance({ gymId, memberId, date, via, status, actor, reason })

    if (via === 'manual' && actor) {
      await adminDb.collection('auditLogs').add({
        gymId, action: 'attendance.manual',
        targetType: 'attendance', targetId: result.docPath,
        performedBy: actor.uid, performedByRole: actor.role, performedByName: actor.name,
        after: { status: result.status, via: result.via, date: result.date, memberId: result.memberId },
        reason: reason || null,
        timestamp: new Date(),
      })
    }
    return withCORS(NextResponse.json(result))
  } catch (e) {
    if (e.code === 'MEMBERSHIP_EXPIRED') {
      return withCORS(NextResponse.json({
        error: 'MEMBERSHIP EXPIRED',
        code: 'MEMBERSHIP_EXPIRED',
        message: `Membership expired${e.expiryDate ? ` on ${e.expiryDate}` : ''}. Please renew at reception.`,
        expiryDate: e.expiryDate, memberName: e.memberName,
      }, { status: 403 }))
    }
    if (e.code === 'NOT_FOUND') return withCORS(NextResponse.json({ error: e.message, code: e.code }, { status: 404 }))
    if (e.code === 'FORBIDDEN' || e.code === 'INACTIVE') return withCORS(NextResponse.json({ error: e.message, code: e.code }, { status: 403 }))
    if (e.code === 'INVALID_INPUT') return withCORS(NextResponse.json({ error: e.message, code: e.code }, { status: 400 }))
    return withCORS(NextResponse.json({ error: e.message }, { status: 500 }))
  }
}

// ---------------- GET: read attendance ----------------
//   /api/attendance?gymId=X[&memberId=Y][&from=YYYY-MM-DD][&to=YYYY-MM-DD]
export async function GET(request) {
  try {
    if (!adminDb) return withCORS(NextResponse.json({ error: 'server not configured' }, { status: 503 }))
    const url = new URL(request.url)
    const gymId = url.searchParams.get('gymId')
    const memberId = url.searchParams.get('memberId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if (!gymId) return withCORS(NextResponse.json({ error: 'gymId required' }, { status: 400 }))

    const caller = await getCallerOptional(request)
    if (!caller?.profile) return withCORS(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
    const role = caller.profile.role
    const isSuper = role === 'super_admin'
    if (!isSuper && caller.profile.gymId !== gymId) {
      return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
    }
    if (role === 'student') {
      const linkedId = caller.profile.linkedMemberId
      if (!linkedId) return withCORS(NextResponse.json({ error: 'no linked member' }, { status: 403 }))
      if (memberId && memberId !== linkedId) {
        return withCORS(NextResponse.json({ error: 'forbidden: cannot read other members' }, { status: 403 }))
      }
    } else if (role === 'trainer') {
      // Trainer: can read assigned members only — for now, deny gym-wide reads
      if (!memberId) return withCORS(NextResponse.json({ error: 'trainer must specify memberId' }, { status: 403 }))
    }

    const gymRef = adminDb.collection('attendance').doc(gymId)
    let records = []

    if (memberId) {
      // Direct subcollection read — fast
      let q = gymRef.collection(memberId)
      if (from) q = q.where('date', '>=', from)
      if (to)   q = q.where('date', '<=', to)
      const snap = await q.get()
      snap.docs.forEach(d => records.push({ ...d.data(), _docId: d.id }))
    } else {
      // Gym-wide: iterate all member subcollections under this gym
      const subs = await gymRef.listCollections()
      for (const sub of subs) {
        let q = sub
        if (from) q = q.where('date', '>=', from)
        if (to)   q = q.where('date', '<=', to)
        const snap = await q.get()
        snap.docs.forEach(d => records.push({ ...d.data(), _docId: d.id }))
      }
    }
    return withCORS(NextResponse.json({ ok: true, count: records.length, records }))
  } catch (e) {
    return withCORS(NextResponse.json({ error: e.message }, { status: 500 }))
  }
}

// ---------------- DELETE: clear a mark ----------------
//   /api/attendance?gymId=X&memberId=Y&date=Z
export async function DELETE(request) {
  try {
    if (!adminDb) return withCORS(NextResponse.json({ error: 'server not configured' }, { status: 503 }))
    const url = new URL(request.url)
    const gymId = url.searchParams.get('gymId')
    const memberId = url.searchParams.get('memberId')
    const date = url.searchParams.get('date')
    if (!gymId || !memberId || !date) {
      return withCORS(NextResponse.json({ error: 'gymId, memberId, date required' }, { status: 400 }))
    }
    const caller = await getCallerOptional(request)
    if (!caller?.profile) return withCORS(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
    const role = caller.profile.role
    if (!['super_admin', 'gym_owner', 'receptionist'].includes(role)) {
      return withCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
    }
    if (role !== 'super_admin' && caller.profile.gymId !== gymId) {
      return withCORS(NextResponse.json({ error: 'forbidden: gym mismatch' }, { status: 403 }))
    }

    const ref = adminDb.collection('attendance').doc(gymId).collection(memberId).doc(date)
    const before = (await ref.get()).data() || null
    await ref.delete()
    console.log('[attendance.api] clear →', { gymId, memberId, date })
    await adminDb.collection('auditLogs').add({
      gymId, action: 'attendance.clear',
      targetType: 'attendance', targetId: `attendance/${gymId}/${memberId}/${date}`,
      performedBy: caller.uid, performedByRole: role,
      performedByName: caller.profile.displayName || caller.email,
      before, timestamp: new Date(),
    })
    return withCORS(NextResponse.json({ ok: true }))
  } catch (e) {
    return withCORS(NextResponse.json({ error: e.message }, { status: 500 }))
  }
}
