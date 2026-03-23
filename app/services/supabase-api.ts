/**
 * Supabase Direct API Service
 * 
 * This service replaces the backend API and uses Supabase directly.
 * No backend server needed - everything runs client-side with Supabase.
 */

import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { getImmediateUnreadCount } from '../lib/notification-store';

const normalizeMerchantFlag = (value: any): boolean => {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 't' || normalized === '1';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
};
const resolveMerchantStatus = (profile: any): boolean => {
  const explicit = normalizeMerchantFlag(profile?.is_merchant);
  const subscriptionStatus = String(profile?.merchant_subscription_status || '').toLowerCase();
  const hasMerchantSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'past_due';
  const hasMerchantPlan = String(profile?.merchant_subscription_plan || '').trim().length > 0;
  return explicit || hasMerchantSubscription || hasMerchantPlan;
};

type ApiCacheEntry<T> = {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
};

const apiQueryCache = new Map<string, ApiCacheEntry<any>>();

const stableKey = (prefix: string, payload?: unknown) => {
  try {
    return `${prefix}:${JSON.stringify(payload ?? {})}`;
  } catch {
    return `${prefix}:fallback`;
  }
};

const cachedQuery = async <T,>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const existing = apiQueryCache.get(key) as ApiCacheEntry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }
  if (existing?.pending) {
    return existing.pending;
  }

  const pending = fetcher()
    .then((value) => {
      apiQueryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      apiQueryCache.delete(key);
      throw error;
    });

  apiQueryCache.set(key, {
    expiresAt: now + ttlMs,
    pending,
  });

  return pending;
};

const invalidateCachedQueries = (prefix: string) => {
  for (const key of apiQueryCache.keys()) {
    if (key.startsWith(prefix)) {
      apiQueryCache.delete(key);
    }
  }
};

const withHardTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
};

const extractAccessTokenFromUnknown = (rawValue: string | null): string | null => {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;

  if (raw.includes('.') && !raw.startsWith('{') && !raw.startsWith('[')) {
    return raw;
  }

  try {
    const parsed: any = JSON.parse(raw);
    const stack: any[] = [parsed];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      if (typeof current === 'object') {
        const accessTokenValue = current.access_token || current.accessToken;
        if (typeof accessTokenValue === 'string' && accessTokenValue.includes('.')) {
          return accessTokenValue;
        }

        if (Array.isArray(current)) {
          for (const item of current) stack.push(item);
        } else {
          for (const value of Object.values(current)) stack.push(value);
        }
      }
    }
  } catch {
    // ignore parse errors
  }

  return null;
};

const getAccessTokenFromStorageFallback = (): string | null => {
  try {
    const directToken = extractAccessTokenFromUnknown(localStorage.getItem('authToken'));
    if (directToken) return directToken;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const looksLikeSupabaseAuthKey =
        (key.startsWith('sb-') && key.endsWith('-auth-token')) ||
        key.startsWith('supabase.auth.');
      if (!looksLikeSupabaseAuthKey) continue;

      const token = extractAccessTokenFromUnknown(localStorage.getItem(key));
      if (token) return token;
    }
  } catch {
    return null;
  }
  return null;
};

