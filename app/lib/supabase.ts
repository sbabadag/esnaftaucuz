import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const isMobile = typeof window !== 'undefined' &&
  !!(window as any).Capacitor?.isNativePlatform &&
  (window as any).Capacitor.isNativePlatform();

/** Oturum JWT'si taşımaz; yalnızca anon key ile okur. Keşfet listeleri için (RLS yanlışlığında oturumlu [] dönmesini önler). */
let anonReadClient: SupabaseClient | null = null;
export function getAnonReadClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!anonReadClient) {
    anonReadClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { 'x-client-info': 'esnaftaucuz-anon-read' },
      },
    });
  }
  return anonReadClient;
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: !isMobile,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce',
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-client-info': 'esnaftaucuz-web',
      },
    },
  }
);

/**
 * Safe wrapper around supabase.auth.getSession() that never hangs.
 * On Android WebView, getSession() can hang indefinitely during token refresh.
 * Falls back to reading the access token directly from localStorage.
 */
export async function safeGetSession(): Promise<{ accessToken: string; session: any | null }> {
  let session: any = null;
  let accessToken = '';

  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    session = (result as any)?.data?.session || null;
    accessToken = session?.access_token || '';
  } catch { /* timeout or error */ }

  if (!accessToken) {
    accessToken = getAccessTokenFromStorage();
  }

  return { accessToken, session };
}

function getAccessTokenFromStorage(): string {
  try {
    const directToken = localStorage.getItem('authToken');
    if (directToken && typeof directToken === 'string' && directToken.includes('.') && !directToken.startsWith('{')) {
      return directToken;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const isSupabaseKey =
        (key.startsWith('sb-') && key.endsWith('-auth-token')) ||
        key.startsWith('supabase.auth.');
      if (!isSupabaseKey) continue;

      const raw = localStorage.getItem(key) || '';
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const tkn = parsed?.access_token || parsed?.accessToken || '';
        if (typeof tkn === 'string' && tkn.includes('.')) return tkn;
      } catch { /* not JSON */ }
    }
  } catch { /* storage error */ }
  return '';
}
