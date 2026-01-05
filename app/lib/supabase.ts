import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'MISSING');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'MISSING');
  console.error('⚠️ This is a build-time error. Environment variables must be set during build.');
  console.error('⚠️ For Codemagic: Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings → Environment variables');
  console.warn('⚠️ Continuing without Supabase - some features may not work');
}

if (supabaseUrl && supabaseAnonKey) {
  console.log('✅ Supabase client initialized');
  console.log('🔗 Supabase URL:', supabaseUrl.substring(0, 30) + '...');
  console.log('🔑 Supabase Key:', supabaseAnonKey.substring(0, 20) + '...');
} else {
  console.warn('⚠️ Supabase not configured - using mock client');
  console.warn('⚠️ VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'MISSING');
  console.warn('⚠️ VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'MISSING');
}

// Create Supabase client with error handling
// Use singleton pattern to prevent multiple instances
let supabaseClient: ReturnType<typeof createClient> | null = null;

if (!supabaseClient) {
  try {
    if (supabaseUrl && supabaseAnonKey) {
      // Detect if we're on mobile (Capacitor)
      const isMobile = typeof window !== 'undefined' && 
        (window as any).Capacitor?.isNativePlatform();
      
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          // On mobile, use PKCE flow which is more secure and supports custom URL schemes
          // PKCE flow doesn't require redirectTo parameter
          flowType: isMobile ? 'pkce' : 'implicit',
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-client-info': 'esnaftaucuz-web',
          },
          fetch: (url, options = {}) => {
            // Increase timeout for mobile networks
            const controller = new AbortController();
            const startTime = Date.now();
            const timeoutId = setTimeout(() => {
              const elapsed = Date.now() - startTime;
              console.error('⚠️ Supabase fetch timeout after', elapsed, 'ms:', url);
              controller.abort();
            }, 30000); // 30 second timeout (increased)
            
            const urlStr = typeof url === 'string' ? url : url.toString();
            console.log('🌐 Supabase fetch START:', urlStr.substring(0, 100), options.method || 'GET');
            console.log('⏱️ Fetch started at:', new Date().toISOString());
            
            return fetch(url, {
              ...options,
              signal: controller.signal,
            })
              .then((response) => {
                const elapsed = Date.now() - startTime;
                clearTimeout(timeoutId);
                console.log(`✅ Supabase fetch SUCCESS (${elapsed}ms):`, urlStr.substring(0, 100), response.status);
                if (!response.ok) {
                  console.error('❌ Response not OK:', response.status, response.statusText);
                }
                return response;
              })
              .catch((error) => {
                const elapsed = Date.now() - startTime;
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                  console.error(`❌ Supabase fetch TIMEOUT (${elapsed}ms):`, urlStr.substring(0, 100));
                  throw new Error('İstek zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.');
                }
                console.error(`❌ Supabase fetch ERROR (${elapsed}ms):`, urlStr.substring(0, 100), error);
                console.error('Error details:', {
                  name: error.name,
                  message: error.message,
                  stack: error.stack?.substring(0, 200),
                });
                throw error;
              });
          },
        },
      });
      console.log('✅ Supabase client created successfully');
    } else {
      console.warn('⚠️ Supabase not configured - creating placeholder client');
      // Create a dummy client that will fail gracefully
      supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key');
    }
  } catch (error: any) {
    console.error('❌ Failed to create Supabase client:', error);
    // Create placeholder client as fallback
    supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
}

export const supabase = supabaseClient!;

