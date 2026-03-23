import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authAPI } from '../services/supabase-api';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  level: number | string;
  points: number;
  contributions: {
    shares: number;
    verifications: number;
  };
  isGuest?: boolean;
  is_merchant?: boolean;
  merchant_subscription_status?: 'inactive' | 'active' | 'past_due' | 'canceled';
  merchant_subscription_plan?: string | null;
  merchant_subscription_fee_tl?: number;
  merchant_subscription_current_period_start?: string | null;
  merchant_subscription_current_period_end?: string | null;
  preferences?: {
    notifications?: boolean;
    searchRadius?: number;
    language?: string;
    [key: string]: any; // Allow other preference keys
  };
  search_radius?: number; // Legacy column for backward compatibility
  location?: {
    city?: string;
    district?: string;
    coordinates?: { lat: number; lng: number };
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  register: (email: string, password: string, name: string, isMerchant?: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (options?: { merchantSignupIntent?: boolean; loginHint?: string }) => Promise<void>;
  guestLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);
  const userRef = useRef<User | null>(null);
  const isOAuthCallbackRef = useRef(false);
  const lastAuthoritativeProfileSyncAtRef = useRef(0);
  const bgProfilePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggingOutRef = useRef(false);
  const OAUTH_PENDING_MAX_AGE_MS = 2 * 60 * 1000;
  const MERCHANT_SIGNUP_INTENT_KEY = 'merchant-signup-intent';
  const MERCHANT_SUBSCRIPTION_ONBOARDING_KEY = 'merchant-subscription-onboarding-user';
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
  const getMerchantHint = (email?: string | null): boolean => {
    if (!email) return false;
    try {
      return localStorage.getItem('merchant-hint-' + email) === '1';
    } catch { return false; }
  };
  const startBackgroundProfilePoller = (userId: string) => {
    if (bgProfilePollerRef.current) return;
    let attempts = 0;
    const maxAttempts = 30;
    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (bgProfilePollerRef.current) {
          clearInterval(bgProfilePollerRef.current);
          bgProfilePollerRef.current = null;
        }
        return;
      }
      if (lastAuthoritativeProfileSyncAtRef.current > 0) {
        console.log('✅ BG poller: authoritative profile already synced, stopping');
        if (bgProfilePollerRef.current) {
          clearInterval(bgProfilePollerRef.current);
          bgProfilePollerRef.current = null;
        }
        return;
      }
      try {
        const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
        const sbKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
        const authToken = localStorage.getItem('authToken') || '';
        if (!sbUrl || !sbKey || !authToken) return;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(
          `${sbUrl}/rest/v1/users?id=eq.${userId}&select=*`,
          {
            headers: { apikey: sbKey, Authorization: `Bearer ${authToken}` },
            signal: controller.signal,
          }
        );
        clearTimeout(timer);

        if (!res.ok) return;
        const rows = await res.json().catch(() => []);
        const profile = Array.isArray(rows) ? rows[0] : null;
        if (!profile?.id) return;

        const isMerchant = resolveMerchantStatus(profile);
        const currentUser = userRef.current;
        const currentMerchant = currentUser ? resolveMerchantStatus(currentUser) : false;

        const preferencesRadius = profile.preferences?.searchRadius;
        const legacyRadius = profile.search_radius;
        const finalSearchRadius = preferencesRadius !== undefined
          ? preferencesRadius
          : (legacyRadius !== undefined ? legacyRadius : 15);

        const userData = {
          ...profile,
          is_merchant: isMerchant,
          preferences: { ...(profile.preferences || {}), searchRadius: finalSearchRadius },
          search_radius: finalSearchRadius,
        };

        updateUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        lastAuthoritativeProfileSyncAtRef.current = Date.now();
        if (isMerchant && profile.email) {
          try { localStorage.setItem('merchant-hint-' + profile.email, '1'); } catch {}
        } else if (!isMerchant && profile.email) {
          try { localStorage.removeItem('merchant-hint-' + profile.email); } catch {}
        }
        console.log('✅ BG poller: profile loaded (attempt', attempts, '), is_merchant:', isMerchant);

        if (bgProfilePollerRef.current) {
          clearInterval(bgProfilePollerRef.current);
          bgProfilePollerRef.current = null;
        }
      } catch (err) {
        console.warn('⚠️ BG poller attempt', attempts, 'failed:', err);
      }
    };
    console.log('🔄 BG poller: starting for user', userId);
    bgProfilePollerRef.current = setInterval(poll, 3000);
    setTimeout(poll, 500);
  };

  const createSessionFallbackUser = (session: any, preserved?: any) => {
    if (!session?.user) return null;
    if (preserved?.id === session.user.id) return preserved;
    let cachedSameUser: any = null;
    try {
      const raw = localStorage.getItem('user');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.id === session.user.id) {
        cachedSameUser = parsed;
      }
    } catch {
      cachedSameUser = null;
    }
    if (cachedSameUser) return cachedSameUser;
    const userMetadata = session.user.user_metadata || {};
    // Check merchant hint saved during logout
    let merchantHint = false;
    try {
      const email = session.user.email || '';
      if (email && localStorage.getItem('merchant-hint-' + email) === '1') {
        merchantHint = true;
      }
    } catch { /* ignore */ }
    return {
      id: session.user.id,
      email: session.user.email || '',
      name: userMetadata.name || userMetadata.full_name || session.user.email?.split('@')[0] || 'Kullanıcı',
      avatar: userMetadata.avatar_url || userMetadata.picture,
      level: 1,
      points: 0,
      contributions: {
        shares: 0,
        verifications: 0,
      },
      isGuest: false,
      is_merchant: merchantHint || normalizeMerchantFlag(userMetadata.is_merchant),
      preferences: {
        notifications: true,
        searchRadius: 15,
      },
      search_radius: 15,
    };
  };

  const getAppRootPath = (): string => {
    const configuredBase = String(import.meta.env.BASE_URL || '/').trim();
    const normalize = (value: string) => {
      let out = value || '/';
      if (!out.startsWith('/')) out = `/${out}`;
      if (!out.endsWith('/')) out = `${out}/`;
      return out.replace(/\/{2,}/g, '/');
    };
    const normalizedConfigured = normalize(configuredBase);
    if (normalizedConfigured !== '/') return normalizedConfigured;
    const pathname = String(window.location.pathname || '/');
    if (pathname.startsWith('/esnaftaucuz/')) return '/esnaftaucuz/';
    if (pathname === '/esnaftaucuz') return '/esnaftaucuz/';
    return '/';
  };

  const clearAuthStorage = () => {
    try {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('oauth-pending-ts');
      localStorage.removeItem(MERCHANT_SIGNUP_INTENT_KEY);
      localStorage.removeItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY);
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          (key.startsWith('sb-') && key.includes('auth-token')) ||
          key.startsWith('supabase.auth.') ||
          key.includes('code-verifier') ||
          key.includes('code_verifier')
        ) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => localStorage.removeItem(key));
    } catch {
      // best effort
    }
  };

  const updateUser = (newUser: User | null) => {
    // If new value would downgrade merchant to non-merchant, check hint first
    if (newUser && userRef.current?.id === newUser.id && userRef.current?.is_merchant && !newUser.is_merchant) {
      const hint = getMerchantHint(newUser.email);
      if (hint) {
        newUser = { ...newUser, is_merchant: true };
      }
    }
    userRef.current = newUser;
    setUser(newUser);
  };
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    isOAuthCallbackRef.current = isOAuthCallback;
  }, [isOAuthCallback]);

  useEffect(() => {
    // Check for OAuth callback in URL (Supabase adds hash fragments)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const accessToken = hashParams.get('access_token');
    const code = hashParams.get('code');
    const error = hashParams.get('error');
    const oauthPendingTs = (() => {
      try {
        return Number(localStorage.getItem('oauth-pending-ts') || '0');
      } catch {
        return 0;
      }
    })();
    const hasRecentOAuthPending = oauthPendingTs > 0 && (Date.now() - oauthPendingTs) < OAUTH_PENDING_MAX_AGE_MS;
    const merchantIntentFromUrl =
      searchParams.get('merchant_intent') === '1' || hashParams.get('merchant_intent') === '1';
    if (merchantIntentFromUrl) {
      try {
        localStorage.setItem(MERCHANT_SIGNUP_INTENT_KEY, '1');
      } catch {
        // best effort
      }
    }
    
    if (error) {
      console.error('OAuth error in URL:', error);
      toast.error('Google giriş tamamlanamadı', {
        description: 'İnternet bağlantınızı kontrol edip tekrar deneyin.',
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsLoading(false);
      setIsOAuthCallback(false);
      isOAuthCallbackRef.current = false;
      try {
        localStorage.removeItem('oauth-pending-ts');
      } catch {
        // best effort
      }
      return;
    }
    
    // If explicit OAuth callback is detected, keep loading until session is processed.
    // Pending flag alone can be stale after interrupted flows and should not block startup.
    const hasExplicitOAuthCallback = !!(accessToken || code);
    const hasOAuthCallback = !!(hasExplicitOAuthCallback || hasRecentOAuthPending);
    setIsOAuthCallback(hasOAuthCallback);
    isOAuthCallbackRef.current = hasOAuthCallback;
    
    if (hasOAuthCallback) {
      console.log('🔐 OAuth callback detected in URL');
      // Keep loading state - will be set to false after profile is loaded
      // Don't clean URL yet - let Supabase process it first
    }

    // Load user profile helper with timeout protection
    const loadUserProfile = async (session: any, event: string, shouldCleanUrl: boolean = false) => {
      // Read local cache as fallback only; always resolve authoritative profile from DB.
      let storedUser: string | null = null;
      let cachedUser: any = null;
      try {
        storedUser = localStorage.getItem('user');
        if (storedUser) {
          cachedUser = JSON.parse(storedUser);
        }
      } catch (e) {
        // Invalid JSON, continue with fetch
        storedUser = null;
        cachedUser = null;
      }

      const createFallbackUser = (cachedUser?: any) => {
        if (cachedUser?.id === session?.user?.id) {
          return cachedUser;
        }
        if (!session?.user) return null;
        const userMetadata = session.user.user_metadata || {};
        const hint = getMerchantHint(session.user.email);
        return {
          id: session.user.id,
          email: session.user.email || '',
          name: userMetadata.name || userMetadata.full_name || session.user.email?.split('@')[0] || 'Kullanıcı',
          avatar: userMetadata.avatar_url || userMetadata.picture,
          level: 1,
          points: 0,
          contributions: {
            shares: 0,
            verifications: 0,
          },
          isGuest: false,
          is_merchant: hint || normalizeMerchantFlag(userMetadata.is_merchant),
          preferences: {
            notifications: true,
            searchRadius: 15,
          },
          search_radius: 15,
        };
      };

      const profileTimeout = setTimeout(() => {
        console.warn('⚠️ Profile load safety timeout - forcing loading to false');
        if (lastAuthoritativeProfileSyncAtRef.current > 0) {
          console.log('✅ Safety timeout: BG poller already synced - keeping current user');
        } else {
          const fallbackUser = createFallbackUser(cachedUser);
          if (fallbackUser) {
            updateUser(fallbackUser);
            localStorage.setItem('user', JSON.stringify(fallbackUser));
            console.log('⚠️ Using fallback user due to safety timeout');
          }
          if (session?.user?.id) startBackgroundProfilePoller(session.user.id);
        }
        setIsLoading(false);
      }, 45000);

      const merchantSignupIntent = (() => {
        try {
          return localStorage.getItem(MERCHANT_SIGNUP_INTENT_KEY) === '1';
        } catch {
          return false;
        }
      })();

      try {
        console.log('🔄 Loading user profile for:', session.user.email);
        setToken(session.access_token);
        localStorage.setItem('authToken', session.access_token);
        try {
          if (session.user?.email) {
            localStorage.setItem('last-google-login-hint', session.user.email);
          }
        } catch {
          // best effort
        }
        
        // Get user profile with explicit timeout using Promise.race.
        const profilePromise = supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
          const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Profile fetch timeout after 35 seconds')), 35000);
        });
        
        let profile: any = null;
        let profileError: any = null;
        
        try {
          const profileResult = await Promise.race([profilePromise, timeoutPromise]);
          const result = profileResult as { data: any; error: any };
          profile = result.data;
          profileError = result.error;
          
          if (profileError && profileError.code !== 'PGRST116') {
            console.error('❌ Profile fetch error:', profileError);
            console.error('Profile error details:', {
              code: profileError.code,
              message: profileError.message,
              details: profileError.details,
            });
          }
        } catch (timeoutError: any) {
          console.error('❌ Profile fetch timeout:', timeoutError);
          profile = null;
          profileError = { code: 'TIMEOUT', message: 'Profile fetch timed out' };
        }

        // Timeout/gecici ağ sorununda "profil yok" varsayımına geçmeden önce
        // tek seferlik güvenli bir yeniden deneme yap.
        if (!profile && profileError?.code === 'TIMEOUT') {
          try {
            console.log('🔄 Retrying profile fetch after timeout...');
            const { data: retryProfile, error: retryError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (!retryError && retryProfile) {
              profile = retryProfile;
              profileError = null;
              console.log('✅ Profile fetch retry succeeded');
            } else {
              profileError = retryError || profileError;
              console.warn('⚠️ Profile fetch retry failed:', retryError);
            }
          } catch (retryErr) {
            console.error('❌ Profile fetch retry error:', retryErr);
          }
        }

        // Web/native session edge-case: when profile fetch times out we can end up
        // with a valid auth session but missing/undetected public users row.
        // Try to READ profile via direct REST first; only INSERT (never update) if truly missing.
        if (!profile && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          try {
            const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
            const sbKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
            const authToken = String(session?.access_token || '');
            const userMetadata = session.user.user_metadata || {};

            if (sbUrl && sbKey && authToken) {
              // Step 1: Try a direct REST read first (bypasses PostgREST client issues)
              const readController = new AbortController();
              const readTimer = setTimeout(() => readController.abort(), 10000);
              try {
                const readRes = await fetch(
                  `${sbUrl}/rest/v1/users?id=eq.${session.user.id}&select=*`,
                  {
                    headers: {
                      apikey: sbKey,
                      Authorization: `Bearer ${authToken}`,
                    },
                    signal: readController.signal,
                  }
                );
                clearTimeout(readTimer);
                if (readRes.ok) {
                  const rows = await readRes.json().catch(() => []);
                  const row = Array.isArray(rows) ? rows[0] : null;
                  if (row?.id) {
                    profile = row;
                    profileError = null;
                    console.log('✅ Profile read via direct REST (bypass)');
                  }
                }
              } catch (readErr) {
                clearTimeout(readTimer);
                console.warn('⚠️ Direct REST profile read failed:', readErr);
              }

              // Step 2: If still no profile, INSERT only (ignore-duplicates = never overwrite existing)
              if (!profile) {
                const insertPayload = {
                  id: session.user.id,
                  email: session.user.email || '',
                  name: userMetadata.name || userMetadata.full_name || session.user.email?.split('@')[0] || 'Kullanıcı',
                  avatar: userMetadata.avatar_url || userMetadata.picture || null,
                  google_id: userMetadata.provider === 'google' ? session.user.id : null,
                  is_guest: false,
                  is_merchant: merchantSignupIntent ? true : normalizeMerchantFlag(userMetadata.is_merchant),
                  search_radius: 15,
                  ...(merchantSignupIntent ? {
                    merchant_subscription_status: 'inactive',
                    merchant_subscription_plan: 'merchant_basic_500_tl_monthly',
                    merchant_subscription_fee_tl: 500,
                  } : {}),
                };

                const insertController = new AbortController();
                const insertTimer = setTimeout(() => insertController.abort(), 15000);
                const insertRes = await fetch(`${sbUrl}/rest/v1/users?on_conflict=id`, {
                  method: 'POST',
                  headers: {
                    apikey: sbKey,
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=ignore-duplicates,return=representation',
                  },
                  body: JSON.stringify(insertPayload),
                  signal: insertController.signal,
                });
                clearTimeout(insertTimer);

                if (insertRes.ok) {
                  const insertedRows = await insertRes.json().catch(() => []);
                  const insertedProfile = Array.isArray(insertedRows) ? insertedRows[0] : null;
                  if (insertedProfile?.id) {
                    profile = insertedProfile;
                    profileError = null;
                    console.log('✅ New profile created via REST insert');
                  } else {
                    // ignore-duplicates returns empty array for existing rows; re-read
                    try {
                      const reReadRes = await fetch(
                        `${sbUrl}/rest/v1/users?id=eq.${session.user.id}&select=*`,
                        {
                          headers: { apikey: sbKey, Authorization: `Bearer ${authToken}` },
                        }
                      );
                      if (reReadRes.ok) {
                        const reRows = await reReadRes.json().catch(() => []);
                        const reRow = Array.isArray(reRows) ? reRows[0] : null;
                        if (reRow?.id) {
                          profile = reRow;
                          profileError = null;
                          console.log('✅ Existing profile re-read after ignore-duplicates');
                        }
                      }
                    } catch {
                      // best effort
                    }
                  }
                } else {
                  const insertErr = await insertRes.text().catch(() => '');
                  console.warn('⚠️ Profile REST insert failed:', insertRes.status, insertErr);
                }
              }
            }
          } catch (ensureError) {
            console.warn('⚠️ Profile ensure fallback failed:', ensureError);
          }
        }
        
        // Only create profile when DB explicitly reports "row not found".
        if (!profile && profileError?.code === 'PGRST116' && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          console.log('⚠️ Profile not found, creating new profile for OAuth user...');
          const userMetadata = session.user.user_metadata || {};
          
          // Keep auth loading until authoritative profile write/read settles to avoid
          // rendering the wrong role-specific layout during account switches.
          
          // Prepare user data with explicit search_radius (must be integer, 1-1000)
          const newUserData = {
            id: session.user.id,
            email: session.user.email || '',
            name: userMetadata.name || userMetadata.full_name || session.user.email?.split('@')[0] || 'Kullanıcı',
            avatar: userMetadata.avatar_url || userMetadata.picture,
            google_id: userMetadata.provider === 'google' ? session.user.id : null,
            is_guest: false,
            is_merchant: merchantSignupIntent || normalizeMerchantFlag(userMetadata.is_merchant),
            search_radius: 15, // Default search radius (ensures constraint is satisfied: 1-1000)
            ...(merchantSignupIntent ? {
              merchant_subscription_status: 'inactive',
              merchant_subscription_plan: 'merchant_basic_500_tl_monthly',
              merchant_subscription_fee_tl: 500,
            } : {}),
          };
          
          console.log('📝 Creating OAuth user profile with data:', {
            ...newUserData,
            search_radius: newUserData.search_radius,
            search_radius_type: typeof newUserData.search_radius,
          });
          
          // Create profile in background with network-tolerant timeout
          const createPromise = supabase
            .from('users')
            .insert(newUserData)
            .select()
            .single();
          
          const createTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Profile creation timeout after 12 seconds')), 12000);
          });
          
          // Create profile in background - don't block UI
          Promise.race([createPromise, createTimeoutPromise])
            .then((createResult: any) => {
              const result = createResult as { data: any; error: any };
              if (!result.error && result.data) {
                console.log('✅ Profile created for OAuth user');
                updateUser(result.data);
                localStorage.setItem('user', JSON.stringify(result.data));
              } else {
                console.error('❌ Failed to create profile:', result.error);
              }
            })
            .catch((createTimeoutError: any) => {
              console.error('❌ Profile creation timeout:', createTimeoutError);
              // Fallback user already shown, no need to do anything
            });
        }
        
        clearTimeout(profileTimeout);
        
        if (profile) {
          // Check merchant_products for definitive merchant role evidence
          let hasMerchantProducts = false;
          try {
            const { data: merchantRows, error: merchantErr } = await supabase
              .from('merchant_products')
              .select('id')
              .eq('merchant_id', session.user.id)
              .limit(1);
            if (!merchantErr && Array.isArray(merchantRows) && merchantRows.length > 0) {
              hasMerchantProducts = true;
            }
          } catch {
            hasMerchantProducts = false;
          }

          // Merchant sign-up intent: elevate account to merchant
          if (merchantSignupIntent) {
            try {
              const merchantSetupUpdate = {
                is_merchant: true,
                merchant_subscription_status: 'inactive',
                merchant_subscription_plan: 'merchant_basic_500_tl_monthly',
                merchant_subscription_fee_tl: 500,
                merchant_subscription_current_period_start: null,
                merchant_subscription_current_period_end: null,
              };
              const { data: merchantProfile, error: merchantSetupError } = await supabase
                .from('users')
                .update(merchantSetupUpdate)
                .eq('id', session.user.id)
                .select('*')
                .single();

              if (!merchantSetupError && merchantProfile) {
                profile = merchantProfile;
                console.log('✅ Merchant sign-up intent applied after auth callback');
              } else if (merchantSetupError) {
                console.warn('⚠️ Could not apply merchant sign-up intent:', merchantSetupError);
              }
              localStorage.setItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY, session.user.id);
              localStorage.removeItem(MERCHANT_SIGNUP_INTENT_KEY);
            } catch (intentError) {
              console.warn('⚠️ Merchant sign-up intent handling failed:', intentError);
            }
          }

          const isMerchantFromProfile = resolveMerchantStatus(profile);
          const isMerchantFinal = isMerchantFromProfile || hasMerchantProducts;

          // AUTO-REPAIR: If merchant_products prove merchant role but DB flag is wrong, fix it
          if (hasMerchantProducts && !isMerchantFromProfile) {
            console.log('🔧 Auto-repairing is_merchant flag (merchant_products exist but is_merchant=false)');
            try {
              const { data: repairedProfile } = await supabase
                .from('users')
                .update({ is_merchant: true })
                .eq('id', session.user.id)
                .select('*')
                .single();
              if (repairedProfile) {
                profile = repairedProfile;
                console.log('✅ is_merchant auto-repaired to true');
              }
            } catch (repairErr) {
              console.warn('⚠️ is_merchant auto-repair failed:', repairErr);
            }
          }

          const preferencesRadius = profile.preferences?.searchRadius;
          const legacyRadius = profile.search_radius;
          const finalSearchRadius = preferencesRadius !== undefined 
            ? preferencesRadius 
            : (legacyRadius !== undefined ? legacyRadius : 15);
          
          const userData = {
            ...profile,
            is_merchant: isMerchantFinal,
            preferences: {
              ...(profile.preferences || {}),
              searchRadius: finalSearchRadius,
            },
            search_radius: finalSearchRadius,
          };
          
          updateUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          if (isMerchantFinal && userData.email) {
            try { localStorage.setItem('merchant-hint-' + userData.email, '1'); } catch {}
          } else if (!isMerchantFinal && userData.email) {
            try { localStorage.removeItem('merchant-hint-' + userData.email); } catch {}
          }
          console.log('✅ User profile loaded (authoritative):', {
            email: userData.email,
            is_merchant: userData.is_merchant,
            merchant_subscription_status: profile.merchant_subscription_status,
            merchant_subscription_plan: profile.merchant_subscription_plan,
            hasMerchantProducts,
          });
          setIsLoading(false);
        } else {
          // If BG poller already loaded authoritative profile, don't overwrite with stale fallback
          if (lastAuthoritativeProfileSyncAtRef.current > 0) {
            console.log('✅ Profile unavailable in main flow, but BG poller already synced - skipping fallback');
          } else {
            console.warn('⚠️ Profile still unavailable; using conservative fallback');
            const userMetadata = session.user.user_metadata || {};
            const currentUser = userRef.current;
            const hint = getMerchantHint(session.user.email);
            const preservedMerchant = currentUser?.id === session.user.id
              ? resolveMerchantStatus(currentUser)
              : (cachedUser?.id === session.user.id
                ? resolveMerchantStatus(cachedUser)
                : (hint || normalizeMerchantFlag(userMetadata?.is_merchant)));
            const fallbackUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: currentUser?.name || userMetadata.name || userMetadata.full_name || session.user.email?.split('@')[0] || 'Kullanıcı',
              avatar: currentUser?.avatar || userMetadata.avatar_url || userMetadata.picture,
              level: currentUser?.level || 1,
              points: currentUser?.points || 0,
              contributions: currentUser?.contributions || { shares: 0, verifications: 0 },
              isGuest: false,
              is_merchant: merchantSignupIntent || preservedMerchant,
              merchant_subscription_status: currentUser?.merchant_subscription_status,
              merchant_subscription_plan: currentUser?.merchant_subscription_plan,
              preferences: currentUser?.preferences || { notifications: true, searchRadius: 15 },
              search_radius: currentUser?.search_radius || 15,
            };
            if (merchantSignupIntent) {
              try {
                localStorage.setItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY, session.user.id);
                localStorage.removeItem(MERCHANT_SIGNUP_INTENT_KEY);
              } catch {}
            }
            updateUser(fallbackUser);
            localStorage.setItem('user', JSON.stringify(fallbackUser));
            console.log('⚠️ Using fallback user - profile not available, is_merchant:', fallbackUser.is_merchant);
            startBackgroundProfilePoller(session.user.id);
          }
        }
        
        setIsLoading(false);
        
        // Clean up OAuth callback URL - always go to root after OAuth
        if (shouldCleanUrl) {
          // Clean up hash fragments from URL first
          if (window.location.hash) {
            const cleanPath = window.location.pathname + window.location.search;
            window.history.replaceState({}, document.title, cleanPath);
            console.log('🧹 OAuth callback hash cleaned from URL');
          }
          // Then ensure we're on root path for navigation
          const appRootPath = getAppRootPath();
          if (window.location.pathname !== appRootPath) {
            window.history.replaceState({}, document.title, appRootPath);
            console.log('🧹 OAuth callback URL cleaned, redirected to root');
          }
        }
      } catch (error) {
        clearTimeout(profileTimeout);
        console.error('❌ Load user profile error:', error);
        if (session?.user) {
          if (lastAuthoritativeProfileSyncAtRef.current > 0) {
            console.log('✅ Error in main flow, but BG poller already synced - keeping current user');
          } else {
            const userMetadata = session.user.user_metadata || {};
            const currentUser = userRef.current;
            const hint = getMerchantHint(session.user.email);
            const preservedMerchant = currentUser?.id === session.user.id
              ? resolveMerchantStatus(currentUser)
              : (hint || normalizeMerchantFlag(userMetadata?.is_merchant));
            const fallbackUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: currentUser?.name || userMetadata.name || userMetadata.full_name || session.user.email?.split('@')[0] || 'Kullanıcı',
              avatar: currentUser?.avatar || userMetadata.avatar_url || userMetadata.picture,
              level: currentUser?.level || 1,
              points: currentUser?.points || 0,
              contributions: currentUser?.contributions || { shares: 0, verifications: 0 },
              isGuest: false,
              is_merchant: merchantSignupIntent || preservedMerchant,
              merchant_subscription_status: currentUser?.merchant_subscription_status,
              merchant_subscription_plan: currentUser?.merchant_subscription_plan,
              preferences: currentUser?.preferences || { notifications: true, searchRadius: 15 },
              search_radius: currentUser?.search_radius || 15,
            };
            if (merchantSignupIntent) {
              try {
                localStorage.setItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY, session.user.id);
                localStorage.removeItem(MERCHANT_SIGNUP_INTENT_KEY);
              } catch {}
            }
            updateUser(fallbackUser);
            localStorage.setItem('user', JSON.stringify(fallbackUser));
            console.log('⚠️ Using fallback user due to error, is_merchant:', fallbackUser.is_merchant);
            startBackgroundProfilePoller(session.user.id);
          }
        }
        setIsLoading(false);
      }
    };

    // Initial session check with timeout
    const initializeAuth = async () => {
      // Only explicit callback params should skip initial auth check.
      // Pending flag alone must not freeze app startup.
      if (hasExplicitOAuthCallback) {
        console.log('🔐 OAuth callback detected, skipping initial auth check - waiting for onAuthStateChange');
        // Don't set loading to false yet - wait for onAuthStateChange
        // Keep enough time for slower devices/networks during Google callback.
        setTimeout(async () => {
          if (isLoading && isOAuthCallbackRef.current) {
            // Recovery attempt: if session already exists, continue instead of dropping to login.
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                console.log('✅ OAuth timeout recovery: session found, continuing profile load');
                await loadUserProfile(session, 'INITIAL_SESSION', true);
                setIsOAuthCallback(false);
                isOAuthCallbackRef.current = false;
                return;
              }
            } catch (recoveryError) {
              console.warn('⚠️ OAuth timeout recovery failed:', recoveryError);
            }

            console.warn('⚠️ OAuth callback timeout - forcing loading to false');
            setIsLoading(false);
            setIsOAuthCallback(false);
            isOAuthCallbackRef.current = false;
            try {
              localStorage.removeItem('oauth-pending-ts');
            } catch {
              // best effort
            }
            toast.error('Google giriş zaman aşımına uğradı', {
              description: 'Bağlantı yavaş veya kesik olabilir. Lütfen tekrar deneyin.',
            });
          }
        }, 60000); // 60 second timeout for OAuth
        return;
      }

      // Safety timeout - force loading to false after network-tolerant window
      const safetyTimeout = setTimeout(() => {
        console.warn('⚠️ Auth initialization timeout - forcing loading to false');
        setIsLoading(false);
      }, 20000);

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        clearTimeout(safetyTimeout);
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setIsLoading(false);
          return;
        }

        if (session) {
          await loadUserProfile(session, 'INITIAL_SESSION', false);
        } else {
          // Check for guest user
          const token = localStorage.getItem('authToken');
          if (token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
            try {
              const { data: guestUser } = await supabase
                .from('users')
                .select('*')
                .eq('id', token)
                .eq('is_guest', true)
                .single();
              
              if (guestUser) {
                updateUser(guestUser);
                setIsLoading(false);
                return;
              }
            } catch (guestError) {
              console.error('Guest user check error:', guestError);
              // Continue to set loading false
            }
          }
          setIsLoading(false);
        }
      } catch (error) {
        clearTimeout(safetyTimeout);
        console.error('Auth initialization error:', error);
        setIsLoading(false);
      }
    };

    // Initialize auth
    initializeAuth();

    // Supabase session listener with timeout protection
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email);

      // Block all events during active logout to prevent auto re-login
      if (isLoggingOutRef.current) {
        console.log('🚫 Ignoring auth event during logout:', event);
        return;
      }

      const currentUser = userRef.current;
      const oauthInProgress = isOAuthCallbackRef.current;
      
      // Skip processing for routine events when user is already loaded
      // BUT: For merchant users, always reload to ensure is_merchant is correct
      // TOKEN_REFRESHED is normal and doesn't need profile reload if user already exists AND is not merchant
      if (event === 'TOKEN_REFRESHED' && currentUser && session) {
        const isCurrentUserMerchant = resolveMerchantStatus(currentUser);
        const shouldPeriodicRefreshOnToken =
          Date.now() - lastAuthoritativeProfileSyncAtRef.current > 3 * 60 * 1000;
        if (!isCurrentUserMerchant && !shouldPeriodicRefreshOnToken) {
          console.log('✅ Token refreshed, recent non-merchant profile - skipping reload');
          return;
        }
        console.log('🔄 Token refreshed - reloading profile for authoritative merchant status');
      }
      
      // Skip timeout for certain events that don't require profile loading
      // Only set timeout for events that actually need processing
      const needsProcessing = event === 'SIGNED_IN' || event === 'SIGNED_OUT' || 
                             (event === 'TOKEN_REFRESHED' && !currentUser) ||
                             (event === 'USER_UPDATED' && !currentUser);
      
      let stateChangeTimeout: NodeJS.Timeout | null = null;
      
      // Only set timeout if we actually need to process this event.
      if (needsProcessing) {
        stateChangeTimeout = setTimeout(() => {
          console.warn('⚠️ Auth state change timeout - forcing loading to false');
          const isSignInLike = (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user;
          if (isSignInLike) {
            if (!userRef.current) {
              const fallbackUser = createSessionFallbackUser(session, userRef.current);
              if (fallbackUser) {
                updateUser(fallbackUser as any);
                try {
                  localStorage.setItem('user', JSON.stringify(fallbackUser));
                } catch {
                  // best effort
                }
              }
            }
            if (lastAuthoritativeProfileSyncAtRef.current === 0) {
              startBackgroundProfilePoller(session.user.id);
            }
          }
          setIsLoading(false);
        }, 25000);
      }
      
      try {
        if (session) {
          // Store token IMMEDIATELY so BG poller and REST calls can authenticate
          if (session.access_token) {
            setToken(session.access_token);
            try { localStorage.setItem('authToken', session.access_token); } catch {}
          }

          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !userRef.current) {
            const fallbackUser = createSessionFallbackUser(session, userRef.current);
            if (fallbackUser) {
              updateUser(fallbackUser as any);
              try {
                localStorage.setItem('user', JSON.stringify(fallbackUser));
              } catch {
                // best effort
              }
            }
            startBackgroundProfilePoller(session.user.id);
          }
          try {
            localStorage.removeItem('oauth-pending-ts');
          } catch {
            // best effort
          }
          // Reload profile if:
          // 1. User is not already set
          // 2. It's a SIGNED_IN event
          // 3. It's TOKEN_REFRESHED and user is a merchant (to ensure is_merchant is correct)
          const userForReload = userRef.current;
          const isCurrentUserMerchant = userForReload ? resolveMerchantStatus(userForReload) : false;
          const shouldPeriodicRefreshOnToken = event === 'TOKEN_REFRESHED' &&
            (Date.now() - lastAuthoritativeProfileSyncAtRef.current > 3 * 60 * 1000);
          const shouldReload = !userForReload ||
                              event === 'INITIAL_SESSION' ||
                              event === 'SIGNED_IN' ||
                              event === 'USER_UPDATED' ||
                              userForReload.id !== session.user.id ||
                              (event === 'TOKEN_REFRESHED' && (isCurrentUserMerchant || shouldPeriodicRefreshOnToken));
          
          if (shouldReload) {
            setIsLoading(true); // Set loading during profile load
            const shouldCleanUrl = event === 'SIGNED_IN' || (event === 'TOKEN_REFRESHED' && oauthInProgress);
            await loadUserProfile(session, event, shouldCleanUrl);
            lastAuthoritativeProfileSyncAtRef.current = Date.now();
            // Authoritative second-pass refresh: prevents merchant users from
            // being stuck as normal users when first profile load falls back.
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED' || (event === 'TOKEN_REFRESHED' && !currentUser)) {
              setTimeout(() => {
                void refreshUser();
              }, 300);
            }
            
            // Profile loaded successfully - ensure URL is clean and trigger navigation
            const isLoginEvent = event === 'SIGNED_IN' || (event === 'TOKEN_REFRESHED' && !currentUser);
            if (isLoginEvent) {
              console.log('✅ OAuth login successful, profile loaded');
              // Clear OAuth callback flag
              setIsOAuthCallback(false);
              isOAuthCallbackRef.current = false;
              // Clean up hash fragments first
              if (window.location.hash) {
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                console.log('🧹 OAuth callback hash cleaned from URL');
              }
              // Clean up URL to root path to trigger AppRoutes navigation
              const appRootPath = getAppRootPath();
              if (window.location.pathname !== appRootPath) {
                window.history.replaceState({}, document.title, appRootPath);
              }
              // Minimal delay for state update (reduced from 200ms to 50ms)
              await new Promise(resolve => setTimeout(resolve, 50));
              // Force a re-render by updating state
              setIsLoading(false);
            }
          } else {
            // User already loaded, just clear timeout if set
            if (stateChangeTimeout) {
              clearTimeout(stateChangeTimeout);
            }
            console.log('✅ User already loaded, skipping profile reload');
          }
        } else {
          // Session is null - check if this is a real logout or just a temporary state
          // If we just loaded a user profile (SIGNED_IN event), don't clear it immediately
          if (event === 'SIGNED_OUT') {
            console.log('🚪 User signed out, clearing auth state');
            if (stateChangeTimeout) {
              clearTimeout(stateChangeTimeout);
            }
            setToken(null);
            updateUser(null);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            setIsLoading(false);
            setIsOAuthCallback(false);
            isOAuthCallbackRef.current = false;
            return;
          }
          
          // If INITIAL_SESSION with null session but OAuth callback is in progress, wait
          if (event === 'INITIAL_SESSION' && oauthInProgress) {
            console.log('🔐 INITIAL_SESSION with null session but OAuth callback in progress - waiting...');
            // Don't clear auth state yet - wait for SIGNED_IN event
            if (stateChangeTimeout) {
              clearTimeout(stateChangeTimeout);
            }
            // Keep loading state - will be set to false when SIGNED_IN event fires
            return;
          }
          
          // For other events (like TOKEN_REFRESHED with null session), check for guest user first
          const token = localStorage.getItem('authToken');
          if (token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
            try {
              const { data: guestUser } = await supabase
                .from('users')
                .select('*')
                .eq('id', token)
                .eq('is_guest', true)
                .single();
              
              if (guestUser) {
                if (stateChangeTimeout) {
                  clearTimeout(stateChangeTimeout);
                }
                updateUser(guestUser);
                setIsLoading(false);
                return;
              }
            } catch (guestError) {
              console.error('Guest user check error:', guestError);
              // Continue to check if we have a user in state
            }
          }
          
          // Only clear auth if we're sure there's no user
          console.log('⚠️ Session null and no user found, clearing auth state');
          if (stateChangeTimeout) {
            clearTimeout(stateChangeTimeout);
          }
          setToken(null);
          updateUser(null);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setIsLoading(false);
        }
      } catch (error) {
        if (stateChangeTimeout) {
          clearTimeout(stateChangeTimeout);
        }
        console.error('❌ Auth state change error:', error);
        setIsLoading(false);
      }
    });

    // Fallback: when setSession fails, App.tsx dispatches this event with JWT-derived user
    const handleFallbackLogin = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.user && detail?.token) {
        console.log('🔑 OAuth fallback login received');
        updateUser(detail.user);
        setToken(detail.token);
        try {
          localStorage.setItem('authToken', detail.token);
          localStorage.setItem('user', JSON.stringify(detail.user));
        } catch { /* best effort */ }
        setIsLoading(false);
        setIsOAuthCallback(false);
        isOAuthCallbackRef.current = false;
        if (detail.user.id) {
          startBackgroundProfilePoller(detail.user.id);
        }
      }
    };
    window.addEventListener('oauth-fallback-login', handleFallbackLogin);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('oauth-fallback-login', handleFallbackLogin);
    };
  }, []);

  const register = async (email: string, password: string, name: string, isMerchant: boolean = false) => {
    try {
      console.log('🔄 Starting registration...', { isMerchant });
      const data = await authAPI.register(email, password, name, isMerchant);
      console.log('✅ Registration API call successful');
      console.log('📦 User data:', data.user);
      console.log('🔑 Token:', data.token ? 'Present' : 'Missing');
      
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('authToken', data.token);
      }
      
      if (data.user) {
        updateUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('✅ User state updated in AuthContext');
      } else {
        console.warn('⚠️ No user data returned from registration');
      }
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('✅ Registration completed');
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const data = await authAPI.login(email, password);
      console.log('✅ Login successful, user data (auth API):', {
        id: data.user?.id,
        email: data.user?.email,
        is_merchant: (data.user as any)?.is_merchant,
      });

      // Store token immediately
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('authToken', data.token);
      }

      // Always set user immediately from auth API response.
      // This prevents stale non-merchant UI when refreshUser is delayed/fails.
      if (data.user) {
        updateUser(data.user as any);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      // Then refresh authoritative profile in background to reconcile any stale fields.
      try {
        console.log('🔄 Forcing profile refresh after login (refreshUser)...');
        await refreshUser();
        console.log('✅ refreshUser completed successfully after login');
      } catch (refreshErr) {
        console.error('❌ refreshUser failed after login:', refreshErr);
        console.warn('⚠️ Keeping auth API user snapshot as fallback state');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const googleLogin = async (options?: { merchantSignupIntent?: boolean; loginHint?: string }) => {
    try {
      const data = await authAPI.googleLogin(options);
      // Web flow redirects in current window; mobile flow is opened via Capacitor Browser.
      if (data.redirectUrl && !data.openedInBrowser) {
        window.location.href = data.redirectUrl;
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const guestLogin = async () => {
    try {
      const data = await authAPI.guestLogin();
      setToken(data.token);
      updateUser(data.user);
    } catch (error) {
      console.error('Guest login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    console.log('🚪 Logging out...');
    // Save merchant hint before clearing state so next login preserves role
    try {
      const currentUser = userRef.current;
      if (currentUser?.email && (currentUser.is_merchant || (currentUser as any).isMerchant)) {
        localStorage.setItem('merchant-hint-' + currentUser.email, '1');
      }
    } catch { /* best effort */ }

    isLoggingOutRef.current = true;

    if (bgProfilePollerRef.current) {
      clearInterval(bgProfilePollerRef.current);
      bgProfilePollerRef.current = null;
    }

    lastAuthoritativeProfileSyncAtRef.current = 0;
    setToken(null);
    updateUser(null);
    clearAuthStorage();
    setIsOAuthCallback(false);
    isOAuthCallbackRef.current = false;

    try {
      // Backend logout (best effort, short timeout)
      await Promise.race([
        authAPI.logout(),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {});

      // Supabase signOut (best effort, short timeout)
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => {});
    } catch (error) {
      console.error('❌ Logout error (non-critical):', error);
    } finally {
      // Re-clear storage in case signOut stored something
      clearAuthStorage();
      // Release the logout lock after a brief delay so any trailing events are blocked
      setTimeout(() => {
        isLoggingOutRef.current = false;
        console.log('✅ Logout complete, auth events unblocked');
      }, 1000);
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('⚠️ No session found for refreshUser');
        return;
      }
      
      // Fetch fresh user data from Supabase with retry to survive transient
      // mobile callback/session races.
      let profile: any = null;
      let error: any = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        profile = result.data;
        error = result.error;
        if (!error && profile) break;
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }

      if (error || !profile) {
        console.error('❌ Error refreshing user:', error || 'Profile not found');
        return;
      }

      // Merchant role can exist through active merchant products even if
      // profile flag arrives stale right after OAuth.
      let hasMerchantProducts = false;
      try {
        const { data: merchantRows, error: merchantErr } = await supabase
          .from('merchant_products')
          .select('id')
          .eq('merchant_id', session.user.id)
          .limit(1);
        if (!merchantErr && Array.isArray(merchantRows) && merchantRows.length > 0) {
          hasMerchantProducts = true;
        }
      } catch {
        hasMerchantProducts = false;
      }
      
      if (profile) {
        const isMerchantFromProfile = resolveMerchantStatus(profile);
        const isMerchantFinal = isMerchantFromProfile || hasMerchantProducts;

        // AUTO-REPAIR in refreshUser path too
        if (hasMerchantProducts && !isMerchantFromProfile) {
          console.log('🔧 refreshUser: Auto-repairing is_merchant flag');
          try {
            const { data: repairedProfile } = await supabase
              .from('users')
              .update({ is_merchant: true })
              .eq('id', session.user.id)
              .select('*')
              .single();
            if (repairedProfile) {
              profile = repairedProfile;
              console.log('✅ refreshUser: is_merchant auto-repaired');
            }
          } catch {
            // best effort repair
          }
        }

        const preferencesRadius = profile.preferences?.searchRadius;
        const legacyRadius = profile.search_radius;
        const finalSearchRadius = preferencesRadius !== undefined 
          ? preferencesRadius 
          : (legacyRadius !== undefined ? legacyRadius : 15);
        
        const userData = {
          ...profile,
          is_merchant: isMerchantFinal,
          preferences: {
            ...(profile.preferences || {}),
            searchRadius: finalSearchRadius,
          },
          search_radius: finalSearchRadius,
        };
        updateUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        lastAuthoritativeProfileSyncAtRef.current = Date.now();
        if (isMerchantFinal && userData.email) {
          try { localStorage.setItem('merchant-hint-' + userData.email, '1'); } catch {}
        } else if (!isMerchantFinal && userData.email) {
          try { localStorage.removeItem('merchant-hint-' + userData.email); } catch {}
        }
        console.log('✅ User refreshed (authoritative):', {
          email: userData.email,
          is_merchant: userData.is_merchant,
          merchant_subscription_status: profile.merchant_subscription_status,
          hasMerchantProducts,
        });
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, register, login, googleLogin, guestLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During live-reload, context might not be available yet - return a safe fallback
    if (import.meta.env.DEV) {
      console.warn('useAuth called outside AuthProvider - this might be a live-reload issue');
      // Return a safe fallback during development (live reload)
      return {
        user: null,
        token: null,
        isLoading: true,
        register: async () => {},
        login: async () => {},
        googleLogin: async () => {},
        guestLogin: async () => {},
        logout: () => {},
        refreshUser: async () => {},
      };
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

