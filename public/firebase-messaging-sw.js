/* eslint-disable no-undef */
// Firebase Web Push service worker.
// Config is passed via query params when registering the worker.

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search || '');
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

const hasRequiredConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

if (hasRequiredConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload?.data || {};
    const title = payload?.notification?.title || data.title || 'Yeni bildirim';
    const body = payload?.notification?.body || data.message || 'Detaylari gormek icin uygulamayi ac.';
    const productId = data.product_id;
    const targetPath = productId ? `/app/product/${productId}` : '/app/notifications';

    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      data: {
        url: targetPath,
      },
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/app/notifications';
  event.waitUntil(clients.openWindow(targetUrl));
});