const getRestAuthHeaders = async () => {
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  let accessToken: string | null = null;
  try {
    const sessionResult: any = await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    accessToken = sessionResult?.data?.session?.access_token || null;
  } catch {
    accessToken = null;
  }
  if (!accessToken) {
    accessToken = getAccessTokenFromStorageFallback();
  }
  const headers: Record<string, string> = {
    apikey: sbKey,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
};

const getSafeOAuthUrl = (rawUrl: string): string => {
  const normalized = String(rawUrl || '').trim();
  if (!normalized) {
    throw new Error('Google OAuth URL boş döndü');
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('Google OAuth URL geçersiz');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Google OAuth URL güvenli değil');
  }

  const currentSupabaseHost = (() => {
    try {
      return new URL(String(import.meta.env.VITE_SUPABASE_URL || '')).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  const host = parsed.hostname.toLowerCase();
  const allowedBySupabaseHost = currentSupabaseHost && host === currentSupabaseHost;
  const allowedByDefaultSupabase = host.endsWith('.supabase.co');
  const allowedByGoogle = host === 'accounts.google.com';

  if (!allowedBySupabaseHost && !allowedByDefaultSupabase && !allowedByGoogle) {
    throw new Error(`Google OAuth URL host izinli değil: ${host}`);
  }

  // Only allow OAuth authorization pages for Google login flow.
  if (allowedByDefaultSupabase && !parsed.pathname.includes('/auth/v1/authorize')) {
    throw new Error(`Beklenmeyen Supabase OAuth yolu: ${parsed.pathname}`);
  }

  const provider = parsed.searchParams.get('provider');
  if (provider && provider !== 'google') {
    throw new Error(`Beklenmeyen OAuth provider: ${provider}`);
  }

  return parsed.toString();
};

const normalizeBasePath = (base: string): string => {
  let normalized = String(base || '/').trim();
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (!normalized.endsWith('/')) normalized = `${normalized}/`;
  return normalized.replace(/\/{2,}/g, '/');
};

const detectLikelyAppBasePath = (): string => {
  const configured = normalizeBasePath(String(import.meta.env.BASE_URL || '/'));
  if (configured !== '/') return configured;
  const pathname = String(window.location.pathname || '/');
  if (pathname.startsWith('/esnaftaucuz/')) return '/esnaftaucuz/';
  if (pathname === '/esnaftaucuz') return '/esnaftaucuz/';
  return '/';
};

const buildWebOAuthRedirectCandidates = (merchantIntent: boolean): string[] => {
  const origin = String(window.location.origin || '').trim();
  const appBasePath = detectLikelyAppBasePath();
  const configured = String(import.meta.env.VITE_WEB_OAUTH_REDIRECT_URL || '').trim();
  const currentPath = String(window.location.pathname || '/');
  const candidates: string[] = [];
  const add = (value: string) => {
    const v = String(value || '').trim();
    if (!v) return;
    if (!candidates.includes(v)) candidates.push(v);
  };
  const withIntent = (raw: string) => {
    try {
      const u = new URL(raw);
      if (merchantIntent) u.searchParams.set('merchant_intent', '1');
      return u.toString();
    } catch {
      return raw;
    }
  };

  if (configured) add(withIntent(configured));
  add(withIntent(new URL(appBasePath, origin).toString()));
  add(withIntent(new URL(`${appBasePath}login`, origin).toString()));
  add(withIntent(new URL(currentPath || '/', origin).toString()));
  add(withIntent(new URL('/', origin).toString()));
  add(withIntent(new URL('/login', origin).toString()));

  return candidates;
};

// ============================================================================
// AUTH API - Using Supabase Auth
// ============================================================================

export const authAPI = {
  register: async (email: string, password: string, name: string, isMerchant: boolean = false) => {
    try {
      console.log('🔄 Starting registration process...', { email, name, isMerchant });
      
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (authError) {
        // Handle specific Supabase errors
        if (authError.message.includes('leaked') || authError.message.includes('compromised')) {
          throw new Error('Bu şifre güvenlik açığına uğramış. Lütfen daha güçlü bir şifre seçin.');
        }
        if (authError.message.includes('already registered')) {
          throw new Error('Bu email adresi zaten kayıtlı. Lütfen giriş yapın.');
        }
        throw authError;
      }
      if (!authData.user) throw new Error('User creation failed');
      
      console.log('✅ Auth user created:', { userId: authData.user.id, email: authData.user.email });
      console.log('🔑 Auth session:', { hasSession: !!authData.session, hasToken: !!authData.session?.access_token });

      // Note: signUp() may not return a session if email confirmation is required
      // We'll proceed with INSERT anyway - RLS policy will check auth.users table
      let session = authData.session;
      if (!session) {
        console.log('⚠️ No session from signUp (email confirmation may be required)');
        console.log('📝 Proceeding with INSERT - RLS policy will check auth.users table');
        // Don't try signIn - it will fail with "Email not confirmed"
        // RLS policy should allow INSERT if user exists in auth.users
      } else {
        console.log('✅ Session available from signUp');
      }

      // Wait a moment to ensure auth state is propagated (if session exists)
      if (session) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Create user profile in public.users
      // IMPORTANT: Do NOT include is_merchant in INSERT - always use UPDATE after insert
      // This avoids any potential RLS issues with the is_merchant column
      const userProfileData: any = {
        id: authData.user.id,
        email: authData.user.email!,
        name,
        search_radius: 15, // Default search radius (ensures constraint is satisfied)
        // DO NOT include is_merchant here - it will be set via UPDATE after successful insert
      };
      
      console.log('📝 Inserting user profile (without is_merchant):', userProfileData);
      console.log('🔍 Current auth.uid():', (await supabase.auth.getUser()).data.user?.id);
      
      // Use UPSERT instead of INSERT to handle duplicate key errors
      // This will insert if user doesn't exist, or update if they do
      let profileData: any = null;
      let profileError: any = null;
      
      const { data: upsertData, error: upsertError } = await supabase
        .from('users')
        .upsert(userProfileData, {
          onConflict: 'id',
          ignoreDuplicates: false, // Update if exists
        })
        .select()
        .single();

      if (upsertError) {
        console.error('❌ Profile upsert error:', upsertError);
        console.error('Error code:', upsertError.code);
        console.error('Error message:', upsertError.message);
        console.error('Error details:', upsertError.details);
        console.error('Error hint:', upsertError.hint);
        console.error('Full error object:', JSON.stringify(upsertError, null, 2));
        
        // Handle duplicate key error - user profile already exists
        if (upsertError.code === '23505' || upsertError.message?.includes('duplicate key') || upsertError.message?.includes('unique constraint')) {
          console.log('⚠️ User profile already exists, fetching existing profile...');
          // Try to fetch existing profile
          const { data: existingProfile, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();
          
          if (fetchError) {
            console.error('❌ Failed to fetch existing profile:', fetchError);
            throw new Error('Profil zaten mevcut ancak yüklenemedi. Lütfen giriş yapmayı deneyin.');
          }
          
          // Use existing profile; account type is immutable after first registration.
          if (existingProfile) {
            console.log('✅ Using existing profile');
            profileData = existingProfile;
            if (
              typeof existingProfile.is_merchant === 'boolean' &&
              existingProfile.is_merchant !== isMerchant
            ) {
              throw new Error(
                `Bu hesap ${existingProfile.is_merchant ? 'esnaf' : 'normal'} olarak kayitli. Hesap tipi degistirilemez.`
              );
            }
            // Skip error handling - we have the profile
          } else {
            profileError = upsertError;
          }
        } else {
          profileError = upsertError;
        }
      } else {
        profileData = upsertData;
      }

      // Handle errors (except duplicate key which we already handled)
      if (profileError) {
        if (profileError.code === '42501' || profileError.code === 'PGRST301') {
          throw new Error('Profil oluşturulamadı: Yetki hatası (RLS). Lütfen Supabase migration 017_final_working_rls.sql dosyasını çalıştırdığınızdan emin olun. Hata detayları: ' + (profileError.message || 'Bilinmeyen'));
        }
        // Check if error is related to is_merchant column
        if (profileError.message?.includes('is_merchant') || profileError.message?.includes('column')) {
          throw new Error('Profil oluşturulamadı: Veritabanı hatası. is_merchant kolonu ile ilgili bir sorun var. Lütfen Supabase migration\'larını çalıştırdığınızdan emin olun.');
        }
        throw new Error('Profil oluşturulamadı: ' + (profileError.message || 'Bilinmeyen hata') + ' (Kod: ' + (profileError.code || 'N/A') + ')');
      }
      
      // Keep account type stable once set; only set is_merchant if it's not defined yet.
      if (profileData) {
        const existingType = typeof profileData.is_merchant === 'boolean' ? profileData.is_merchant : null;
        if (existingType !== null && existingType !== isMerchant) {
          throw new Error(
            `Bu hesap ${existingType ? 'esnaf' : 'normal'} olarak kayitli. Hesap tipi degistirilemez.`
          );
        }

        if (existingType === null) {
          const initialAccountUpdate: Record<string, any> = {
            is_merchant: isMerchant,
          };
          if (isMerchant) {
            initialAccountUpdate.merchant_subscription_status = 'inactive';
            initialAccountUpdate.merchant_subscription_plan = 'merchant_basic_monthly';
            initialAccountUpdate.merchant_subscription_fee_tl = 900;
            initialAccountUpdate.merchant_subscription_current_period_start = null;
            initialAccountUpdate.merchant_subscription_current_period_end = null;
          }
          console.log('📝 Setting initial is_merchant to', isMerchant, 'for user:', profileData.id);
          const { error: updateError } = await supabase
            .from('users')
            .update(initialAccountUpdate)
            .eq('id', profileData.id);

          if (updateError) {
            console.warn('⚠️ Failed to set is_merchant, default type will be used:', updateError);
          } else {
            profileData.is_merchant = isMerchant;
            if (isMerchant) {
              profileData.merchant_subscription_status = initialAccountUpdate.merchant_subscription_status;
              profileData.merchant_subscription_plan = initialAccountUpdate.merchant_subscription_plan;
              profileData.merchant_subscription_fee_tl = initialAccountUpdate.merchant_subscription_fee_tl;
              profileData.merchant_subscription_current_period_start = initialAccountUpdate.merchant_subscription_current_period_start;
              profileData.merchant_subscription_current_period_end = initialAccountUpdate.merchant_subscription_current_period_end;
            }
            console.log('✅ Initial is_merchant set successfully to', isMerchant);
          }
        } else {
          profileData.is_merchant = existingType;
        }
      }

      // If no session from signUp, try to sign in to get session (for token storage)
      session = authData.session;
      if (!session) {
        console.log('⚠️ No session from signUp, attempting signIn...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          console.error('SignIn after signUp error:', signInError);
          // Continue anyway - session will be handled by onAuthStateChange
        } else {
          session = signInData.session;
          console.log('✅ Session obtained from signIn');
        }
      }

      // Store session in localStorage
      if (session?.access_token) {
        localStorage.setItem('authToken', session.access_token);
        console.log('✅ Token stored in localStorage');
      }

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(profileData));
      console.log('✅ User stored in localStorage');

      return {
        user: {
          id: profileData.id,
          email: profileData.email,
          name: profileData.name,
          avatar: profileData.avatar,
          level: profileData.level,
          points: profileData.points,
          contributions: profileData.contributions,
          is_merchant: resolveMerchantStatus(profileData),
        },
        token: session?.access_token || null,
        session: session,
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Kayıt başarısız');
    }
  },

  login: async (email: string, password: string) => {
    try {
      console.log('🔐 Starting email login...', { email });
      
      // Add timeout for iOS network issues
      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Giriş isteği zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.')), 30000)
      );
      
      const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ Login error:', error);
        // Handle specific Supabase errors
        if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid')) {
          throw new Error('Email veya şifre hatalı');
        }
        if (error.message?.includes('Email not confirmed')) {
          throw new Error('Email adresinizi doğrulamanız gerekiyor');
        }
        if (error.message?.includes('timeout') || error.message?.includes('network')) {
          throw new Error('İnternet bağlantısı hatası. Lütfen tekrar deneyin.');
        }
        throw new Error(error.message || 'Giriş başarısız');
      }
      if (!data?.user || !data?.session) {
        console.error('❌ Login failed: No user or session');
        throw new Error('Giriş başarısız - kullanıcı veya oturum oluşturulamadı');
      }
      
      console.log('✅ Login successful, fetching profile...');

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw new Error('Kullanıcı profili bulunamadı');
      }

      // Some legacy merchant accounts can have stale is_merchant=false while still
      // owning merchant product rows. Use an additional fallback to avoid normal UI.
      let hasMerchantProducts = false;
      try {
        const { data: merchantRows, error: merchantErr } = await supabase
          .from('merchant_products')
          .select('id')
          .eq('merchant_id', data.user.id)
          .limit(1);
        if (!merchantErr && Array.isArray(merchantRows) && merchantRows.length > 0) {
          hasMerchantProducts = true;
        }
      } catch {
        hasMerchantProducts = false;
      }

      const resolvedMerchant = resolveMerchantStatus(profile) || hasMerchantProducts;

      return {
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          level: profile.level,
          points: profile.points,
          contributions: profile.contributions,
          is_merchant: resolvedMerchant,
        },
        token: data.session.access_token,
        session: data.session,
      };
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Giriş başarısız');
    }
  },

  googleLogin: async (options?: { merchantSignupIntent?: boolean; loginHint?: string }) => {
    try {
      console.log('🔐 Starting Google OAuth...');
      console.log('📍 Current origin:', window.location.origin);
      console.log('📍 Current href:', window.location.href);
      try {
        localStorage.setItem('oauth-pending-ts', String(Date.now()));
      } catch {
        // best effort
      }
      const merchantIntentFromStorage = (() => {
        try {
          return localStorage.getItem('merchant-signup-intent') === '1';
        } catch {
          return false;
        }
      })();
      const merchantIntent = options?.merchantSignupIntent === true || merchantIntentFromStorage;
      const loginHint = (() => {
        const fromOptions = String(options?.loginHint || '').trim();
        if (fromOptions.includes('@')) return fromOptions;
        try {
          const fromLastHint = String(localStorage.getItem('last-google-login-hint') || '').trim();
          if (fromLastHint.includes('@')) return fromLastHint;
          const rawUser = localStorage.getItem('user');
          const parsed = rawUser ? JSON.parse(rawUser) : null;
          const fromUser = String(parsed?.email || '').trim();
          if (fromUser.includes('@')) return fromUser;
        } catch {
          // best effort
        }
        return '';
      })();
      
      // Detect if we're on mobile (Capacitor)
      const isMobile = typeof window !== 'undefined' && 
        (window as any).Capacitor?.isNativePlatform();
      
      // OAuth options
      const oauthOptions: any = {
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
          ...(loginHint ? { login_hint: loginHint } : {}),
        },
      };
      
      if (isMobile) {
        // Prevent Supabase from auto-redirecting current webview on native.
        oauthOptions.skipBrowserRedirect = true;
      } else {
        // On web, redirect back to current app base (root or GitHub Pages subpath).
        const appBasePath = detectLikelyAppBasePath();
        const redirectUrl = new URL(appBasePath, window.location.origin);
        if (merchantIntent) redirectUrl.searchParams.set('merchant_intent', '1');
        oauthOptions.redirectTo = redirectUrl.toString();
        console.log('🌐 Web detected, using redirectTo:', oauthOptions.redirectTo);
      }

      // Supabase handles the redirect URL generation.
      // On iOS, retry with a simpler scheme if callback path is rejected.
      let data: any = null;
      let error: any = null;

      if (isMobile) {
        const redirectCandidates = merchantIntent
          ? [
              'com.esnaftaucuz.app://auth/callback?merchant_intent=1',
              'com.esnaftaucuz.app://?merchant_intent=1',
              'com.esnaftaucuz.app://',
            ]
          : [
              'com.esnaftaucuz.app://auth/callback',
              'com.esnaftaucuz.app://',
            ];

        for (const redirectTo of redirectCandidates) {
          const { data: candidateData, error: candidateError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              ...oauthOptions,
              redirectTo,
            },
          });

          if (!candidateError) {
            data = candidateData;
            error = null;
            console.log('📱 Mobile detected, using custom URL scheme:', redirectTo);
            break;
          }

          error = candidateError;
          console.warn('⚠️ Google OAuth redirect candidate rejected:', {
            redirectTo,
            message: candidateError?.message,
          });
        }
      } else {
        const redirectCandidates = buildWebOAuthRedirectCandidates(merchantIntent);
        for (const redirectTo of redirectCandidates) {
          const result = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              ...oauthOptions,
              redirectTo,
            },
          });
          data = result.data;
          error = result.error;
          if (!error) {
            console.log('🌐 Web OAuth redirect candidate accepted:', redirectTo);
            break;
          }
          console.warn('⚠️ Web OAuth redirect candidate rejected:', {
            redirectTo,
            message: error?.message,
          });
        }
      }

      if (error) {
        console.error('❌ Google OAuth error:', error);
        throw error;
      }
      
      console.log('✅ Google OAuth redirect URL:', data.url);

      // On native mobile, open OAuth only with validated HTTPS URL.
      // The callback deep link is handled by App.tsx via appUrlOpen listener.
      if (isMobile && data.url) {
        const safeOAuthUrl = getSafeOAuthUrl(data.url);
        console.log('📱 Opening OAuth URL in Chrome Custom Tab:', safeOAuthUrl.substring(0, 80) + '...');
        await Browser.open({ url: safeOAuthUrl });
        return { redirectUrl: safeOAuthUrl, openedInBrowser: true };
      }

      // On web, redirect in the same window
      return { redirectUrl: data.url, openedInBrowser: false };
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error.message?.includes('redirect_uri_mismatch')) {
        throw new Error('Google OAuth redirect URL hatalı. Supabase Auth Redirect URLs ve Google Authorized redirect URI ayarlarını kontrol edin.');
      }
      throw new Error(error.message || 'Google ile giriş başarısız');
    }
  },

  guestLogin: async () => {
    try {
      // Create guest user profile (without auth.users entry)
      const guestId = uuidv4();
      
      const { data: guestUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: guestId,
          name: 'Misafir Kullanıcı',
          email: `guest_${Date.now()}@guest.com`,
          is_guest: true,
          search_radius: 15, // Default search radius (ensures constraint is satisfied: 1-1000)
        })
        .select()
        .single();

      if (createError) throw createError;
      if (!guestUser) throw new Error('Guest user creation failed');

      return {
        user: {
          id: guestUser.id,
          name: guestUser.name,
          email: guestUser.email,
          avatar: guestUser.avatar,
          level: guestUser.level,
          points: guestUser.points,
          contributions: guestUser.contributions,
          isGuest: true,
          is_merchant: false, // Guest users are never merchants
        },
        token: guestUser.id, // Use guest ID as token
        session: {
          access_token: guestUser.id,
          expires_in: 3600,
          token_type: 'Bearer',
          user: { id: guestUser.id, email: guestUser.email },
        },
      };
    } catch (error: any) {
      console.error('Guest login error:', error);
      throw new Error(error.message || 'Misafir girişi başarısız');
    }
  },

  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        // Check if it's a guest user (UUID token)
        const token = localStorage.getItem('authToken');
        if (token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
          const { data: guestUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', token)
            .eq('is_guest', true)
            .single();
          
          if (guestUser) {
            return { user: guestUser };
          }
        }
        throw error || new Error('User not found');
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      return { user: profile || user };
    } catch (error: any) {
      console.error('Get current user error:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
};

// ============================================================================
// PRODUCTS API - Using Supabase Database
// ============================================================================

export const productsAPI = {
  getAll: async (search?: string, category?: string) => {
    return cachedQuery(stableKey('products:getAll', { search, category }), 60000, async () => {
      try {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        if (sbUrl && sbKey) {
          try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 10000);
            const params = new URLSearchParams({
              select: 'id,name,category,image,is_active',
              is_active: 'eq.true',
              order: 'name.asc',
              limit: '2000',
            });
            if (search) params.set('name', `ilike.*${search}*`);
            if (category) params.set('category', `eq.${category}`);

            const resp = await fetch(`${sbUrl}/rest/v1/products?${params.toString()}`, {
              headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
              signal: controller.signal,
            });
            clearTimeout(tid);
            if (resp.ok) {
              const rows = await resp.json().catch(() => []);
              if (Array.isArray(rows)) return rows;
            }
          } catch {
            // Fallback to Supabase client path
          }
        }

        let query = supabase
          .from('products')
          .select('*')
          .eq('is_active', true);

        if (search) {
          query = query.ilike('name', `%${search}%`);
        }
        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query.order('name', { ascending: true });

        if (error) throw error;
        return data || [];
      } catch (error: any) {
        console.error('Get products error:', error);
        throw new Error(error.message || 'Ürünler yüklenemedi');
      }
    });
  },

  getTrending: async () => {
    return cachedQuery(stableKey('products:getTrending'), 20000, async () => {
      try {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        if (!sbUrl || !sbKey) return [];

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(
          `${sbUrl}/rest/v1/products?select=id,name,category,image&is_active=eq.true&order=search_count.desc&limit=6`,
          { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` }, signal: controller.signal }
        );
        clearTimeout(tid);
        if (!resp.ok) return [];
        return await resp.json().catch(() => []);
      } catch {
        return [];
      }
    });
  },

  getById: async (id: string) => {
    try {
      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (sbUrl && sbKey) {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(
          `${sbUrl}/rest/v1/products?select=*&id=eq.${id}&limit=1`,
          {
            headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, Accept: 'application/vnd.pgrst.object+json' },
            signal: controller.signal,
          }
        );
        clearTimeout(tid);
        if (resp.ok) {
          const product = await resp.json();
          if (product?.id) {
            fetch(`${sbUrl}/rest/v1/products?id=eq.${id}`, {
              method: 'PATCH',
              headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ search_count: (product.search_count || 0) + 1 }),
            }).catch(() => {});
            return product;
          }
        }
      }
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (productError) throw productError;
      if (!product) throw new Error('Product not found');
      return product;
    } catch (error: any) {
      console.error('Get product error:', error);
      throw new Error(error.message || 'Ürün bulunamadı');
    }
  },

  create: async (name: string, category?: string, defaultUnit?: string) => {
    try {
      console.log('Creating product:', { name, category, defaultUnit });
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: name.trim(),
          category: category || 'Diğer',
          default_unit: defaultUnit || 'adet',
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Product creation error:', error);
        throw new Error(`Ürün oluşturulamadı: ${error.message}`);
      }
      if (!data) {
        throw new Error('Ürün oluşturulamadı: Yeni ürün döndürülmedi');
      }
      console.log('Product created successfully:', data.id);
      return data;
    } catch (error: any) {
      console.error('Create product error:', error);
      throw new Error(error.message || 'Ürün oluşturulamadı');
    }
  },
};

// ============================================================================
// LOCATIONS API - Using Supabase Database
// ============================================================================

export const locationsAPI = {
  getAll: async (filters?: {
    type?: string;
    city?: string;
    district?: string;
    lat?: number;
    lng?: number;
    radius?: number;
  }) => {
    return cachedQuery(stableKey('locations:getAll', filters), 30000, async () => {
      try {
        let query = supabase.from('locations').select('*');

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.city) {
        query = query.eq('city', filters.city);
      }
      if (filters?.district) {
        query = query.eq('district', filters.district);
      }

      // Note: Geospatial filtering would require PostGIS functions
      // For now, we'll fetch all and filter client-side if needed
      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;

      // Client-side geospatial filtering if coordinates provided
      if (filters?.lat && filters?.lng && filters?.radius && data) {
        const radiusKm = filters.radius / 1000;
        return data.filter((loc: any) => {
          if (!loc.coordinates) return false;
          const coords = loc.coordinates;
          const lat = coords.lat || coords.y || 0;
          const lng = coords.lng || coords.x || 0;
          const distance = calculateDistance(filters.lat!, filters.lng!, lat, lng);
          return distance <= radiusKm;
        });
      }

        return data || [];
      } catch (error: any) {
        console.error('Get locations error:', error);
        throw new Error(error.message || 'Konumlar yüklenemedi');
      }
    });
  },

  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Location not found');
      return data;
    } catch (error: any) {
      console.error('Get location error:', error);
      throw new Error(error.message || 'Konum bulunamadı');
    }
  },

  create: async (data: {
    name: string;
    type: string;
    address?: string;
    lat: number;
    lng: number;
    city?: string;
    district?: string;
  }) => {
    try {
      const { data: location, error } = await supabase
        .from('locations')
        .insert({
          name: data.name,
          type: data.type,
          address: data.address,
          coordinates: `(${data.lng},${data.lat})`, // PostgreSQL POINT format
          city: data.city,
          district: data.district,
        })
        .select()
        .single();

      if (error) throw error;
      return location;
    } catch (error: any) {
      console.error('Create location error:', error);
      throw new Error(error.message || 'Konum oluşturulamadı');
    }
  },
};

// ============================================================================
// PRICES API - Using Supabase Database + Storage
// ============================================================================

export const pricesAPI = {
  getAll: async (filters?: {
    product?: string;
    location?: string;
    city?: string;
    district?: string;
    verified?: boolean;
    todayOnly?: boolean;
    withPhoto?: boolean;
    sort?: 'newest' | 'cheapest' | 'expensive' | 'verified';
    limit?: number;
    lat?: number;
    lng?: number;
    radius?: number;
  }) => {
    return cachedQuery(stableKey('prices:getAll', filters), 12000, async () => {
      try {
      // REST-first path: bypasses Supabase JS client entirely
      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (sbUrl && sbKey) {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 10000);
          const headers = { apikey: sbKey, Authorization: `Bearer ${sbKey}` };

          const params: string[] = [
            'select=id,product_id,location_id,user_id,price,unit,created_at,is_verified,photo,coordinates,is_active',
            'is_active=eq.true',
          ];
          if (filters?.product) params.push(`product_id=eq.${filters.product}`);
          if (filters?.location) params.push(`location_id=eq.${filters.location}`);
          if (filters?.verified) params.push('is_verified=eq.true');
          if (filters?.withPhoto) params.push('photo=not.is.null');
          if (filters?.todayOnly) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            params.push(`created_at=gte.${today.toISOString()}`);
          }
          const sortCol = filters?.sort === 'cheapest' ? 'price.asc' : filters?.sort === 'expensive' ? 'price.desc' : 'created_at.desc';
          params.push(`order=${sortCol}`);
          params.push(`limit=${filters?.limit || 50}`);

          const resp = await fetch(`${sbUrl}/rest/v1/prices?${params.join('&')}`, { headers, signal: controller.signal });
          clearTimeout(tid);
          if (resp.ok) {
            let rows: any[] = await resp.json().catch(() => []);
            if (Array.isArray(rows) && rows.length > 0) {
              const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
              const locationIds = [...new Set(rows.map((r: any) => r.location_id).filter(Boolean))];
              const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];

              const ctrl2 = new AbortController();
              const tid2 = setTimeout(() => ctrl2.abort(), 8000);
              const [pResp, lResp, uResp] = await Promise.all([
                productIds.length ? fetch(`${sbUrl}/rest/v1/products?select=id,name,category,default_unit,image&id=in.(${productIds.join(',')})`, { headers, signal: ctrl2.signal }) : null,
                locationIds.length ? fetch(`${sbUrl}/rest/v1/locations?select=id,name,type,address,coordinates,city,district&id=in.(${locationIds.join(',')})`, { headers, signal: ctrl2.signal }) : null,
                userIds.length ? fetch(`${sbUrl}/rest/v1/users?select=id,name,avatar,level&id=in.(${userIds.join(',')})`, { headers, signal: ctrl2.signal }) : null,
              ]);
              clearTimeout(tid2);

              const products: any[] = pResp?.ok ? await pResp.json().catch(() => []) : [];
              const locations: any[] = lResp?.ok ? await lResp.json().catch(() => []) : [];
              const users: any[] = uResp?.ok ? await uResp.json().catch(() => []) : [];

              const pMap = new Map(products.map((p: any) => [p.id, p]));
              const lMap = new Map(locations.map((l: any) => [l.id, l]));
              const uMap = new Map(users.map((u: any) => [u.id, u]));

              rows = rows.map((r: any) => ({
                ...r,
                product: pMap.get(r.product_id) || null,
                location: lMap.get(r.location_id) || null,
                user: uMap.get(r.user_id) || null,
              }));
            }
            return rows;
          }
        } catch {
          // Fall through to Supabase client path
        }
      }

      let query = supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .eq('is_active', true);

      if (filters?.product) {
        query = query.eq('product_id', filters.product);
      }
      if (filters?.location) {
        query = query.eq('location_id', filters.location);
      }
      if (filters?.verified) {
        query = query.eq('is_verified', filters.verified);
      }
      if (filters?.withPhoto) {
        query = query.not('photo', 'is', null);
      }
      if (filters?.todayOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('created_at', today.toISOString());
      }

      // Apply sorting
      switch (filters?.sort) {
        case 'cheapest':
          query = query.order('price', { ascending: true });
          break;
        case 'expensive':
          query = query.order('price', { ascending: false });
          break;
        case 'verified':
          query = query.order('is_verified', { ascending: false });
          query = query.order('verification_count', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(500); // Default limit
      }

      // Direct query (timeout handled by Supabase client's custom fetch)
      const { data, error } = await query;
      
      // Debug: Log raw data to see location structure
      if (data && data.length > 0) {
        console.log('🔍 Raw price data sample (first item):', JSON.stringify(data[0], null, 2));
        console.log('📍 Location in raw data:', data[0].location);
      }

      if (error) {
        console.error('❌ Supabase query error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.warn('⚠️ Falling back to join-less prices query');

        // Fallback: avoid relation joins (users/products/locations) in case one policy breaks the full select.
        let basicQuery = supabase
          .from('prices')
          .select('id, user_id, product_id, location_id, price, unit, created_at, is_verified, photo, coordinates, is_active')
          .order(filters?.sort === 'cheapest' ? 'price' : 'created_at', { ascending: filters?.sort === 'cheapest' })
          .limit(filters?.limit || 500);

        // Keep core constraints compatible with previous behavior.
        basicQuery = basicQuery.eq('is_active', true);
        if (filters?.product) basicQuery = basicQuery.eq('product_id', filters.product);
        if (filters?.location) basicQuery = basicQuery.eq('location_id', filters.location);
        if (filters?.verified) basicQuery = basicQuery.eq('is_verified', true);
        if (filters?.withPhoto) basicQuery = basicQuery.not('photo', 'is', null);
        if (filters?.todayOnly) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          basicQuery = basicQuery.gte('created_at', today.toISOString());
        }

        const { data: basicRows, error: basicError } = await basicQuery;
        if (basicError) {
          console.error('❌ Join-less prices fallback failed:', basicError);
          return [];
        }

        const rows = basicRows || [];
        const productIds = Array.from(new Set(rows.map((r: any) => r.product_id).filter(Boolean)));
        const locationIds = Array.from(new Set(rows.map((r: any) => r.location_id).filter(Boolean)));

        const [{ data: productsRows }, { data: locationsRows }] = await Promise.all([
          productIds.length
            ? supabase.from('products').select('id, name, category, default_unit, image').in('id', productIds)
            : Promise.resolve({ data: [] as any[] }),
          locationIds.length
            ? supabase.from('locations').select('id, name, type, address, coordinates, city, district').in('id', locationIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const productsById = new Map((productsRows || []).map((p: any) => [p.id, p]));
        const locationsById = new Map((locationsRows || []).map((l: any) => [l.id, l]));

        const hydratedFallback = rows.map((row: any) => ({
          ...row,
          product: row.product_id ? productsById.get(row.product_id) || null : null,
          location: row.location_id ? locationsById.get(row.location_id) || null : null,
        }));

        console.log(`✅ Join-less prices fallback succeeded: ${hydratedFallback.length} rows`);
        return hydratedFallback;
      }

      let hydratedData = data || [];

      // Some rows can come with null nested relations; hydrate from foreign keys.
      const missingProductRows = hydratedData.filter((price: any) => !price?.product && price?.product_id);
      if (missingProductRows.length > 0) {
        const productIds = Array.from(
          new Set(
            missingProductRows
              .map((price: any) => price.product_id)
              .filter((id: any) => typeof id === 'string' && id.length > 0)
          )
        );
        if (productIds.length > 0) {
          const { data: productsByIdRows } = await supabase
            .from('products')
            .select('id, name, category, default_unit, image')
            .in('id', productIds);

          const productsById = new Map((productsByIdRows || []).map((p: any) => [p.id, p]));
          hydratedData = hydratedData.map((price: any) => {
            if (price?.product || !price?.product_id) return price;
            const product = productsById.get(price.product_id);
            return product ? { ...price, product } : price;
          });
        }
      }

      // Normalize coordinates for frontend consumption
      const normalizedData = hydratedData.map((price: any) => {
        let latVal: number | undefined;
        let lngVal: number | undefined;

        // First check if price has direct coordinates
        if (price.coordinates) {
          const coords = price.coordinates;
          if (typeof coords === 'string') {
            // PostgreSQL POINT string format: (lng,lat)
            const match = coords.match(/\(([^,]+),([^)]+)\)/);
            if (match) {
              lngVal = parseFloat(match[1]);
              latVal = parseFloat(match[2]);
            }
          } else if (typeof coords === 'object') {
            if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              latVal = coords.lat;
              lngVal = coords.lng;
            } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
              latVal = coords.y; // PostgreSQL POINT stores as (lng, lat)
              lngVal = coords.x;
            }
          }
        }

        // Then check location coordinates
        if ((!latVal || !lngVal) && price.location?.coordinates) {
          const coords = price.location.coordinates;
          if (typeof coords === 'string') {
            // PostgreSQL POINT string format: (lng,lat)
            const match = coords.match(/\(([^,]+),([^)]+)\)/);
            if (match) {
              lngVal = parseFloat(match[1]);
              latVal = parseFloat(match[2]);
            }
          } else if (typeof coords === 'object') {
            if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              latVal = coords.lat;
              lngVal = coords.lng;
            } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
              latVal = coords.y; // PostgreSQL POINT stores as (lng, lat)
              lngVal = coords.x;
            }
          }
        }

        // Add normalized coordinates to price object
        if (typeof latVal === 'number' && typeof lngVal === 'number' && !isNaN(latVal) && !isNaN(lngVal)) {
          return { ...price, lat: latVal, lng: lngVal };
        }
        return price;
      });

      console.log(`📍 Normalized ${normalizedData.filter((p: any) => p.lat && p.lng).length} prices with coordinates`);

      // Client-side geospatial filtering if coordinates provided
      let filteredData = normalizedData;
      if (filters?.lat && filters?.lng && filters?.radius) {
        const radiusKm = filters.radius / 1000;
        filteredData = filteredData.filter((price: any) => {
          // Use normalized lat/lng if available
          if (price.lat && price.lng) {
            const distance = calculateDistance(filters.lat!, filters.lng!, price.lat, price.lng);
            return distance <= radiusKm;
          }
          return false;
        });
      }

      console.log('✅ Prices fetched:', filteredData?.length || 0);
      
      // Debug: Log location data for first few prices
      if (filteredData.length > 0) {
        console.log('📍 Sample price location data:', filteredData.slice(0, 3).map((p: any) => ({
          id: p.id,
          location: p.location,
          locationName: p.location?.name,
          locationId: p.location?.id,
          hasLocation: !!p.location,
        })));
      }
      
        return filteredData;
      } catch (error: any) {
        console.error('❌ Get prices error:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        // Return empty array instead of throwing to prevent app from hanging
        return [];
      }
    });
  },

  getByProduct: async (productId: string, sort: 'newest' | 'cheapest' | 'expensive' | 'verified' = 'cheapest') => {
    return pricesAPI.getAll({ product: productId, sort });
  },

  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Price not found');
      return data;
    } catch (error: any) {
      console.error('Get price error:', error);
      throw new Error(error.message || 'Fiyat bulunamadı');
    }
  },

  create: async (data: {
    product: string;
    productName?: string;
    price: number;
    unit: string;
    location: string;
    locationName?: string;
    userId?: string;
    accessToken?: string;
    lat?: number;
    lng?: number;
    photo?: File;
  }) => {
    // Add overall timeout for the entire operation
    const overallTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.')), 70000); // 70 second timeout
    });

    const createOperation = async () => {
      try {
        console.log('🚀 Starting price creation...');
        const isUUIDValue = (value: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

        // Fast path: selected product+location IDs, no photo upload.
        if (isUUIDValue(data.product) && isUUIDValue(data.location) && !data.photo) {
          const extractAccessTokenFromUnknownShape = (value: any): string | null => {
            try {
              if (!value) return null;
              if (typeof value === 'string') {
                try {
                  const parsed = JSON.parse(value);
                  return extractAccessTokenFromUnknownShape(parsed);
                } catch {
                  return null;
                }
              }
              if (Array.isArray(value)) {
                for (const item of value) {
                  const token = extractAccessTokenFromUnknownShape(item);
                  if (token) return token;
                }
                return null;
              }
              if (typeof value === 'object') {
                if (typeof (value as any).access_token === 'string') {
                  return (value as any).access_token;
                }
                if (typeof (value as any).currentSession?.access_token === 'string') {
                  return (value as any).currentSession.access_token;
                }
                for (const v of Object.values(value)) {
                  const token = extractAccessTokenFromUnknownShape(v);
                  if (token) return token;
                }
              }
              return null;
            } catch {
              return null;
            }
          };

          const resolveAccessTokenQuick = async (): Promise<string | null> => {
            const direct = data.accessToken || localStorage.getItem('authToken');
            if (direct) return direct;

            // Supabase JS stores session under sb-...-auth-token; scan quickly.
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i) || '';
                if (!key.includes('auth-token') && !key.startsWith('sb-')) continue;
                const raw = localStorage.getItem(key);
                const token = extractAccessTokenFromUnknownShape(raw);
                if (token) return token;
              }
            } catch {
              // ignore
            }

            // Last quick fallback: ask supabase session with strict timeout.
            try {
              const sessionResult = await Promise.race([
                supabase.auth.getSession(),
                new Promise<any>((resolve) => setTimeout(() => resolve(null), 1500)),
              ]);
              const token = (sessionResult as any)?.data?.session?.access_token;
              return token || null;
            } catch {
              return null;
            }
          };

          const extractUserIdFromJwt = (token: string | null): string | null => {
            if (!token || !token.includes('.')) return null;
            try {
              const payload = token.split('.')[1];
              const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
              const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
              const parsed = JSON.parse(decoded);
              return typeof parsed?.sub === 'string' ? parsed.sub : null;
            } catch {
              return null;
            }
          };

          const fastPriceData: any = {
            product_id: data.product,
            location_id: data.location,
            price: data.price,
            unit: data.unit,
            is_active: true,
          };
          if (data.lat && data.lng) {
            fastPriceData.coordinates = `(${data.lng},${data.lat})`;
          }

          let fastRecord: any = null;
          const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
          const authToken = await resolveAccessTokenQuick();
          const jwtUserId = extractUserIdFromJwt(authToken);
          const fastUserId =
            jwtUserId ||
            data.userId ||
            (() => {
              try {
                return JSON.parse(localStorage.getItem('user') || '{}')?.id;
              } catch {
                return undefined;
              }
            })();

          if (!fastUserId) {
            throw new Error('Giris yapmaniz gerekiyor');
          }
          fastPriceData.user_id = fastUserId;

          // Try direct REST insert first to bypass supabase-js auth/session delays.
          if (sbUrl && sbKey && authToken) {
            try {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 8000);
              const response = await fetch(`${sbUrl}/rest/v1/prices`, {
                method: 'POST',
                headers: {
                  apikey: sbKey,
                  Authorization: `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                  Prefer: 'return=representation',
                },
                body: JSON.stringify(fastPriceData),
                signal: controller.signal,
              });
              clearTimeout(timer);
              if (response.ok) {
                const rows = await response.json().catch(() => []);
                fastRecord = Array.isArray(rows) ? rows[0] : null;
              }
            } catch (restError) {
              console.warn('Fast path REST insert failed, falling back:', restError);
            }
          }

          // Fallback: supabase-js insert
          if (!fastRecord) {
            const { data: fallbackRecord, error: fallbackError } = await supabase
              .from('prices')
              .insert(fastPriceData)
              .select(`
                *,
                product:products(id, name, category, default_unit, image),
                location:locations(id, name, type, address, coordinates, city, district),
                user:users(id, name, avatar, level)
              `)
              .single();
            if (fallbackError) throw fallbackError;
            fastRecord = fallbackRecord;
          }

          if (!fastRecord) throw new Error('Fiyat kaydi olusturulamadi');

          // REST fast-path can return row without nested relations.
          // Hydrate once so Contributions/other UI can render product/location names.
          try {
            const hydratePromise = supabase
              .from('prices')
              .select(`
                *,
                product:products(id, name, category, default_unit, image),
                location:locations(id, name, type, address, coordinates, city, district),
                user:users(id, name, avatar, level)
              `)
              .eq('id', fastRecord.id)
              .maybeSingle();

            const hydrateResult = await Promise.race([
              hydratePromise,
              new Promise<any>((resolve) => setTimeout(() => resolve(null), 2500)),
            ]);

            const hydrated = hydrateResult?.data;
            if (hydrated) {
              fastRecord = hydrated;
            }
          } catch (hydrateError) {
            console.warn('⚠️ Fast-path hydrate skipped:', hydrateError);
          }

          // Final safety: preserve selected labels when relations are missing.
          if ((!fastRecord?.product || !fastRecord?.product?.name) && data.productName) {
            fastRecord.product = {
              id: fastRecord?.product_id || data.product,
              name: data.productName,
            };
          }
          if ((!fastRecord?.location || !fastRecord?.location?.name) && data.locationName) {
            fastRecord.location = {
              id: fastRecord?.location_id || data.location,
              name: data.locationName,
            };
          }

          // Non-blocking post-actions; do not delay submit UX.
          supabase.functions.invoke('notify-price-drop', {
            body: { price_id: fastRecord.id },
          }).catch(() => {});

          // Keep "Katkılarım" reliable for the fast-path as well.
          try {
            const cacheKey = `contributions-cache:${fastUserId}`;
            const globalCacheKey = 'contributions-cache:last';
            const cachedRaw = localStorage.getItem(cacheKey);
            const cachedList = (() => {
              if (!cachedRaw) return [];
              try {
                const parsed = JSON.parse(cachedRaw);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })();
            const nextList = [fastRecord, ...cachedList.filter((item: any) => item?.id !== fastRecord.id)].slice(0, 50);
            localStorage.setItem(cacheKey, JSON.stringify(nextList));
            localStorage.setItem(globalCacheKey, JSON.stringify(nextList));
          } catch (cacheError) {
            console.warn('⚠️ Could not update contributions cache in fast-path:', cacheError);
          }

          return fastRecord;
        }

        const resolveAuthenticatedUser = async () => {
          // Primary path: validate token with server.
          const { data: getUserData, error: getUserError } = await supabase.auth.getUser();
          if (!getUserError && getUserData?.user) {
            return getUserData.user;
          }

          if (getUserError) {
            console.warn('⚠️ getUser failed, trying session fallback:', getUserError.message);
          }

          // Fallback path for native resume edge-cases:
          // use locally persisted session user if available.
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            return sessionData.session.user;
          }

          return null;
        };
        
        // Get current user - ALWAYS use auth.getUser() for authenticated users
        console.log('👤 Getting user...');
        const authUser = await resolveAuthenticatedUser();
        if (!authUser) {
          console.error('❌ No authenticated user');
          throw new Error('Giriş yapmanız gerekiyor');
        }
        
        let userId = authUser.id;
        console.log('✅ Authenticated user found:', userId);

      // Find or create product
      console.log('🔍 Finding or creating product...');
      // data.product can be either an ID (UUID) or a product name
      let productId = data.product;
      
      // Check if it's a UUID (ID format)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.product);
      console.log('Product is UUID:', isUUID, 'Value:', data.product);
      
      let existingProduct = null;
      if (isUUID) {
        // Search by ID
        console.log('Searching product by ID...');
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id')
          .eq('id', data.product)
          .maybeSingle();
        if (productError) {
          console.error('Product search error:', productError);
        }
        existingProduct = product;
      } else {
        // Search by name (case-insensitive)
        console.log('Searching product by name...');
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id')
          .ilike('name', data.product.trim())
          .maybeSingle();
        if (productError) {
          console.error('Product search error:', productError);
        }
        existingProduct = product;
      }

      if (!existingProduct) {
        console.log('Creating new product:', data.product);
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            name: data.product.trim(),
            default_unit: data.unit,
            is_active: true,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Product creation error:', createError);
          throw new Error(`Ürün oluşturulamadı: ${createError.message}`);
        }
        if (!newProduct) {
          throw new Error('Ürün oluşturulamadı: Yeni ürün döndürülmedi');
        }
        productId = newProduct.id;
        console.log('Product created with ID:', productId);
      } else {
        productId = existingProduct.id;
        console.log('Using existing product ID:', productId);
      }

      // Find or create location
      console.log('🔍 Finding or creating location...');
      // data.location can be either an ID (UUID) or a location name
      let locationId = data.location;
      
      // Check if it's a UUID (ID format)
      const isLocationUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.location);
      console.log('Location is UUID:', isLocationUUID, 'Value:', data.location);
      
      let existingLocation = null;
      if (isLocationUUID) {
        // Search by ID
        console.log('Searching location by ID...');
        const { data: location, error: locationError } = await supabase
          .from('locations')
          .select('id')
          .eq('id', data.location)
          .maybeSingle();
        if (locationError) {
          console.error('Location search error:', locationError);
        }
        existingLocation = location;
      } else {
        // Search by name (case-insensitive)
        console.log('Searching location by name...');
        const { data: location, error: locationError } = await supabase
          .from('locations')
          .select('id')
          .ilike('name', data.location.trim())
          .maybeSingle();
        if (locationError) {
          console.error('Location search error:', locationError);
        }
        existingLocation = location;
      }

      if (!existingLocation) {
        console.log('Creating new location:', data.location);
        const defaultLat = data.lat || 37.8667;
        const defaultLng = data.lng || 32.4833;
        
        const { data: newLocation, error: createError } = await supabase
          .from('locations')
          .insert({
            name: data.location.trim(),
            type: 'diğer',
            coordinates: `(${defaultLng},${defaultLat})`,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Location creation error:', createError);
          throw new Error(`Konum oluşturulamadı: ${createError.message}`);
        }
        if (!newLocation) {
          throw new Error('Konum oluşturulamadı: Yeni konum döndürülmedi');
        }
        locationId = newLocation.id;
        console.log('Location created with ID:', locationId);
      } else {
        locationId = existingLocation.id;
        console.log('Using existing location ID:', locationId);
      }

      // Upload photo to Supabase Storage if provided
      let photoUrl: string | null = null;
      let photoUploadError: string | null = null;
      
      if (data.photo) {
        try {
          console.log('📸 Uploading photo to Supabase Storage...', {
            fileName: data.photo.name,
            fileSize: data.photo.size,
            fileType: data.photo.type,
          });
          
          const fileExt = data.photo.name.split('.').pop() || 'jpg';
          const fileName = `${userId}/${uuidv4()}.${fileExt}`;
          
          console.log('📤 Uploading to:', fileName);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('price-photos')
            .upload(fileName, data.photo, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('❌ Photo upload error:', uploadError);
            console.error('Upload error details:', {
              message: uploadError.message,
              statusCode: uploadError.statusCode,
              error: uploadError.error,
            });
            // Store error message but continue with price creation
            photoUploadError = uploadError.message || 'Bilinmeyen hata';
            console.warn('⚠️ Continuing without photo due to upload error');
          } else {
            console.log('✅ Photo uploaded to storage:', uploadData);
            console.log('📁 Uploaded file path:', uploadData.path);
            
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('price-photos')
              .getPublicUrl(uploadData.path);
            
            photoUrl = urlData.publicUrl;
            console.log('✅ Photo URL generated:', photoUrl);
            console.log('🔗 Full photo URL:', photoUrl);
            
            // Verify URL is valid
            if (!photoUrl || photoUrl.includes('undefined') || photoUrl.includes('null')) {
              console.error('❌ Invalid photo URL generated:', photoUrl);
              photoUploadError = 'Fotoğraf URL\'i oluşturulamadı';
            }
          }
        } catch (photoError: any) {
          console.error('❌ Photo upload exception:', photoError);
          // Store error message but continue with price creation
          photoUploadError = photoError.message || 'Bilinmeyen hata';
          console.warn('⚠️ Continuing without photo due to exception');
        }
      } else {
        console.log('ℹ️ No photo provided, skipping photo upload');
      }

      // Verify user_id matches auth.uid() for RLS policy
      const currentAuthUser = await resolveAuthenticatedUser();
      if (!currentAuthUser) {
        console.error('❌ No authenticated user found');
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }
      
      // Always use current auth user ID
      userId = currentAuthUser.id;
      console.log('✅ Using authenticated user ID:', userId);
      
      if (currentAuthUser.id !== userId) {
        console.warn('⚠️ User ID mismatch - using auth user ID instead');
        userId = currentAuthUser.id;
      }

      // Create price
      const priceData: any = {
        product_id: productId,
        price: data.price,
        unit: data.unit,
        location_id: locationId,
        user_id: userId,
        photo: photoUrl,
        is_active: true, // Ensure is_active is set
      };

      if (data.lat && data.lng) {
        priceData.coordinates = `(${data.lng},${data.lat})`;
      }

      console.log('📝 Creating price with data:', {
        product_id: priceData.product_id,
        location_id: priceData.location_id,
        user_id: priceData.user_id,
        auth_uid: currentAuthUser?.id,
        user_id_match: currentAuthUser?.id === priceData.user_id,
        price: priceData.price,
        hasPhoto: !!priceData.photo,
        photoUrl: priceData.photo || 'null',
        hasCoordinates: !!(priceData.coordinates),
      });

      // Double-check auth.uid() before insert
      if (!currentAuthUser) {
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }
      
      if (currentAuthUser.id !== priceData.user_id) {
        console.warn('⚠️ User ID mismatch - correcting user_id');
        priceData.user_id = currentAuthUser.id;
      }

      console.log('💾 Inserting price into database...');
      const { data: priceRecord, error: priceError } = await supabase
        .from('prices')
        .insert(priceData)
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .single();
      
      if (priceRecord) {
        console.log('✅ Price record created:', {
          id: priceRecord.id,
          photo: priceRecord.photo || 'null',
          hasPhoto: !!priceRecord.photo,
        });
      }

      if (priceError) {
        console.error('❌ Price creation error:', priceError);
        console.error('❌ Error code:', priceError.code);
        console.error('❌ Error message:', priceError.message);
        console.error('❌ Error details:', priceError.details);
        console.error('❌ Error hint:', priceError.hint);
        console.error('❌ Price data:', priceData);
        console.error('❌ Current auth user:', currentAuthUser?.id);
        console.error('❌ User ID in price data:', priceData.user_id);
        console.error('❌ User ID match:', currentAuthUser?.id === priceData.user_id);
        
        // Provide more helpful error message
        let errorMessage = 'Fiyat oluşturulamadı';
        if (priceError.code === '42501' || priceError.message?.includes('permission denied') || priceError.message?.includes('row-level security')) {
          errorMessage = 'Yetki hatası: Fiyat ekleme yetkiniz yok. Lütfen tekrar giriş yapın.';
        } else if (priceError.message) {
          errorMessage = `Fiyat oluşturulamadı: ${priceError.message}`;
        }
        
        throw new Error(errorMessage);
      }
      
      if (!priceRecord) {
        throw new Error('Fiyat oluşturulamadı: Yeni fiyat döndürülmedi');
      }

      // Final safety for non-fast path as well.
      if ((!priceRecord?.product || !priceRecord?.product?.name) && data.productName) {
        (priceRecord as any).product = {
          id: (priceRecord as any)?.product_id || data.product,
          name: data.productName,
        };
      }
      if ((!priceRecord?.location || !priceRecord?.location?.name) && data.locationName) {
        (priceRecord as any).location = {
          id: (priceRecord as any)?.location_id || data.location,
          name: data.locationName,
        };
      }
      
      console.log('Price created successfully:', priceRecord.id);

      // Server-side fallback dispatcher:
      // re-computes price-drop recipients and dispatches remote push even if DB webhook chain lags.
      try {
        await supabase.functions.invoke('notify-price-drop', {
          body: { price_id: priceRecord.id },
        });
      } catch (notifyError) {
        console.warn('⚠️ notify-price-drop invoke failed (non-blocking):', notifyError);
      }

      // Update user points
      const { data: userProfile } = await supabase
        .from('users')
        .select('points, contributions')
        .eq('id', userId)
        .single();

      if (userProfile) {
        const newPoints = (userProfile.points || 0) + 10;
        const contributions = userProfile.contributions || { shares: 0, verifications: 0 };
        
        await supabase
          .from('users')
          .update({
            points: newPoints,
            contributions: {
              ...contributions,
              shares: (contributions.shares || 0) + 1,
            },
          })
          .eq('id', userId);
      }

        // Keep "Katkılarım" usable even when network/profile queries are flaky.
        try {
          const cacheKey = `contributions-cache:${userId}`;
          const globalCacheKey = 'contributions-cache:last';
          const cachedRaw = localStorage.getItem(cacheKey);
          const cachedList = (() => {
            if (!cachedRaw) return [];
            try {
              const parsed = JSON.parse(cachedRaw);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })();
          const nextList = [priceRecord, ...cachedList.filter((item: any) => item?.id !== priceRecord.id)].slice(0, 50);
          localStorage.setItem(cacheKey, JSON.stringify(nextList));
          localStorage.setItem(globalCacheKey, JSON.stringify(nextList));
        } catch (cacheError) {
          console.warn('⚠️ Could not update contributions cache after create:', cacheError);
        }

        console.log('✅ Price creation completed successfully');
        
        // Return price record with photo upload error info if any
        return {
          ...priceRecord,
          photoUploadError: photoUploadError || undefined,
        };
      } catch (error: any) {
        console.error('❌ Create price error:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Fiyat oluşturulamadı');
      }
    };

    // Race between operation and timeout
    return Promise.race([createOperation(), overallTimeout]) as Promise<any>;
  },

  verify: async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const token = localStorage.getItem('authToken');
      
      if (!user && !token) {
        throw new Error('Giriş yapmanız gerekiyor');
      }

      // Get current price to increment verification_count
      const { data: currentPrice, error: fetchError } = await supabase
        .from('prices')
        .select('verification_count')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching current price:', fetchError);
        throw fetchError;
      }

      // Update the price
      const { error: updateError } = await supabase
        .from('prices')
        .update({
          is_verified: true,
          verification_count: (currentPrice?.verification_count || 0) + 1,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating price:', updateError);
        throw updateError;
      }

      // Fetch the updated price with all relations
      const { data: price, error: selectError } = await supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .eq('id', id)
        .maybeSingle();

      if (selectError) {
        console.error('Error fetching updated price:', selectError);
        throw selectError;
      }

      if (!price) {
        throw new Error('Fiyat bulunamadı');
      }

      return { message: 'Fiyat doğrulandı', price };
    } catch (error: any) {
      console.error('Verify price error:', error);
      throw new Error(error.message || 'Fiyat doğrulanamadı');
    }
  },

  report: async (id: string) => {
    try {
      // Get current price to increment report_count
      const { data: currentPrice } = await supabase
        .from('prices')
        .select('report_count')
        .eq('id', id)
        .single();

      // Increment report count
      const { data, error } = await supabase
        .from('prices')
        .update({
          report_count: (currentPrice?.report_count || 0) + 1,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { message: 'Fiyat raporlandı' };
    } catch (error: any) {
      console.error('Report price error:', error);
      throw new Error(error.message || 'Fiyat raporlanamadı');
    }
  },
};

// ============================================================================
// USERS API - Using Supabase Database
// ============================================================================

export const usersAPI = {
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('User not found');
      return data;
    } catch (error: any) {
      console.error('Get user error:', error);
      throw new Error(error.message || 'Kullanıcı bulunamadı');
    }
  },

  getContributions: async (id: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUserId = authData?.user?.id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const authToken = localStorage.getItem('authToken');
      const tokenUserId = authToken;
      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const candidateUserIds = Array.from(
        new Set(
          [authUserId, id, tokenUserId]
            .filter((v): v is string => typeof v === 'string' && v.length > 0 && uuidRegex.test(v))
        )
      );

      const fetchForUserId = async (userId: string) => {
        const { data, error } = await supabase
          .from('prices')
          .select(`
            *,
            product:products(id, name, category, default_unit, image),
            location:locations(id, name, type, address, coordinates, city, district)
          `)
          .eq('user_id', userId)
          .or('is_active.eq.true,is_active.is.null')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error) return data || [];

        // Fallback: if relational select fails, fetch lightweight rows first
        // and enrich with batched product/location queries.
        console.warn('Primary contributions query failed, trying fallback:', { userId, error });

        const { data: rawPrices, error: rawError } = await supabase
          .from('prices')
          .select('id, price, unit, photo, created_at, is_verified, product_id, location_id')
          .eq('user_id', userId)
          .or('is_active.eq.true,is_active.is.null')
          .order('created_at', { ascending: false })
          .limit(50);

        if (rawError) {
          console.error('Fallback contributions query failed:', { userId, rawError });
          return [];
        }

        const prices = rawPrices || [];
        const productIds = Array.from(new Set(prices.map((p: any) => p.product_id).filter(Boolean)));
        const locationIds = Array.from(new Set(prices.map((p: any) => p.location_id).filter(Boolean)));

        const [productsRes, locationsRes] = await Promise.all([
          productIds.length
            ? supabase
                .from('products')
                .select('id, name, category, image, default_unit')
                .in('id', productIds)
            : Promise.resolve({ data: [], error: null } as any),
          locationIds.length
            ? supabase
                .from('locations')
                .select('id, name, type, city, district')
                .in('id', locationIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        const productsMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]));
        const locationsMap = new Map((locationsRes.data || []).map((l: any) => [l.id, l]));

        return prices.map((p: any) => ({
          ...p,
          product: p.product_id ? productsMap.get(p.product_id) || undefined : undefined,
          location: p.location_id ? locationsMap.get(p.location_id) || undefined : undefined,
        }));
      };

      const fetchViaRest = async (userId: string) => {
        if (!authToken || !authToken.includes('.') || !sbUrl || !sbKey) return [];
        try {
          const params = new URLSearchParams({
            select: 'id,price,unit,photo,created_at,is_verified,product:products(id,name,category,default_unit,image),location:locations(id,name,type,address,coordinates,city,district)',
            user_id: `eq.${userId}`,
            or: '(is_active.eq.true,is_active.is.null)',
            order: 'created_at.desc',
            limit: '50',
          });

          const response = await fetch(`${sbUrl}/rest/v1/prices?${params.toString()}`, {
            headers: {
              apikey: sbKey,
              Authorization: `Bearer ${authToken}`,
            },
          });
          if (!response.ok) return [];

          const rows = await response.json().catch(() => []);
          return Array.isArray(rows) ? rows : [];
        } catch {
          return [];
        }
      };

      for (const userId of candidateUserIds) {
        const rows = await fetchForUserId(userId);
        if (rows.length > 0) return rows;
      }

      // Final fallback: direct REST query with current auth token.
      for (const userId of candidateUserIds) {
        const rows = await fetchViaRest(userId);
        if (rows.length > 0) return rows;
      }

      return [];
    } catch (error: any) {
      console.error('Get contributions error:', error);
      // Do not block screen on transient network errors.
      return [];
    }
  },

  update: async (id: string, data: {
    name?: string;
    location?: {
      city?: string;
      district?: string;
      coordinates?: { lat: number; lng: number };
    };
    preferences?: {
      notifications?: boolean;
      searchRadius?: number; // in kilometers
    };
  }) => {
    try {
      // First, get current user data to merge preferences
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching current user:', fetchError);
        // Continue anyway - might be first time setting preferences
      }

      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      
      if (data.preferences) {
        // Merge with existing preferences to avoid overwriting other settings
        const existingPreferences = currentUser?.preferences || {};
        updateData.preferences = {
          ...existingPreferences,
          ...data.preferences,
        };
        
        // Also store searchRadius at root level for easier access
        if (data.preferences.searchRadius !== undefined) {
          // Validate searchRadius is within allowed range (1-1000 km)
          const searchRadius = data.preferences.searchRadius;
          if (typeof searchRadius === 'number' && searchRadius >= 1 && searchRadius <= 1000) {
            updateData.search_radius = Math.round(searchRadius); // Ensure integer
          } else {
            console.error('❌ Invalid searchRadius value:', searchRadius);
            throw new Error(`Geçersiz arama genişliği değeri: ${searchRadius}. Değer 1-1000 km arasında olmalıdır.`);
          }
        }
      }
      
      if (data.location) {
        if (data.location.city) updateData.city = data.location.city;
        if (data.location.district) updateData.district = data.location.district;
        if (data.location.coordinates) {
          updateData.coordinates = `(${data.location.coordinates.lng},${data.location.coordinates.lat})`;
        }
      }

      console.log('📝 Updating user:', { id, updateData });

      const { data: updated, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase update error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      
      console.log('✅ User updated successfully:', updated);
      return updated;
    } catch (error: any) {
      console.error('❌ Update user error:', error);
      throw new Error(error.message || 'Kullanıcı güncellenemedi');
    }
  },

  deleteAccount: async (id: string) => {
    try {
      console.log('🗑️ Starting account deletion for user:', id);
      
      // Step 1: Delete user-related data (cascade should handle most, but we'll be explicit)
      // Delete favorites
      const { error: favoritesError } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', id);
      
      if (favoritesError) {
        console.error('Error deleting favorites:', favoritesError);
        // Continue - might not exist
      }

      // Delete notifications
      const { error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', id);
      
      if (notificationsError) {
        console.error('Error deleting notifications:', notificationsError);
        // Continue - might not exist
      }

      // Delete prices (user contributions)
      const { error: pricesError } = await supabase
        .from('prices')
        .delete()
        .eq('user_id', id);
      
      if (pricesError) {
        console.error('Error deleting prices:', pricesError);
        // Continue - might not exist
      }

      // Delete merchant products if user is a merchant
      const { error: merchantProductsError } = await supabase
        .from('merchant_products')
        .delete()
        .eq('merchant_id', id);
      
      if (merchantProductsError) {
        console.error('Error deleting merchant products:', merchantProductsError);
        // Continue - might not exist
      }

      // Delete verifications
      const { error: verificationsError } = await supabase
        .from('verifications')
        .delete()
        .eq('user_id', id);
      
      if (verificationsError) {
        console.error('Error deleting verifications:', verificationsError);
        // Continue - might not exist
      }

      // Step 2: Delete user profile from public.users
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        throw new Error('Kullanıcı profili silinemedi: ' + profileError.message);
      }

      console.log('✅ User profile and related data deleted successfully');

      // Note: Auth user deletion requires admin privileges and must be done server-side
      // All user data has been deleted from the database
      // The auth user account will remain but won't have access to any data
      // For complete deletion, an admin function or Edge Function would be needed

      return { success: true };
    } catch (error: any) {
      console.error('❌ Delete account error:', error);
      throw new Error(error.message || 'Hesap silinirken bir hata oluştu');
    }
  },
};

