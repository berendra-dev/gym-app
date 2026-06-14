import admin from 'firebase-admin'

// Server-side only. NEVER import from a client component.
function initAdmin() {
  if (admin.apps.length) return admin
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
    console.warn('[firebase-admin] missing env vars; admin SDK disabled')
    return null
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  })
  return admin
}

const a = initAdmin()
export const adminAuth = a ? a.auth() : null
export const adminDb = a ? a.firestore() : null
export const adminMessaging = a ? a.messaging() : null
export default a
