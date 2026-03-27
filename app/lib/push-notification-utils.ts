export type NormalizedPushEvent = {
  id?: string;
  title: string;
  body: string;
  data: Record<string, any>;
};

export const isUuid = (value: unknown): boolean => {
  const raw = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
};

export const asUuidOrNull = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return isUuid(raw) ? raw : null;
};

export const isLikelyJwt = (value: unknown): boolean => {
  const raw = String(value || '').trim();
  return !!raw && raw.split('.').length === 3;
};

const coerceDataRecord = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
};

/**
 * Capacitor FCM: `{ notification: { title, body, data } }`.
 * Web `onMessage`: `{ notification?: {...}, data?: {...} }`.
 * Tüm `data` değerleri FCM'de string olabilir.
 */
export const normalizePushEvent = (raw: any): NormalizedPushEvent => {
  const cap = raw?.notification;
  const base = cap || raw?.notification || raw || {};
  const data = coerceDataRecord(
    base?.data ?? raw?.data ?? cap?.data ?? raw?.notification?.data,
  );

  const title =
    String(data.title || data.title_text || base?.title || cap?.title || raw?.title || 'Bildirim').trim() ||
    'Bildirim';
  const body =
    String(
      data.message || data.body || data.body_text || base?.body || cap?.body || raw?.body || 'Yeni bildirim var.',
    ).trim() || 'Yeni bildirim var.';

  const idRaw = base?.id || raw?.id || data.notification_id || data.notificationId;
  return {
    id: isUuid(idRaw) ? String(idRaw) : undefined,
    title,
    body,
    data,
  };
};