// ============================================================================
// SEARCH API - Using Supabase Full-Text Search
// ============================================================================

export const searchAPI = {
  search: async (query: string, type: 'all' | 'products' | 'prices' | 'locations' = 'all') => {
    try {
      const normalizedQuery = String(query || '').trim();
      if (!normalizedQuery) {
        return { products: [], prices: [], locations: [] };
      }
      const normalizeTR = (value: string) =>
        String(value || '')
          .toLowerCase()
          .replace(/ı/g, 'i')
          .replace(/İ/g, 'i')
          .replace(/ş/g, 's')
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c')
          .trim();
      const queryVariants = Array.from(
        new Set([normalizedQuery, normalizeTR(normalizedQuery)].filter(Boolean))
      );
      const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
        try {
          return await Promise.race([
            promise,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
          ]);
        } catch {
          return fallback;
        }
      };

      const results: {
        products: any[];
        prices: any[];
        locations: any[];
      } = {
        products: [],
        prices: [],
        locations: [],
      };

      if (type === 'all' || type === 'products') {
        const productMap = new Map<string, any>();
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        if (sbUrl && sbKey) {
          for (const qv of queryVariants) {
            const encoded = encodeURIComponent(`*${qv}*`);
            const url = `${sbUrl}/rest/v1/products?select=*&or=(name.ilike.${encoded},category.ilike.${encoded})&order=search_count.desc.nullslast&limit=250`;
            const response = await withTimeout(
              fetch(url, {
                headers: {
                  apikey: sbKey,
                  Authorization: `Bearer ${sbKey}`,
                },
              }),
              10000,
              null as any
            );
            if (response && response.ok) {
              const products = await response.json().catch(() => []);
              (products || []).forEach((p: any) => {
                if (p?.id) productMap.set(p.id, p);
              });
            }
          }
        } else {
          for (const qv of queryVariants) {
            const { data: products } = await withTimeout(
              supabase
                .from('products')
                .select('*')
                .or(`name.ilike.%${qv}%,category.ilike.%${qv}%`)
                .limit(250),
              10000,
              { data: [], error: null } as any
            );
            (products || []).forEach((p: any) => {
              if (p?.id) productMap.set(p.id, p);
            });
          }
        }
        results.products = Array.from(productMap.values());
      }

      if (type === 'all' || type === 'prices') {
        const productIds = (results.products || [])
          .map((p: any) => p?.id)
          .filter((id: any) => typeof id === 'string' && id.length > 0);

        if (productIds.length > 0) {
          const { data: pricesByProduct } = await withTimeout(
            supabase
              .from('prices')
              .select(`
                *,
                product:products(id, name, category, default_unit, image),
                location:locations(id, name, type, address, coordinates, city, district),
                user:users(id, name, avatar, level)
              `)
              .eq('is_active', true)
              .in('product_id', productIds)
              .order('created_at', { ascending: false })
              .limit(20),
            7000,
            { data: [], error: null } as any
          );
          results.prices = pricesByProduct || [];
        } else {
          // Fallback when no direct product hit: lightweight recent scan with client-side match.
          const { data: prices } = await withTimeout(
            supabase
              .from('prices')
              .select(`
                *,
                product:products(id, name, category, default_unit, image),
                location:locations(id, name, type, address, coordinates, city, district),
                user:users(id, name, avatar, level)
              `)
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(40),
            7000,
            { data: [], error: null } as any
          );

          if (prices) {
            const lowerVariants = queryVariants.map((q) => q.toLowerCase());
            results.prices = prices.filter((p: any) =>
              lowerVariants.some((q) => p.product?.name?.toLowerCase().includes(q))
            );
          }
        }
      }

      if (type === 'all' || type === 'locations') {
        const { data: locations } = await withTimeout(
          supabase
            .from('locations')
            .select('*')
            .or(`name.ilike.%${normalizedQuery}%,address.ilike.%${normalizedQuery}%,city.ilike.%${normalizedQuery}%,district.ilike.%${normalizedQuery}%`)
            .limit(10),
          6000,
          { data: [], error: null } as any
        );
        results.locations = locations || [];
      }

      return results;
    } catch (error: any) {
      console.error('Search error:', error);
      throw new Error(error.message || 'Arama başarısız');
    }
  },

  getNearbyCheapest: async (lat: number, lng: number, radius: number = 5000, limit: number = 10) => {
    try {
      console.log('🔍 Fetching nearby cheapest prices...', { lat, lng, radius, limit });
      
      // Get all prices (geospatial filtering would require PostGIS)
      // Timeout handled by Supabase client's custom fetch
      // Remove 24-hour limit to show all available prices
      const { data: prices, error } = await supabase
        .from('prices')
        .select(`
          *,
          product:products(id, name, category, default_unit, image),
          location:locations(id, name, type, address, coordinates, city, district),
          user:users(id, name, avatar, level)
        `)
        .eq('is_active', true)
        .order('price', { ascending: true })
        .limit(500); // Increased limit to get more prices for filtering

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Nearby prices fetched:', prices?.length || 0);
      console.log('📍 User location:', { lat, lng, radiusKm: radius / 1000 });

      let hydratedPrices = prices || [];

      const missingProductRows = hydratedPrices.filter((price: any) => !price?.product && price?.product_id);
      if (missingProductRows.length > 0) {
        const productIds = Array.from(
          new Set(
            missingProductRows
              .map((price: any) => price.product_id)
              .filter((id: any) => typeof id === 'string' && id.length > 0)
          )
        );
        if (productIds.length > 0) {
          const { data: productsByIdRows } = await supabase
            .from('products')
            .select('id, name, category, default_unit, image')
            .in('id', productIds);

          const productsById = new Map((productsByIdRows || []).map((p: any) => [p.id, p]));
          hydratedPrices = hydratedPrices.map((price: any) => {
            if (price?.product || !price?.product_id) return price;
            const product = productsById.get(price.product_id);
            return product ? { ...price, product } : price;
          });
        }
      }

      // Normalize coordinates first (same logic as pricesAPI.getAll)
      const normalizedPrices = hydratedPrices.map((price: any) => {
        let latVal: number | undefined = price.lat;
        let lngVal: number | undefined = price.lng;
        
        // Check price.coordinates (direct on price object)
        if ((!latVal || !lngVal) && price.coordinates) {
          const coords = price.coordinates;
          if (typeof coords === 'string') {
            // PostgreSQL POINT string format: (lng,lat)
            const match = coords.match(/\(([^,]+),([^)]+)\)/);
            if (match) {
              lngVal = parseFloat(match[1]);
              latVal = parseFloat(match[2]);
            }
          } else if (typeof coords === 'object') {
            if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              latVal = coords.lat;
              lngVal = coords.lng;
            } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
              latVal = coords.y; // PostgreSQL POINT stores as (lng, lat)
              lngVal = coords.x;
            }
          }
        }
        
        // Then check location coordinates
        if ((!latVal || !lngVal) && price.location?.coordinates) {
          const coords = price.location.coordinates;
          if (typeof coords === 'string') {
            // PostgreSQL POINT string format: (lng,lat)
            const match = coords.match(/\(([^,]+),([^)]+)\)/);
            if (match) {
              lngVal = parseFloat(match[1]);
              latVal = parseFloat(match[2]);
            }
          } else if (typeof coords === 'object') {
            if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              latVal = coords.lat;
              lngVal = coords.lng;
            } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
              latVal = coords.y; // PostgreSQL POINT stores as (lng, lat)
              lngVal = coords.x;
            }
          }
        }
        
        // Also check if coordinates are in location object directly
        if (!latVal && price.location?.lat) {
          latVal = typeof price.location.lat === 'number' ? price.location.lat : parseFloat(String(price.location.lat));
        }
        if (!lngVal && price.location?.lng) {
          lngVal = typeof price.location.lng === 'number' ? price.location.lng : parseFloat(String(price.location.lng));
        }
        
        // Add normalized coordinates to price object
        if (typeof latVal === 'number' && typeof lngVal === 'number' && !isNaN(latVal) && !isNaN(lngVal)) {
          return { ...price, lat: latVal, lng: lngVal };
        }
        return price;
      });
      
      // Client-side geospatial filtering
      const radiusKm = radius / 1000;
      console.log(`📍 Filtering prices within ${radiusKm} km radius...`);
      console.log(`📍 Prices with coordinates: ${normalizedPrices.filter((p: any) => p.lat && p.lng).length} out of ${normalizedPrices.length}`);
      
      const nearbyPrices = normalizedPrices.filter((price: any) => {
        // Use normalized lat/lng
        if (!price.lat || !price.lng || isNaN(price.lat) || isNaN(price.lng)) {
          return false;
        }
        
        const distance = calculateDistance(lat, lng, price.lat, price.lng);
        const isWithinRadius = distance <= radiusKm;
        
        if (isWithinRadius) {
          console.log(`📍 Price within radius: ${distance.toFixed(2)} km - ${price.product?.name || 'Unknown'} - ${price.price} TL/${price.unit}`);
        }
        
        return isWithinRadius;
      });
      
      console.log(`📍 Filtered ${nearbyPrices.length} prices within ${radiusKm} km radius from ${normalizedPrices.length} total`);
      
      if (nearbyPrices.length === 0 && normalizedPrices.length > 0) {
        // Log some sample prices to debug why they're not within radius
        const samplePrices = normalizedPrices.slice(0, 5);
        console.log('⚠️ No prices within radius. Sample prices:', samplePrices.map((p: any) => ({
          product: p.product?.name,
          lat: p.lat,
          lng: p.lng,
          hasCoords: !!(p.lat && p.lng),
          distance: p.lat && p.lng ? calculateDistance(lat, lng, p.lat, p.lng).toFixed(2) + ' km' : 'N/A',
        })));
      }

      // Group by product and get cheapest
      const cheapestByProduct: Record<string, any> = {};
      nearbyPrices.forEach((price: any) => {
        const productId = price.product?.id || price.product_id;
        if (!productId) return;
        if (!cheapestByProduct[productId] || price.price < cheapestByProduct[productId].price) {
          cheapestByProduct[productId] = price;
        }
      });

      const result = Object.values(cheapestByProduct).slice(0, limit);
      console.log('✅ Nearby cheapest prices processed:', result.length);
      return result;
    } catch (error: any) {
      console.error('❌ Get nearby cheapest error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      // Return empty array instead of throwing to prevent app from hanging
      return [];
    }
  },
};

