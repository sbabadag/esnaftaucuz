import { useEffect } from 'react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging, Importance } from '@capacitor-firebase/messaging';
import { registerWebPushAndGetToken, subscribeWebForegroundMessages } from '../lib/web-push';
import { pushTokensAPI } from '../services/supabase-api';

type SyncFn = (payload: any) => Promise<boolean>;
type PersistFn = (payload: any) => void;
type ExtractFn = (payload: any) => any;

type DrainArgs = {
  userId?: string;
  pendingQueueKey: string;
  persistLocalNotification: PersistFn;
  syncNotificationFromPush: SyncFn;
};

export const usePendingPushDrain = ({
  userId,
  pendingQueueKey,
  persistLocalNotification,
  syncNotificationFromPush,
}: DrainArgs) => {
  useEffect(() => {
    if (!userId) return;
    const syncPendingAndNavigate = async () => {
      try {
        const rawQueue = localStorage.getItem(pendingQueueKey);
        const parsedQueue = rawQueue ? JSON.parse(rawQueue) : [];
        const queue = Array.isArray(parsedQueue) ? parsedQueue : [];
        if (queue.length > 0) {
          for (const eventPayload of queue.slice(0, 50)) {
            persistLocalNotification(eventPayload);
            await syncNotificationFromPush(eventPayload);
          }
          localStorage.removeItem(pendingQueueKey);
        }

        const pendingPayloadRaw = localStorage.getItem('pending_push_payload');
        if (pendingPayloadRaw) {
          const pendingPayload = JSON.parse(pendingPayloadRaw);
          persistLocalNotification(pendingPayload);
          const synced = await syncNotificationFromPush(pendingPayload);
          if (synced) {
            localStorage.removeItem('pending_push_payload');
          }
        }
      } catch {
        // ignore storage errors
      }
    };
    syncPendingAndNavigate();
  }, [userId, pendingQueueKey, persistLocalNotification, syncNotificationFromPush]);
};

