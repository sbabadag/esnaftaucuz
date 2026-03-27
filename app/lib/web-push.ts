import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';

const requiredFirebaseVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const getFirebaseConfig = (): FirebaseOptions | null => {
  const values = requiredFirebaseVars.map((key) => import.meta.env[key]);
  if (values.some((v) => !v || String(v).trim() === '')) return null;

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
};

const ensureFirebaseApp = () => {
  const config = getFirebaseConfig();
  if (!config) return null;
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(config);
};

const buildServiceWorkerUrl = () => {
  const config = getFirebaseConfig();
  if (!config) return null;
  const query = new URLSearchParams({
    apiKey: config.apiKey || '',
    authDomain: config.authDomain || '',
    projectId: config.projectId || '',
    storageBucket: config.storageBucket || '',
    messagingSenderId: config.messagingSenderId || '',
    appId: config.appId || '',
  });
  return `/firebase-messaging-sw.js?${query.toString()}`;
};

export const isWebPushReady = async () => {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (!getFirebaseConfig()) return false;
  return isSupported().catch(() => false);
};

export const registerWebPushAndGetToken = async () => {
  const ready = await isWebPushReady();
  if (!ready) return null;

  const vapidKey = import.meta.env.VITE_FIREBASE_WEB_PUSH_VAPID_KEY;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const serviceWorkerUrl = buildServiceWorkerUrl();
  if (!serviceWorkerUrl) return null;

  const registration = await navigator.serviceWorker.register(serviceWorkerUrl);
  const app = ensureFirebaseApp();
  if (!app) return null;

  const messaging = getMessaging(app);
  const token = await getToken(
    messaging,
    vapidKey
      ? {
          vapidKey,
          serviceWorkerRegistration: registration,
        }
      : {
          serviceWorkerRegistration: registration,
        },
  );

  return token || null;
};

/** Web: uygulama ön plandayken FCM bildirimi SW yerine buraya düşer; SW sadece arka plan. */
export const subscribeWebForegroundMessages = (handler: (payload: unknown) => void): (() => void) => {
  const app = ensureFirebaseApp();
  if (!app || typeof window === 'undefined') return () => {};
  let messaging: Messaging;
  try {
    messaging = getMessaging(app);
  } catch {
    return () => {};
  }
  return onMessage(messaging, (payload) => {
    handler(payload);
  });
};