// ============================================================================
// FAVORITES API
// ============================================================================

export const favoritesAPI = {
  _cacheKey: (userId: string) => `favorites_cache_${userId}`,

  _readCache: (userId: string) => {
    try {
      const raw = localStorage.getItem(favoritesAPI._cacheKey(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  _writeCache: (userId: string, rows: any[]) => {
    try {
      localStorage.setItem(favoritesAPI._cacheKey(userId), JSON.stringify(rows || []));
    } catch {
      // ignore cache write errors
    }
  },

  _upsertCacheFavorite: (
    userId: string,
    productId: string,
    product?: { id?: string; name?: string; image?: string; category?: string }
  ) => {
    const rows = favoritesAPI._readCache(userId);
    const existingIndex = rows.findIndex((r: any) => r?.product_id === productId);
    const productSnapshot = product
      ? {
          id: product.id || productId,
          name: product.name || 'Urun',
          image: product.image,
          category: product.category,
        }
      : null;

    if (existingIndex >= 0) {
      // Upgrade existing cached row if we now have product details.
      if (productSnapshot && !rows[existingIndex]?.product) {
        const next = [...rows];
        next[existingIndex] = {
          ...next[existingIndex],
          product: productSnapshot,
        };
        favoritesAPI._writeCache(userId, next);
      }
      return;
    }
    const next = [
      {
        id: `local-${productId}`,
        product_id: productId,
        created_at: new Date().toISOString(),
        product: productSnapshot,
      },
      ...rows,
    ];
    favoritesAPI._writeCache(userId, next);
  },

  _removeCacheFavorite: (userId: string, productId: string) => {
    const rows = favoritesAPI._readCache(userId);
    const next = rows.filter((r: any) => r?.product_id !== productId);
    favoritesAPI._writeCache(userId, next);
  },

  _withTimeout: async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  },

  _getSessionForUser: async (userId: string) => {
    const { data, error } = await favoritesAPI._withTimeout(
      supabase.auth.getSession(),
      20000,
      'Session timeout'
    );
    if (error) throw error;
    const session = data?.session;
    if (!session?.access_token || !session?.user?.id) {
      throw new Error('Auth session bulunamadi, lutfen yeniden giris yapin');
    }
    if (session.user.id !== userId) {
      throw new Error('Kullanici oturumu eslesmiyor, lutfen yeniden giris yapin');
    }
    return session;
  },

  _getRestBase: () => {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!sbUrl || !sbKey) {
      throw new Error('Supabase env ayarlari eksik');
    }
    return { sbUrl, sbKey };
  },

  add: async (
    productId: string,
    userId: string,
    product?: { id?: string; name?: string; image?: string; category?: string }
  ) => {
    try {
      // Keep UI/favorites screen responsive on mobile even if auth session calls stall.
      favoritesAPI._upsertCacheFavorite(userId, productId, product);
      // Idempotent insert: repeated taps should not fail with duplicate key errors.
      const { data, error } = await supabase
        .from('user_favorites')
        .upsert(
          { user_id: userId, product_id: productId },
          { onConflict: 'user_id,product_id', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Add favorite error:', error);
      throw error;
    }
  },

  remove: async (productId: string, userId: string) => {
    try {
      // Update cache first so favorites screen reflects intent immediately.
      favoritesAPI._removeCacheFavorite(userId, productId);
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Remove favorite error:', error);
      throw error;
    }
  },

  isFavorited: async (productId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .limit(1)
        .maybeSingle();

      if (error) return false;
      return !!data?.id;
    } catch {
      return false;
    }
  },

  isFavoritedStrict: async (productId: string, userId: string) => {
    const { data, error } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return !!data?.id;
  },

  getByUser: async (userId: string) => {
    try {
      const { data: favoriteRows, error: favoritesError } = await supabase
        .from('user_favorites')
        .select('id,product_id,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (favoritesError) throw favoritesError;

      const rows = favoriteRows || [];
      if (rows.length === 0) return [];

      const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
      if (productIds.length === 0) return rows;

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id,name,image,category')
        .in('id', productIds);
      if (productsError) {
        console.error('Get favorites products lookup error:', productsError);
        // Degrade gracefully: keep favorites visible even if product join fetch fails.
        const fallbackRows = rows.map((row: any) => ({
          ...row,
          product: null,
        }));
        favoritesAPI._writeCache(userId, fallbackRows);
        return fallbackRows;
      }

      const productMap = new Map((products || []).map((p: any) => [p.id, p]));
      const mergedRows = rows.map((row: any) => ({
        ...row,
        product: productMap.get(row.product_id) || null,
      }));
      favoritesAPI._writeCache(userId, mergedRows);
      return mergedRows;
    } catch (error) {
      console.error('Get favorites error:', error);
      return favoritesAPI._readCache(userId);
    }
  },

  toggle: async (
    productId: string,
    userId: string,
    product?: { id?: string; name?: string; image?: string; category?: string }
  ) => {
    try {
      const isFav = await favoritesAPI.isFavoritedStrict(productId, userId);
      if (isFav) {
        await favoritesAPI.remove(productId, userId);
        return false;
      } else {
        await favoritesAPI.add(productId, userId, product);
        return true;
      }
    } catch (error: any) {
      console.error('Toggle favorite error:', error);
      throw error;
    }
  },

  setFavoriteState: async (
    productId: string,
    userId: string,
    shouldFavorite: boolean,
    product?: { id?: string; name?: string; image?: string; category?: string }
  ) => {
    if (shouldFavorite) {
      await favoritesAPI.add(productId, userId, product);
      return true;
    }
    await favoritesAPI.remove(productId, userId);
    return false;
  },
};

// ============================================================================
// NOTIFICATIONS API
// ============================================================================

export const notificationsAPI = {
  // Get all notifications for a user
  getByUser: async (userId: string, limit: number = 50) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          product:products(id, name, image, category)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }

      // Fallback: direct REST read for cases where supabase-js session
      // is stale on mobile but auth token exists in localStorage.
      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const authToken = localStorage.getItem('authToken');
      if (sbUrl && sbKey && authToken) {
        const response = await fetch(
          `${sbUrl}/rest/v1/notifications?select=*,product:products(id,name,image,category)&user_id=eq.${userId}&order=created_at.desc&limit=${limit}`,
          {
            headers: {
              apikey: sbKey,
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        if (response.ok) {
          const rows = await response.json().catch(() => []);
          if (Array.isArray(rows)) return rows;
        }
      }

      return [];
    } catch (error: any) {
      // If table doesn't exist, return empty array instead of throwing
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return [];
      }
      console.error('❌ Get notifications error:', error);
      throw error;
    }
  },

  // Get unread notifications count
  getUnreadCount: async (userId: string) => {
    try {
      const immediateUnread = getImmediateUnreadCount(userId);
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        // If table doesn't exist, return 0 instead of throwing
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return immediateUnread;
        }
        throw error;
      }
      return Math.max(count || 0, immediateUnread);
    } catch (error: any) {
      // Never fail badge count; always fall back to local/cache sources.
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return getImmediateUnreadCount(userId);
      }
      console.error('❌ Get unread count error:', error);
      return getImmediateUnreadCount(userId);
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Mark as read error:', error);
      throw error;
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (userId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('❌ Mark all as read error:', error);
      throw error;
    }
  },

  // Delete notification
  delete: async (notificationId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('❌ Delete notification error:', error);
      throw error;
    }
  },
};

