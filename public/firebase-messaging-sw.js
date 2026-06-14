// Firebase Cloud Messaging Service Worker — Phase G
// Loaded at /firebase-messaging-sw.js, handles background notifications.
// Web config is public — safe to hardcode here.
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAVS_QA115NS_8jyXxiApZzEjMoOQqmafA',
  authDomain: 'gymtain-84128.firebaseapp.com',
  projectId: 'gymtain-84128',
  storageBucket: 'gymtain-84128.firebasestorage.app',
  messagingSenderId: '969915289901',
  appId: '1:969915289901:web:01813b2877876c0695c3a4',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Gymtain'
  const body = payload.notification?.body || ''
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
