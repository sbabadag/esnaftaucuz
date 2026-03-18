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
      localStorage.removeItem(MERCHANT_SIGNUP_INTENT_KEY);
      localStorage.removeItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY);
      // Supabase session keys are stored under sb-...-auth-token on web.
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          (key.startsWith('sb-') && key.includes('auth-token')) ||
          key.startsWith('supabase.auth.')
        ) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors; best effort cleanup.
    }
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

      // Create fallback user helper
      const createFallbackUser = (cachedUser?: any) => {
        if (cachedUser?.id === session?.user?.id) {
          // Prefer cached profile shape for role/theme stability during transient timeouts.
          return cachedUser;
        }
        if (!session?.user) return null;
        const userMetadata = session.user.user_metadata || {};
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
          is_merchant: normalizeMerchantFlag(userMetadata.is_merchant),
          preferences: {
            notifications: true,
            searchRadius: 15, // Default search radius
          },
          search_radius: 15, // Legacy column for backward compatibility
        };
      };

      // Safety timeout - force loading to false after 8 seconds (reduced from 15)
      const profileTimeout = setTimeout(() => {
        console.warn('⚠️ Profile load safety timeout - forcing loading to false');
        const fallbackUser = createFallbackUser(cachedUser);
        if (fallbackUser) {
          setUser(fallbackUser);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
          console.log('⚠️ Using fallback user due to safety timeout');
        }
        setIsLoading(false);
      }, 20000); // Network-tolerant safety timeout

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
          setTimeout(() => reject(new Error('Profile fetch timeout after 20 seconds')), 20000);
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
        // Ensure the profile row exists using direct REST upsert with current token.
        if (!profile && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          try {
            const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
            const sbKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
            const authToken = String(session?.access_token || '');
            const userMetadata = session.user.user_metadata || {};

            if (sbUrl && sbKey && authToken) {
              const ensurePayload = {
                id: session.user.id,
                email: session.user.email || '',
                name: userMetadata.name || userMetadata.full_name || session.user.email?.split('@')[0] || 'Kullanıcı',
                avatar: userMetadata.avatar_url || userMetadata.picture || null,
                google_id: userMetadata.provider === 'google' ? session.user.id : null,
                is_guest: false,
                is_merchant: merchantSignupIntent || normalizeMerchantFlag(userMetadata.is_merchant),
                search_radius: 15,
                ...(merchantSignupIntent ? {
                  merchant_subscription_status: 'inactive',
                  merchant_subscription_plan: 'merchant_basic_500_tl_monthly',
                  merchant_subscription_fee_tl: 500,
                } : {}),
              };

              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 15000);
              const ensureResponse = await fetch(`${sbUrl}/rest/v1/users?on_conflict=id`, {
                method: 'POST',
                headers: {
                  apikey: sbKey,
                  Authorization: `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                  Prefer: 'resolution=merge-duplicates,return=representation',
                },
                body: JSON.stringify(ensurePayload),
                signal: controller.signal,
              });
              clearTimeout(timer);

              if (ensureResponse.ok) {
                const ensuredRows = await ensureResponse.json().catch(() => []);
                const ensuredProfile = Array.isArray(ensuredRows) ? ensuredRows[0] : null;
                if (ensuredProfile?.id) {
                  profile = ensuredProfile;
                  profileError = null;
                  console.log('✅ Profile ensured via REST upsert');
                }
              } else {
                const ensureErr = await ensureResponse.text().catch(() => '');
                console.warn('⚠️ Profile ensure REST upsert failed:', ensureResponse.status, ensureErr);
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
                // Update user with fresh profile data
                setUser(result.data);
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
          // If user explicitly started "merchant sign-up" from login screen (including Google OAuth),
          // elevate account to merchant and force subscription onboarding.
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

          // Ensure preferences and search_radius are properly set
          // Priority: preferences.searchRadius (newer) > search_radius (legacy) > default
          const preferencesRadius = profile.preferences?.searchRadius;
          const legacyRadius = profile.search_radius;
          const finalSearchRadius = preferencesRadius !== undefined 
            ? preferencesRadius 
            : (legacyRadius !== undefined ? legacyRadius : 15);
          
          const userData = {
            ...profile,
            is_merchant: resolveMerchantStatus(profile),
            preferences: {
              ...(profile.preferences || {}),
              searchRadius: finalSearchRadius, // Ensure preferences.searchRadius is always set
            },
            search_radius: finalSearchRadius, // Keep legacy column for backward compatibility
          };
          
          // Always update user if profile is loaded - ensure is_merchant is always fresh
          // This is critical for merchant users to maintain blue theme
              const shouldUpdate = !cachedUser || 
                              profile.id !== cachedUser.id || 
                              (cachedUser.is_merchant !== userData.is_merchant) ||
                              (userData.preferences && Object.keys(userData.preferences).length > 0);
          
          if (shouldUpdate) {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('✅ User profile loaded/updated with settings:', {
              email: userData.email,
              is_merchant: userData.is_merchant,
              was_cached: !!cachedUser,
              cached_is_merchant: cachedUser?.is_merchant,
              preferences: userData.preferences,
              search_radius: userData.search_radius,
            });
          } else {
            console.log('✅ User profile already cached and up-to-date');
          }
          setIsLoading(false); // Always set loading false when profile is loaded
        } else {
          console.warn('⚠️ Profile still unavailable after fetch/retry; using conservative fallback');
          // Even if profile creation failed, create a fallback user
          const userMetadata = session.user.user_metadata || {};
          const preservedMerchant = cachedUser?.id === session.user.id
            ? normalizeMerchantFlag(cachedUser?.is_merchant)
            : normalizeMerchantFlag(userMetadata?.is_merchant);
          const fallbackUser = {
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
            is_merchant: merchantSignupIntent || preservedMerchant,
            preferences: {
              notifications: true,
              searchRadius: 15,
            },
            search_radius: 15,
          };
          if (merchantSignupIntent) {
            try {
              localStorage.setItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY, session.user.id);
              localStorage.removeItem(MERCHANT_SIGNUP_INTENT_KEY);
            } catch {
              // best effort
            }
          }
          setUser(fallbackUser);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
          console.log('⚠️ Using fallback user - profile not available');
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
        // Even on error, try to set user from session
        if (session?.user) {
          const userMetadata = session.user.user_metadata || {};
          const preservedMerchant = cachedUser?.id === session.user.id
            ? normalizeMerchantFlag(cachedUser?.is_merchant)
            : normalizeMerchantFlag(userMetadata?.is_merchant);
          const fallbackUser = {
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
            is_merchant: merchantSignupIntent || preservedMerchant,
            preferences: {
              notifications: true,
              searchRadius: 15, // Default search radius
            },
            search_radius: 15, // Legacy column for backward compatibility
          };
          if (merchantSignupIntent) {
            try {
              localStorage.setItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY, session.user.id);
              localStorage.removeItem(MERCHANT_SIGNUP_INTENT_KEY);
            } catch {
              // best effort
            }
          }
          setUser(fallbackUser);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
          console.log('⚠️ Using fallback user due to error');
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
                setUser(guestUser);
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
      const currentUser = userRef.current;
      const oauthInProgress = isOAuthCallbackRef.current;
      
      // Skip processing for routine events when user is already loaded
      // BUT: For merchant users, always reload to ensure is_merchant is correct
      // TOKEN_REFRESHED is normal and doesn't need profile reload if user already exists AND is not merchant
      if (event === 'TOKEN_REFRESHED' && currentUser && session) {
        // For merchant users, always reload profile to ensure is_merchant is correct
        const isCurrentUserMerchant = (currentUser as any)?.is_merchant === true;
        if (!isCurrentUserMerchant) {
          console.log('✅ Token refreshed, user already loaded (non-merchant) - skipping profile reload');
          return; // Early return, no processing needed
        } else {
          console.log('🔄 Token refreshed, merchant user detected - reloading profile to ensure is_merchant is correct');
          // Continue to reload profile for merchant users
        }
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
          setIsLoading(false);
        }, 25000);
      }
      
      try {
        if (session) {
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
          const isCurrentUserMerchant = userForReload ? (userForReload as any)?.is_merchant === true : false;
          const shouldReload = !userForReload ||
                              event === 'SIGNED_IN' ||
                              event === 'USER_UPDATED' ||
                              userForReload.id !== session.user.id ||
                              (event === 'TOKEN_REFRESHED' && isCurrentUserMerchant);
          
          if (shouldReload) {
            setIsLoading(true); // Set loading during profile load
            const shouldCleanUrl = event === 'SIGNED_IN' || (event === 'TOKEN_REFRESHED' && oauthInProgress);
            await loadUserProfile(session, event, shouldCleanUrl);
            // Authoritative second-pass refresh: prevents merchant users from
            // being stuck as normal users when first profile load falls back.
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
              setTimeout(() => {
                void refreshUser();
              }, 300);
            }
            
            // Profile loaded successfully - ensure URL is clean and trigger navigation
            if (event === 'SIGNED_IN') {
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
            setUser(null);
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
                setUser(guestUser);
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
          setUser(null);
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

    return () => subscription.unsubscribe();
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
        setUser(data.user);
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
        setUser(data.user as any);
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
      setUser(data.user);
    } catch (error) {
      console.error('Guest login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    const safeSignOut = async (scope: 'local' | 'global') => {
      await Promise.race([
        supabase.auth.signOut({ scope }),
        new Promise<void>((resolve) => setTimeout(resolve, 2500)),
      ]).catch(() => undefined);
    };

    try {
      console.log('🚪 Logging out...');
      // Sign out from Supabase, but never block logout UX indefinitely.
      await Promise.race([
        authAPI.logout(),
        new Promise<void>((resolve) => setTimeout(resolve, 4500)),
      ]);
      // Ensure both local and remote sessions are requested to sign out, without hanging UI.
      await safeSignOut('local');
      await safeSignOut('global');
      // Clear local state/storage no matter what.
      setToken(null);
      setUser(null);
      clearAuthStorage();
      setIsOAuthCallback(false);
      isOAuthCallbackRef.current = false;
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if logout fails, force local state cleanup.
      await safeSignOut('local');
      setToken(null);
      setUser(null);
      clearAuthStorage();
      setIsOAuthCallback(false);
      isOAuthCallbackRef.current = false;
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
        // Ensure preferences and search_radius are properly set
        // Priority: preferences.searchRadius (newer) > search_radius (legacy) > default
        const preferencesRadius = profile.preferences?.searchRadius;
        const legacyRadius = profile.search_radius;
        const finalSearchRadius = preferencesRadius !== undefined 
          ? preferencesRadius 
          : (legacyRadius !== undefined ? legacyRadius : 15);
        
        const userData = {
          ...profile,
          is_merchant: resolveMerchantStatus(profile) || hasMerchantProducts,
          preferences: {
            ...(profile.preferences || {}),
            searchRadius: finalSearchRadius, // Ensure preferences.searchRadius is always set
          },
          search_radius: finalSearchRadius, // Keep legacy column for backward compatibility
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        console.log('✅ User refreshed with settings:', {
          email: userData.email,
          is_merchant: userData.is_merchant,
          preferences: userData.preferences,
          search_radius: userData.search_radius,
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