// ============================================================================
// PUSH TOKENS API
// ============================================================================

export const pushTokensAPI = {
  upsert: async (userId: string, token: string, platform: 'ios' | 'android' | 'web') => {
    try {
      if (!userId || !token) return null;
      const serializeError = (value: any) => {
        try {
          if (!value) return null;
          return {
            name: value?.name,
            message: value?.message,
            code: value?.code,
            status: value?.status,
            details: value?.details,
            hint: value?.hint,
          };
        } catch {
          return { message: String(value) };
        }
      };
      const extractAccessTokenFromUnknownShape = (value: any): string | null => {
        try {
          if (!value) return null;
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              return extractAccessTokenFromUnknownShape(parsed);
            } catch {
              return null;
            }
          }
          if (Array.isArray(value)) {
            for (const item of value) {
              const tokenValue = extractAccessTokenFromUnknownShape(item);
              if (tokenValue) return tokenValue;
            }
            return null;
          }
          if (typeof value === 'object') {
            if (typeof (value as any).access_token === 'string') return (value as any).access_token;
            if (typeof (value as any).currentSession?.access_token === 'string') return (value as any).currentSession.access_token;
            for (const v of Object.values(value)) {
              const tokenValue = extractAccessTokenFromUnknownShape(v);
              if (tokenValue) return tokenValue;
            }
          }
          return null;
        } catch {
          return null;
        }
      };

      const resolveAccessTokenQuick = async (): Promise<string | null> => {
        const direct = localStorage.getItem('authToken');
        if (direct) return direct;
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i) || '';
            if (!key.includes('auth-token') && !key.startsWith('sb-')) continue;
            const raw = localStorage.getItem(key);
            const parsedToken = extractAccessTokenFromUnknownShape(raw);
            if (parsedToken) return parsedToken;
          }
        } catch {}
        return null;
      };

      const payload = {
        user_id: userId,
        token,
        platform,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      };
      const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
      const sbKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
      const authToken = await resolveAccessTokenQuick();
      if (!sbUrl || !sbKey) {
        throw new Error('supabase-url-or-anon-missing');
      }

      const baseHeaders: Record<string, string> = {
        apikey: sbKey,
        'Content-Type': 'application/json',
      };
      if (authToken) baseHeaders.Authorization = `Bearer ${authToken}`;

      // 1) Prefer Edge Function registration and avoid Supabase client auth/session path.
      try {
        const fnController = new AbortController();
        const fnTimeout = setTimeout(() => fnController.abort(), 20000);
        const fnResponse = await fetch(`${sbUrl}/functions/v1/register-push-token`, {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify(payload),
          signal: fnController.signal,
        });
        clearTimeout(fnTimeout);
        const fnJson = await fnResponse.json().catch(() => null);
        if (fnResponse.ok && fnJson?.ok !== false) {
          return fnJson?.row || fnJson?.data?.row || null;
        }
        console.warn(
          'register-push-token HTTP failed:',
          JSON.stringify({ status: fnResponse.status, body: fnJson }),
        );
      } catch (invokeError) {
        console.warn(
          'register-push-token HTTP exception, falling back:',
          JSON.stringify(serializeError(invokeError)),
        );
      }

      // 2) REST fallback with conflict-merge.
      const restController = new AbortController();
      const restTimeout = setTimeout(() => restController.abort(), 20000);
      const restResponse = await fetch(`${sbUrl}/rest/v1/user_push_tokens?on_conflict=token`, {
        method: 'POST',
        headers: {
          ...baseHeaders,
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
        signal: restController.signal,
      });
      clearTimeout(restTimeout);
      if (!restResponse.ok) {
        const errBody = await restResponse.text().catch(() => '');
        throw new Error(`push-token-rest-failed:${restResponse.status}:${errBody}`);
      }
      const rows = await restResponse.json().catch(() => []);
      return Array.isArray(rows) ? rows[0] || null : null;
    } catch (error: any) {
      console.error('❌ Push token registration failed:', error);
      return null;
    }
  },
};

