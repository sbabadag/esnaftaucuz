/**
 * Shared API utilities extracted from supabase-api.ts
 */
import { supabase, safeGetSession } from '../lib/supabase';

// ── Query Cache ──

type ApiCacheEntry<T> = {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
};

const apiQueryCache = new Map<string, ApiCacheEntry<any>>();

export const stableKey = (prefix: string, payload?: unknown) => {
  try {
    return `${prefix}:${JSON.stringify(payload ?? {})}`;
  } catch {
    return `${prefix}:fallback`;
  }
};

export const cachedQuery = async <T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const existing = apiQueryCache.get(key) as ApiCacheEntry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > now) return existing.value;
  if (existing?.pending) return existing.pending;

  const pending = fetcher()
    .then((value) => {
      let effectiveTtl = ttlMs;
      if (key.startsWith('prices:getAll') && Array.isArray(value) && value.length === 0) {
        effectiveTtl = 0;
      }
      apiQueryCache.set(key, { value, expiresAt: Date.now() + effectiveTtl });
      return value;
    })
    .catch((error) => {
      apiQueryCache.delete(key);
      throw error;
    });

  apiQueryCache.set(key, { expiresAt: now + ttlMs, pending });
  return pending;
};

export const invalidateCachedQueries = (prefix: string) => {
  for (const key of apiQueryCache.keys()) {
    if (key.startsWith(prefix)) apiQueryCache.delete(key);
  }
};

// ── Auth Headers ──

export const getAccessTokenFromStorageFallback = (): string | null => {
  try {
    const extract = (rawValue: string | null): string | null => {
      const raw = String(rawValue || '').trim();
      if (!raw) return null;
      if (raw.includes('.') && !raw.startsWith('{') && !raw.startsWith('[')) return raw;
      try {
        const parsed: any = JSON.parse(raw);
        const stack: any[] = [parsed];
        while (stack.length > 0) {
          const current = stack.pop();
          if (!current) continue;
          if (typeof current === 'object') {
            const token = current.access_token || current.accessToken;
            if (typeof token === 'string' && token.includes('.')) return token;
            if (Array.isArray(current)) {
              for (const item of current) stack.push(item);
            } else {
              for (const value of Object.values(current)) stack.push(value);
            }
          }
        }
      } catch { /* ignore */ }
      return null;
    };

    const direct = extract(localStorage.getItem('authToken'));
    if (direct) return direct;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const looksLikeAuth =
        (key.startsWith('sb-') && key.endsWith('-auth-token')) || key.startsWith('supabase.auth.');
      if (!looksLikeAuth) continue;
      const token = extract(localStorage.getItem(key));
      if (token) return token;
    }
  } catch { /* ignore */ }
  return null;
};

export const getRestAuthHeaders = async () => {
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  let accessToken: string | null = null;
  try {
    const safe = await safeGetSession();
    accessToken = safe.accessToken || null;
  } catch {
    accessToken = null;
  }
  if (!accessToken) accessToken = getAccessTokenFromStorageFallback();
  const headers: Record<string, string> = {
    apikey: sbKey,
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
};

// ── Timeout Helper ──

export const withHardTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)),
  ]);
};