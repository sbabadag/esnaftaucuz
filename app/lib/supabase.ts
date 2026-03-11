import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const isMobile = typeof window !== 'undefined' &&
  !!(window as any).Capacitor?.isNativePlatform &&
  (window as any).Capacitor.isNativePlatform();

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: isMobile ? 'pkce' : 'implicit',
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