// ============================================================================
// MERCHANT PRODUCTS API
// ============================================================================

const MERCHANT_SUBSCRIPTION_MONTHLY_FEE_TL = 900;

const getMerchantSubscriptionAccessError = () =>
  `Esnaf aboneliğiniz aktif değil. Dükkanınızı yönetmek için aylık ${MERCHANT_SUBSCRIPTION_MONTHLY_FEE_TL} TL abonelik gereklidir.`;

const isTransientSubscriptionCheckError = (error: unknown) => {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return (
    msg.includes('zaman aşım') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch')
  );
};

const ensureMerchantSubscriptionActive = async (merchantId: string) => {
  try {
    const { data, error } = await withHardTimeout(
      supabase.rpc('has_active_merchant_subscription', {
        p_user_id: merchantId,
      }),
      12000,
      'Abonelik kontrolü zaman asimina ugradi'
    );

    if (error) {
      if (isTransientSubscriptionCheckError(error)) {
        console.warn('⚠️ Subscription check transient error, allowing operation:', error);
        return;
      }
      console.error('❌ Subscription check RPC error:', error);
      throw new Error('Abonelik durumu kontrol edilemedi. Lütfen tekrar deneyin.');
    }

    if (!data) {
      throw new Error(getMerchantSubscriptionAccessError());
    }
  } catch (error: any) {
    if (isTransientSubscriptionCheckError(error)) {
      console.warn('⚠️ Subscription check timeout/network, allowing operation:', error);
      return;
    }
    throw error;
  }
};

