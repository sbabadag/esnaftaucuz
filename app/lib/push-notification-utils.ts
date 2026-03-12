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

export const normalizePushEvent = (raw: any): NormalizedPushEvent => {
  const base = raw?.notification || raw || {};
  const data = (base?.data || raw?.data || raw?.notification?.data || {}) as Record<string, any>;
  const idRaw = base?.id || raw?.id || data?.notification_id || data?.notificationId;
  return {
    id: isUuid(idRaw) ? String(idRaw) : undefined,
    title: data?.title || base?.title || raw?.title || 'Bildirim',
    body: data?.message || data?.body || base?.body || raw?.body || 'Yeni bildirim var.',
    data,
  };
};

