export const LOCAL_NOTIFICATIONS_UPDATED_EVENT = 'local-notifications-updated';

const readJsonArray = <T = any>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const writeJsonArray = (key: string, list: any[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
};

export const getLocalNotificationsKey = (userId: string) => `local-notifications:${userId}`;
export const getNotificationsCacheKey = (userId: string) => `notifications-cache:${userId}`;

export const emitLocalNotificationsUpdated = (userId: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LOCAL_NOTIFICATIONS_UPDATED_EVENT, {
      detail: { userId },
    })
  );
};

export const getLocalNotifications = <T = any>(userId: string): T[] =>
  readJsonArray<T>(getLocalNotificationsKey(userId));

export const setLocalNotifications = (userId: string, list: any[], emit: boolean = true) => {
  writeJsonArray(getLocalNotificationsKey(userId), list);
  if (emit) emitLocalNotificationsUpdated(userId);
};

export const addLocalNotification = (userId: string, row: any) => {
  const list = getLocalNotifications<any>(userId);
  const exists = list.some(
    (n: any) =>
      (row?.id && n?.id === row.id) ||
      (row?.price_id && n?.price_id === row.price_id && n?.type === row.type)
  );
  if (exists) return false;
  const next = [row, ...list].slice(0, 100);
  setLocalNotifications(userId, next, true);
  return true;
};

export const markLocalNotificationRead = (userId: string, notificationId: string) => {
  const list = getLocalNotifications<any>(userId);
  const next = list.map((n: any) => (n?.id === notificationId ? { ...n, is_read: true } : n));
  setLocalNotifications(userId, next, true);
};

export const markAllLocalNotificationsRead = (userId: string) => {
  const list = getLocalNotifications<any>(userId);
  const next = list.map((n: any) => ({ ...n, is_read: true }));
  setLocalNotifications(userId, next, true);
};

export const deleteLocalNotification = (userId: string, notificationId: string) => {
  const list = getLocalNotifications<any>(userId);
  const next = list.filter((n: any) => n?.id !== notificationId);
  setLocalNotifications(userId, next, true);
};

export const getUnreadFromLocalNotifications = (userId: string) =>
  getLocalNotifications<any>(userId).filter((n: any) => n && n.is_read !== true).length;

export const getUnreadFromNotificationsCache = (userId: string) =>
  readJsonArray<any>(getNotificationsCacheKey(userId)).filter((n: any) => n && n.is_read !== true).length;

export const getImmediateUnreadCount = (userId: string) =>
  Math.max(getUnreadFromLocalNotifications(userId), getUnreadFromNotificationsCache(userId));