export const merchantProductsAPI = {
  // Get all merchant products for a specific merchant
  getByMerchant: async (merchantId: string) => {
    return cachedQuery(stableKey('merchant:getByMerchant', { merchantId }), 12000, async () => {
      try {
      const hydrateMerchantRows = async (rows: any[]) => {
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) return [];

        const needsProductHydration = list.some((row: any) => !row?.product && row?.product_id);
        const needsLocationHydration = list.some((row: any) => !row?.location && row?.location_id);

        if (!needsProductHydration && !needsLocationHydration) return list;

        const productIds = needsProductHydration
          ? Array.from(new Set(list.map((r: any) => r?.product_id).filter(Boolean)))
          : [];
        const locationIds = needsLocationHydration
          ? Array.from(new Set(list.map((r: any) => r?.location_id).filter(Boolean)))
          : [];

        let productRows: any[] = [];
        let locationRows: any[] = [];

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

        if (supabaseUrl && supabaseAnonKey) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const [productsRes, locationsRes] = await Promise.all([
              productIds.length
                ? fetch(
                    `${supabaseUrl}/rest/v1/products?select=id,name,category,image&id=in.(${productIds.join(',')})`,
                    {
                      headers: {
                        apikey: supabaseAnonKey,
                        Authorization: `Bearer ${supabaseAnonKey}`,
                      },
                      signal: controller.signal,
                    }
                  )
                : Promise.resolve(null),
              locationIds.length
                ? fetch(
                    `${supabaseUrl}/rest/v1/locations?select=id,name,coordinates&id=in.(${locationIds.join(',')})`,
                    {
                      headers: {
                        apikey: supabaseAnonKey,
                        Authorization: `Bearer ${supabaseAnonKey}`,
                      },
                      signal: controller.signal,
                    }
                  )
                : Promise.resolve(null),
            ]);
            clearTimeout(timeoutId);

            if (productsRes?.ok) {
              productRows = await productsRes.json().catch(() => []);
            }
            if (locationsRes?.ok) {
              locationRows = await locationsRes.json().catch(() => []);
            }
          } catch {
            // Fallback to supabase client queries below.
          }
        }

        // No Supabase client fallback - it uses the global fetch wrapper which can hang on Android

        const productMap = new Map((productRows || []).map((p: any) => [p.id, p]));
        const locationMap = new Map((locationRows || []).map((l: any) => [l.id, l]));

        return list.map((row: any) => ({
          ...row,
          product: row.product || productMap.get(row.product_id) || { id: row.product_id, name: 'Ürün', category: 'Diğer' },
          location: row.location || (row.location_id ? (locationMap.get(row.location_id) || null) : null),
        }));
      };

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const params = new URLSearchParams({
            select: 'id,merchant_id,product_id,price,unit,images,location_id,coordinates,verification_count,unverification_count,created_at,is_active',
            merchant_id: `eq.${merchantId}`,
            or: '(is_active.eq.true,is_active.is.null)',
            order: 'created_at.desc',
          });

          const restResponse = await fetch(`${supabaseUrl}/rest/v1/merchant_products?${params.toString()}`, {
            method: 'GET',
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (restResponse.ok) {
            const restRows = await restResponse.json().catch(() => []);
            return await hydrateMerchantRows(Array.isArray(restRows) ? restRows : []);
          }
        } catch {
          // Continue to Supabase client query fallback.
        }
      }

      const { data, error } = await supabase
        .from('merchant_products')
        .select('id, merchant_id, product_id, price, unit, images, location_id, coordinates, verification_count, unverification_count, created_at, is_active')
        .eq('merchant_id', merchantId)
        // Include legacy rows where is_active is null.
        .or('is_active.eq.true,is_active.is.null')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return await hydrateMerchantRows(data || []);
      } catch (error: any) {
        console.error('❌ Get merchant products error:', error);
        throw error;
      }
    });
  },

  // Get a single merchant product by ID
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('merchant_products')
        .select(`
          *,
          product:products(*),
          location:locations(*),
          merchant:users!merchant_products_merchant_id_fkey(id, name, avatar, email)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Get merchant product error:', error);
      throw error;
    }
  },

  // Create a new merchant product
  create: async (data: {
    merchant_id: string;
    product_id: string;
    price: number;
    unit: string;
    images: string[];
    location_id?: string;
    coordinates?: { lat: number; lng: number };
  }) => {
    try {
      await ensureMerchantSubscriptionActive(data.merchant_id);

      const insertData: any = {
        merchant_id: data.merchant_id,
        product_id: data.product_id,
        price: data.price,
        unit: data.unit,
        images: data.images || [],
        location_id: data.location_id || null,
      };

      // Add coordinates if provided
      if (data.coordinates) {
        insertData.coordinates = `(${data.coordinates.lng},${data.coordinates.lat})`;
      }

      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      if (sbUrl) {
        try {
          const headers = await getRestAuthHeaders();
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 20000);
          const restRes = await fetch(`${sbUrl}/rest/v1/merchant_products?on_conflict=merchant_id,product_id`, {
            method: 'POST',
            headers: {
              ...headers,
              Prefer: 'resolution=merge-duplicates,return=representation',
            },
            body: JSON.stringify(insertData),
            signal: controller.signal,
          });
          clearTimeout(tid);
          if (restRes.ok) {
            const rows = await restRes.json().catch(() => []);
            invalidateCachedQueries('merchant:');
            return Array.isArray(rows) ? rows[0] || null : null;
          }
        } catch {
          // Fall back to Supabase client path
        }
      }
      // Use upsert with conflict on (merchant_id, product_id) so adding the same product
      // for the same merchant will update the existing row instead of throwing a duplicate key error.
      const { data: result, error } = await withHardTimeout(
        supabase
          .from('merchant_products')
          .upsert(insertData, { onConflict: 'merchant_id,product_id' })
          .select(`
            *,
            product:products(*),
            location:locations(*)
          `)
          .single(),
        20000,
        'Ürün kaydetme zaman aşımına uğradı'
      );

      if (error) {
        console.error('❌ Create/Upsert merchant product error:', error);
        throw error;
      }

      invalidateCachedQueries('merchant:');
      return result;
    } catch (error: any) {
      console.error('❌ Create merchant product error:', error);
      throw error;
    }
  },

  // Update a merchant product
  update: async (id: string, data: {
    price?: number;
    unit?: string;
    images?: string[];
    location_id?: string;
    coordinates?: { lat: number; lng: number };
    is_active?: boolean;
  }) => {
    try {
      const { data: currentProduct, error: currentProductError } = await withHardTimeout(
        supabase
          .from('merchant_products')
          .select('merchant_id')
          .eq('id', id)
          .single(),
        12000,
        'Ürün güncelleme hazırlığı zaman aşımına uğradı'
      );

      if (currentProductError || !currentProduct?.merchant_id) {
        console.error('❌ Failed to fetch merchant product for subscription check:', currentProductError);
        throw new Error('Ürün bulunamadı');
      }

      await ensureMerchantSubscriptionActive(currentProduct.merchant_id);

      const updateData: any = {};

      if (data.price !== undefined) updateData.price = data.price;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.images !== undefined) updateData.images = data.images;
      if (data.location_id !== undefined) updateData.location_id = data.location_id;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.coordinates) {
        updateData.coordinates = `(${data.coordinates.lng},${data.coordinates.lat})`;
      }

      updateData.updated_at = new Date().toISOString();

      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      if (sbUrl) {
        try {
          const headers = await getRestAuthHeaders();
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 20000);
          const restRes = await fetch(`${sbUrl}/rest/v1/merchant_products?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
              ...headers,
              Prefer: 'return=representation',
            },
            body: JSON.stringify(updateData),
            signal: controller.signal,
          });
          clearTimeout(tid);
          if (restRes.ok) {
            const rows = await restRes.json().catch(() => []);
            invalidateCachedQueries('merchant:');
            return Array.isArray(rows) ? rows[0] || null : null;
          }
        } catch {
          // Fall back to Supabase client path
        }
      }

      const { data: result, error } = await withHardTimeout(
        supabase
          .from('merchant_products')
          .update(updateData)
          .eq('id', id)
          .select(`
            *,
            product:products(*),
            location:locations(*)
          `)
          .single(),
        20000,
        'Ürün güncelleme zaman aşımına uğradı'
      );

      if (error) throw error;
      invalidateCachedQueries('merchant:');
      return result;
    } catch (error: any) {
      console.error('❌ Update merchant product error:', error);
      throw error;
    }
  },

  // Delete a merchant product
  delete: async (id: string) => {
    try {
      const { data: currentProduct, error: currentProductError } = await supabase
        .from('merchant_products')
        .select('merchant_id')
        .eq('id', id)
        .single();

      if (currentProductError || !currentProduct?.merchant_id) {
        console.error('❌ Failed to fetch merchant product for subscription check:', currentProductError);
        throw new Error('Ürün bulunamadı');
      }

      await ensureMerchantSubscriptionActive(currentProduct.merchant_id);

      const { error } = await supabase
        .from('merchant_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      invalidateCachedQueries('merchant:');
      return true;
    } catch (error: any) {
      console.error('❌ Delete merchant product error:', error);
      throw error;
    }
  },

  // Verify a merchant product (user confirms price is correct)
  verify: async (merchantProductId: string, userId: string, isVerified: boolean = true) => {
    try {
      // Use UPSERT to handle both insert and update
      const { data, error } = await supabase
        .from('merchant_product_verifications')
        .upsert({
          merchant_product_id: merchantProductId,
          user_id: userId,
          is_verified: isVerified,
        }, {
          onConflict: 'merchant_product_id,user_id'
        })
        .select()
        .single();

      if (error) throw error;
      invalidateCachedQueries('merchant:');
      return data;
    } catch (error: any) {
      console.error('❌ Verify merchant product error:', error);
      throw error;
    }
  },

  // Get user's verification status for a merchant product
  getUserVerification: async (merchantProductId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('merchant_product_verifications')
        .select('*')
        .eq('merchant_product_id', merchantProductId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Get user verification error:', error);
      throw error;
    }
  },

  trackClick: async (params: {
    merchant_product_id: string;
    merchant_id: string;
    product_id: string;
    viewer_user_id?: string;
  }) => {
    try {
      const insertPayload: any = {
        merchant_product_id: params.merchant_product_id,
        merchant_id: params.merchant_id,
        product_id: params.product_id,
      };
      if (params.viewer_user_id) {
        insertPayload.viewer_user_id = params.viewer_user_id;
      }

      const { error } = await supabase
        .from('merchant_product_clicks')
        .insert(insertPayload);

      if (error) {
        console.warn('⚠️ Track merchant product click failed:', error);
      }
      return !error;
    } catch (error: any) {
      console.warn('⚠️ Track merchant product click exception:', error);
      return false;
    }
  },

  getDailyClickReport: async (merchantId: string, days: number = 14) => {
    return cachedQuery(stableKey('merchant:dailyClickReport', { merchantId, days }), 15000, async () => {
      try {
        const dayCount = Math.min(Math.max(Number(days) || 14, 1), 60);
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        since.setDate(since.getDate() - (dayCount - 1));
        let data: any[] = [];

        // REST-first with explicit timeout to avoid hanging query states on mobile/webview.
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        if (sbUrl) {
          try {
            const headers = await getRestAuthHeaders();
            const params = new URLSearchParams({
              select: 'clicked_at,merchant_product_id,product_id',
              merchant_id: `eq.${merchantId}`,
              clicked_at: `gte.${since.toISOString()}`,
              order: 'clicked_at.asc',
              limit: '10000',
            });
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(`${sbUrl}/rest/v1/merchant_product_clicks?${params.toString()}`, {
              method: 'GET',
              headers,
              signal: controller.signal,
            });
            clearTimeout(tid);
            if (resp.ok) {
              data = await resp.json().catch(() => []);
            }
          } catch {
            // Fallback below
          }
        }

        if (!Array.isArray(data) || data.length === 0) {
          const { data: fallbackData, error } = await withHardTimeout(
            supabase
              .from('merchant_product_clicks')
              .select('clicked_at,merchant_product_id,product_id')
              .eq('merchant_id', merchantId)
              .gte('clicked_at', since.toISOString())
              .order('clicked_at', { ascending: true })
              .limit(10000),
            12000,
            'Rapor sorgusu zaman aşımına uğradı'
          );

          if (error) {
            const msg = String((error as any)?.message || '').toLowerCase();
            if ((error as any)?.code === '42P01' || msg.includes('does not exist')) {
              return { daily: [], products: [] };
            }
            throw error;
          }
          data = Array.isArray(fallbackData) ? fallbackData : [];
        }

        const productIds = Array.from(
          new Set((data || []).map((row: any) => row?.product_id).filter(Boolean))
        );
        const productNameMap = new Map<string, string>();
        if (productIds.length > 0) {
          try {
            const { data: productRows } = await withHardTimeout(
              supabase
                .from('products')
                .select('id,name')
                .in('id', productIds),
              8000,
              'Rapor ürün adları zaman aşımına uğradı'
            );
            for (const p of productRows || []) {
              if ((p as any)?.id) {
                productNameMap.set(String((p as any).id), String((p as any).name || 'Ürün'));
              }
            }
          } catch {
            // Keep default "Ürün" labels when product-name hydration fails.
          }
        }

        const byDay = new Map<string, number>();
        const byProduct = new Map<string, { merchant_product_id: string; product_id: string; product_name: string; count: number }>();

        for (const row of data || []) {
          const dayKey = String((row as any)?.clicked_at || '').slice(0, 10);
          if (dayKey) {
            byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);
          }

          const merchantProductId = String((row as any)?.merchant_product_id || '');
          if (!merchantProductId) continue;
          const current = byProduct.get(merchantProductId);
          const productId = String((row as any)?.product_id || '');
          const productName = productNameMap.get(productId) || 'Ürün';
          if (current) {
            current.count += 1;
          } else {
            byProduct.set(merchantProductId, {
              merchant_product_id: merchantProductId,
              product_id: productId,
              product_name: productName,
              count: 1,
            });
          }
        }

        const daily: Array<{ date: string; count: number }> = [];
        for (let i = 0; i < dayCount; i++) {
          const d = new Date(since);
          d.setDate(since.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          daily.push({ date: key, count: byDay.get(key) || 0 });
        }

        const products = Array.from(byProduct.values()).sort((a, b) => b.count - a.count);
        return { daily, products };
      } catch (error: any) {
        const msg = String(error?.message || '').toLowerCase();
        if (error?.code === '42P01' || msg.includes('does not exist')) {
          return { daily: [], products: [] };
        }
        // Never block reports screen indefinitely. Fail closed to an empty report.
        console.error('❌ Get merchant daily click report error, returning empty:', error);
        return { daily: [], products: [] };
      }
    });
  },

  getAllMerchantShops: async (limit: number = 50) => {
    return cachedQuery(stableKey('merchant:getAllShops', { limit }), 12000, async () => {
      try {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const headers = { apikey: sbKey, Authorization: `Bearer ${sbKey}` };
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);

        const mpResp = await fetch(
          `${sbUrl}/rest/v1/merchant_products?select=merchant_id,coordinates&or=(is_active.eq.true,is_active.is.null)&limit=${limit}`,
          { headers, signal: controller.signal }
        );
        if (!mpResp.ok) { clearTimeout(tid); throw new Error(`merchant_products ${mpResp.status}`); }
        const mpRows: any[] = await mpResp.json().catch(() => []);

        const merchantIds = [...new Set((mpRows || []).map((r: any) => r.merchant_id).filter(Boolean))];
        if (merchantIds.length === 0) { clearTimeout(tid); return []; }

        const usersResp = await fetch(
          `${sbUrl}/rest/v1/users?select=id,name,avatar,email,is_merchant&id=in.(${merchantIds.join(',')})`,
          { headers, signal: controller.signal }
        );
        clearTimeout(tid);
        const users: any[] = usersResp.ok ? await usersResp.json().catch(() => []) : [];
        const userMap = new Map(users.map((u: any) => [u.id, u]));

        const coordMap = new Map<string, any>();
        for (const r of mpRows) {
          if (r.merchant_id && !coordMap.has(r.merchant_id)) {
            coordMap.set(r.merchant_id, r.coordinates);
          }
        }

        return merchantIds.map((mid) => {
          const u = userMap.get(mid);
          return {
            id: mid,
            name: u?.name || 'Esnaf',
            avatar: u?.avatar || null,
            email: u?.email || null,
            is_merchant: u?.is_merchant === true,
            coordinates: coordMap.get(mid) || null,
          };
        });
      } catch (error: any) {
        console.error('Get all merchant shops error:', error);
        throw error;
      }
    });
  },
};