export const usePendingPushRetry = ({
  userId,
  syncNotificationFromPush,
}: {
  userId?: string;
  syncNotificationFromPush: SyncFn;
}) => {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let tries = 0;
    const maxTries = 15;
    const timer = setInterval(async () => {
      if (cancelled) return;
      tries += 1;
      try {
        const pendingPayloadRaw = localStorage.getItem('pending_push_payload');
        if (!pendingPayloadRaw) {
          clearInterval(timer);
          return;
        }
        const pendingPayload = JSON.parse(pendingPayloadRaw);
        const synced = await syncNotificationFromPush(pendingPayload);
        if (synced) {
          localStorage.removeItem('pending_push_payload');
          clearInterval(timer);
          return;
        }
      } catch {
        // ignore and retry
      }
      if (tries >= maxTries) {
        clearInterval(timer);
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId, syncNotificationFromPush]);
};

export const usePendingPushRoute = ({
  userId,
  pathname,
  navigate,
}: {
  userId?: string;
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}) => {
  useEffect(() => {
    if (!userId) return;
    try {
      const pendingRoute = localStorage.getItem('pending_push_route');
      if (pendingRoute !== 'notifications') return;
      if (pathname !== '/app/notifications') {
        navigate('/app/notifications', { replace: true });
        return;
      }
      localStorage.removeItem('pending_push_route');
    } catch {
      // ignore storage errors
    }
  }, [userId, pathname, navigate]);
};

export const usePushRegistration = ({
  userId,
  navigate,
  persistLocalNotification,
  syncNotificationFromPush,
  extractPushPayload,
}: {
  userId?: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  persistLocalNotification: PersistFn;
  syncNotificationFromPush: SyncFn;
  extractPushPayload: ExtractFn;
}) => {
  useEffect(() => {
    let cancelled = false;
    let tokenRefreshListener: any = null;
    let receivedListener: any = null;
    let actionListener: any = null;
    let webForegroundUnsub: (() => void) | null = null;

    const registerPush = async () => {
      if (!userId) return;
      const platform = Capacitor.getPlatform();
      const isNative = Capacitor.isNativePlatform();
      const markerKey = `push_registered:${platform}:${userId}`;
      if (!isNative && localStorage.getItem(markerKey) === 'true') return;
      try {
        if (isNative) {
          const upsertTokenWithRetry = async (token: string, attempts: number = 3) => {
            for (let i = 0; i < attempts; i++) {
              if (cancelled) return;
              try {
                await pushTokensAPI.upsert(userId, token, platform === 'ios' ? 'ios' : 'android');
                return;
              } catch (err) {
                if (i === attempts - 1) throw err;
                await new Promise((resolve) => setTimeout(resolve, 1200 * (i + 1)));
              }
            }
          };

          await FirebaseMessaging.createChannel({
            id: 'price_alerts',
            name: 'Fiyat Bildirimleri',
            description: 'Fiyat dususleri ve onemli bildirimler',
            importance: Importance.High,
            vibration: true,
          });

          const permissions = await Promise.race([
            FirebaseMessaging.requestPermissions(),
            new Promise<any>((resolve) => setTimeout(() => resolve(null), 8000)),
          ]);
          const receive = String(permissions?.receive || '').toLowerCase();
          if (cancelled) return;
          if (receive === 'denied') {
            // Android may still provide an FCM token even when notification
            // runtime permission is denied. Keep registering token so server-side
            // pipeline is ready once user enables notifications later.
            console.warn('Push receive permission denied; proceeding with token registration attempt.');
          }

          let token: string | null = null;
          for (let i = 0; i < 3 && !token && !cancelled; i++) {
            const tokenResult = await Promise.race([
              FirebaseMessaging.getToken(),
              new Promise<any>((resolve) => setTimeout(() => resolve(null), 8000)),
            ]);
            token = tokenResult?.token || null;
            if (!token) await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
          }
          if (!token || cancelled) {
            console.warn('Push token could not be obtained after retries.');
            return;
          }

          await upsertTokenWithRetry(token);

          tokenRefreshListener = await FirebaseMessaging.addListener('tokenReceived', async (event) => {
            try {
              const refreshedToken = event?.token;
              if (!refreshedToken || cancelled) return;
              await upsertTokenWithRetry(refreshedToken);
            } catch (listenerError) {
              console.warn('Push token refresh registration failed:', listenerError);
            }
          });

          receivedListener = await FirebaseMessaging.addListener('notificationReceived', async (event) => {
            if (cancelled) return;
            // Önce toast (senkronizasyon yavaş olsa bile kullanıcı görür)
            try {
              const n = extractPushPayload(event);
              const title = String(n?.title || 'Bildirim').trim() || 'Bildirim';
              const body = String(n?.body || '').trim() || 'Yeni bildirim var.';
              toast(title, {
                description: body,
                duration: 6500,
                position: 'bottom-center',
              });
            } catch {
              toast.info('Yeni bildirim', { duration: 5000, position: 'bottom-center' });
            }
            persistLocalNotification(event);
            await syncNotificationFromPush(event);
          });

          actionListener = await FirebaseMessaging.addListener('notificationActionPerformed', async (event) => {
            if (cancelled) return;
            persistLocalNotification(event);
            const normalized = extractPushPayload(event);
            try {
              localStorage.setItem('pending_push_route', 'notifications');
            } catch {
              // ignore storage errors
            }
            try {
              localStorage.setItem('pending_push_payload', JSON.stringify(normalized));
            } catch {
              // ignore payload serialization errors
            }
            const synced = await syncNotificationFromPush(event);
            if (synced) {
              try {
                localStorage.removeItem('pending_push_payload');
              } catch {
                // ignore storage errors
              }
            }
            navigate('/app/notifications');
          });

          try {
            const delivered = await FirebaseMessaging.getDeliveredNotifications();
            const deliveredList = Array.isArray(delivered?.notifications) ? delivered.notifications : [];
            for (const notif of deliveredList.slice(0, 20)) {
              if (cancelled) break;
              await syncNotificationFromPush(notif);
            }
          } catch (deliveredError) {
            console.warn('Failed to sync delivered notifications:', deliveredError);
          }
        } else {
          const token = await registerWebPushAndGetToken();
          if (!token || cancelled) return;
          await pushTokensAPI.upsert(userId, token, 'web');
          webForegroundUnsub = subscribeWebForegroundMessages((payload) => {
            if (cancelled) return;
            try {
              const n = extractPushPayload(payload);
              const title = String(n?.title || 'Bildirim').trim() || 'Bildirim';
              const body = String(n?.body || '').trim() || 'Yeni bildirim var.';
              toast(title, {
                description: body,
                duration: 6500,
                position: 'bottom-center',
              });
            } catch {
              toast.info('Yeni bildirim', { duration: 5000, position: 'bottom-center' });
            }
            persistLocalNotification(payload);
            void syncNotificationFromPush(payload);
          });
        }

        if (cancelled) return;
        if (!isNative) localStorage.setItem(markerKey, 'true');
      } catch (error) {
        console.warn('Push token registration skipped:', error);
      }
    };

    registerPush();
    return () => {
      cancelled = true;
      try { tokenRefreshListener?.remove?.(); } catch {}
      try { receivedListener?.remove?.(); } catch {}
      try { actionListener?.remove?.(); } catch {}
      try { webForegroundUnsub?.(); } catch { webForegroundUnsub = null; }
    };
  }, [userId, navigate, persistLocalNotification, syncNotificationFromPush, extractPushPayload]);
};