// ============================================================================
// MERCHANT SUBSCRIPTION API
// ============================================================================

export const merchantSubscriptionAPI = {
  getStatus: async (userId: string) => {
    const isTransientError = (error: any) => {
      const msg = String(error?.message || error || '').toLowerCase();
      return (
        msg.includes('zaman aşım') ||
        msg.includes('timeout') ||
        msg.includes('network') ||
        msg.includes('failed to fetch') ||
        msg.includes('fetch')
      );
    };

    try {
      try {
        const { error: syncError } = await withHardTimeout(
          supabase.rpc('sync_merchant_subscription_status', {
            p_user_id: userId,
          }),
          9000,
          'Abonelik senkronizasyonu zaman aşımına uğradı'
        );
        if (syncError) {
          console.warn('⚠️ Failed to sync merchant subscription status:', syncError);
        }
      } catch (syncError: any) {
        if (!isTransientError(syncError)) {
          console.warn('⚠️ Subscription sync non-transient error:', syncError);
        }
        // Fail-open: continue with current profile snapshot.
      }

      const { data: profile, error: profileError } = await withHardTimeout(
        supabase
          .from('users')
          .select(`
            id,
            is_merchant,
            merchant_subscription_status,
            merchant_subscription_plan,
            merchant_subscription_fee_tl,
            merchant_subscription_current_period_start,
            merchant_subscription_current_period_end
          `)
          .eq('id', userId)
          .single(),
        12000,
        'Abonelik profil sorgusu zaman aşımına uğradı'
      );
      if (profileError) throw profileError;

      let isActive = false;
      try {
        const activeResult = await withHardTimeout(
          supabase.rpc('has_active_merchant_subscription', { p_user_id: userId }),
          9000,
          'Abonelik aktiflik sorgusu zaman aşımına uğradı'
        );
        if (!(activeResult as any)?.error) {
          isActive = !!(activeResult as any)?.data;
        }
      } catch {
        const status = String((profile as any)?.merchant_subscription_status || '').toLowerCase();
        isActive = status === 'active' || status === 'past_due';
      }

      return {
        ...(profile || {}),
        is_active: !!isActive,
      };
    } catch (error: any) {
      console.error('❌ Get merchant subscription status error (fallback):', error);
      if (isTransientError(error)) {
        return {
          id: userId,
          is_merchant: true,
          merchant_subscription_status: 'inactive',
          merchant_subscription_plan: 'merchant_basic_monthly',
          merchant_subscription_fee_tl: 900,
          merchant_subscription_current_period_start: null,
          merchant_subscription_current_period_end: null,
          is_active: false,
        };
      }
      throw new Error(error.message || 'Abonelik durumu alınamadı');
    }
  },

  getPayments: async (userId: string, limit: number = 20) => {
    try {
      const { data, error } = await withHardTimeout(
        supabase
          .from('merchant_subscription_payments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit),
        20000,
        'Ödeme geçmişi sorgusu zaman aşımına uğradı'
      );

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('❌ Get merchant subscription payments error:', error);
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('zaman aşım') || msg.includes('timeout') || msg.includes('failed to fetch') || msg.includes('network')) {
        return [];
      }
      throw new Error(error.message || 'Ödeme geçmişi alınamadı');
    }
  },

  getGooglePlayProductId: (billingPeriodMonths: number = 1) => {
    const monthly = String(import.meta.env.VITE_GOOGLE_PLAY_SUBS_PRODUCT_ID_MONTHLY || 'merchant_basic_monthly').trim();
    const yearly = String(import.meta.env.VITE_GOOGLE_PLAY_SUBS_PRODUCT_ID_YEARLY || 'merchant_basic_yearly').trim();
    if (billingPeriodMonths >= 12) {
      return yearly || monthly || '';
    }
    return monthly || yearly || '';
  },

  confirmGooglePlayPurchase: async (data: {
    purchaseToken: string;
    productId: string;
    orderId?: string;
    packageName?: string;
    purchaseTime?: number;
  }) => {
    try {
      const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
      const sbAnon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
      if (!sbUrl || !sbAnon) throw new Error('Supabase yapılandırması eksik');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = String(sessionData?.session?.access_token || '').trim() || getAccessTokenFromStorageFallback() || '';
      if (!accessToken) throw new Error('Oturum bulunamadı');

      const res = await withHardTimeout(
        fetch(`${sbUrl}/functions/v1/merchant-subscription-google-confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: sbAnon,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            purchaseToken: data.purchaseToken,
            productId: data.productId,
            orderId: data.orderId || null,
            packageName: data.packageName || null,
            purchaseTime: data.purchaseTime || null,
          }),
        }),
        30000,
        'Google Play doğrulama isteği zaman aşımına uğradı'
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(String(json?.error || `HTTP ${res.status}`));
      }
      return json;
    } catch (error: any) {
      console.error('❌ Confirm Google Play purchase error:', error);
      throw new Error(error.message || 'Google Play satın alımı doğrulanamadı');
    }
  },

  cleanupOldPayments: async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Oturum bulunamadı');
      }

      const { data, error } = await supabase.functions.invoke('merchant-subscription-cleanup', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;
      return data || { deletedCount: 0 };
    } catch (error: any) {
      console.error('❌ Cleanup old payments error:', error);
      throw new Error(error.message || 'Ödeme geçmişi temizlenemedi');
    }
  },

  startTrial: async (userId: string, trialDays: number = 10) => {
    try {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from('users')
        .update({
          is_merchant: true,
          merchant_subscription_status: 'active',
          merchant_subscription_plan: `merchant_trial_${trialDays}_days`,
          merchant_subscription_fee_tl: 900,
          merchant_subscription_current_period_start: now.toISOString(),
          merchant_subscription_current_period_end: periodEnd.toISOString(),
        })
        .eq('id', userId)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Start merchant trial error:', error);
      throw new Error(error.message || 'Deneme aboneliği başlatılamadı');
    }
  },
};

// ============================================================================
// FEEDBACK API
// ============================================================================

export const feedbackAPI = {
  send: async (data: { user_id: string | null; message: string; platform?: string }) => {
    try {
      // Try to insert into feedback table; if table missing, fallback to console/mailto
      const insert = {
        user_id: data.user_id,
        message: data.message,
        platform: data.platform || 'web',
        created_at: new Date().toISOString(),
      };

      const { data: inserted, error } = await supabase
        .from('feedback')
        .insert(insert)
        .select()
        .single();

      if (error) {
        // If table doesn't exist or permission denied, log and throw
        console.warn('Feedback insert error:', error);
        throw error;
      }
      return inserted;
    } catch (err: any) {
      console.error('Failed to send feedback:', err);
      throw err;
    }
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

