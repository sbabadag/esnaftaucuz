import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authAPI } from '../services/supabase-api';
import { supabase } from '../lib/supabase';

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
  googleLogin: () => Promise<void>;
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

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    isOAuthCallbackRef.current = isOAuthCallback;
  }, [isOAuthCallback]);

  useEffect(() => {
    // Check for OAuth callback in URL (Supabase adds hash fragments)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const code = hashParams.get('code');
    const error = hashParams.get('error');
    
    if (error) {
      console.error('OAuth error in URL:', error);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsLoading(false);
      setIsOAuthCallback(false);
      isOAuthCallbackRef.current = false;
      return;
    }
    
    // If OAuth callback detected, keep loading until session is processed
    const hasOAuthCallback = !!(accessToken || code);
    setIsOAuthCallback(hasOAuthCallback);
    isOAuthCallbackRef.current = hasOAuthCallback;
    
    if (hasOAuthCallback) {
      console.log('🔐 OAuth callback detected in URL');
      // Keep loading state - will be set to false after profile is loaded
      // Don't clean URL yet - let Supabase process it first
    }

    // Load user profile helper with timeout protection
    const loadUserProfile = async (session: any, event: string, shouldCleanUrl: boolean = false) => {
      // Create fallback user helper
      const createFallbackUser = () => {
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
          is_merchant: false,
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
        const fallbackUser = createFallbackUser();
        if (fallbackUser) {
          setUser(fallbackUser);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
          console.log('⚠️ Using fallback user due to safety timeout');
        }
        setIsLoading(false);
      }, 8000); // 8 seconds safety timeout (reduced from 15)

      try {
        console.log('🔄 Loading user profile for:', session.user.email);
        setToken(session.access_token);
        localStorage.setItem('authToken', session.access_token);
        
        // Check localStorage first for faster initial render
        // BUT: Always reload from database to ensure is_merchant is correct
        // Don't use cached user for merchant users - always fetch fresh
        let storedUser: string | null = null;
        let cachedUser: any = null;
        try {
          storedUser = localStorage.getItem('user');
          if (storedUser) {
            cachedUser = JSON.parse(storedUser);
            // Use cached user for immediate UI responsiveness when available
            // (even for merchant users) and refresh in background to ensure correctness.
            if (cachedUser && cachedUser.id === session.user.id) {
              console.log('⚡ Using cached user from localStorage for faster render');
              setUser(cachedUser);
              setIsLoading(false); // Allow navigation immediately while we refresh profile in background
            }
          }
        } catch (e) {
          // Invalid JSON, continue with fetch
          storedUser = null;
          cachedUser = null;
        }
        
        // Get user profile with explicit timeout using Promise.race (reduced from 10s to 5s)
        const profilePromise = supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Profile fetch timeout after 5 seconds')), 5000);
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
        
        // If profile doesn't exist (e.g., Google OAuth new user), create it
        if (!profile && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          console.log('⚠️ Profile not found, creating new profile for OAuth user...');
          const userMetadata = session.user.user_metadata || {};
          
          // Show fallback user immediately for better UX
          const fallbackUser = createFallbackUser();
          if (fallbackUser) {
            console.log('⚡ Showing fallback user immediately while creating profile...');
            setUser(fallbackUser);
            localStorage.setItem('user', JSON.stringify(fallbackUser));
            setIsLoading(false); // Allow navigation to proceed
            profile = fallbackUser; // Set profile so we can update it later
          }
          
          // Prepare user data with explicit search_radius (must be integer, 1-1000)
          const newUserData = {
            id: session.user.id,
            email: session.user.email || '',
            name: userMetadata.name || userMetadata.full_name || session.user.email?.split('@')[0] || 'Kullanıcı',
            avatar: userMetadata.avatar_url || userMetadata.picture,
            google_id: userMetadata.provider === 'google' ? session.user.id : null,
            is_guest: false,
            search_radius: 15, // Default search radius (ensures constraint is satisfied: 1-1000)
          };
          
          console.log('📝 Creating OAuth user profile with data:', {
            ...newUserData,
            search_radius: newUserData.search_radius,
            search_radius_type: typeof newUserData.search_radius,
          });
          
          // Create profile in background (reduced timeout from 10s to 5s)
          const createPromise = supabase
            .from('users')
            .insert(newUserData)
            .select()
            .single();
          
          const createTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Profile creation timeout after 5 seconds')), 5000);
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
          // Ensure preferences and search_radius are properly set
          // Priority: preferences.searchRadius (newer) > search_radius (legacy) > default
          const preferencesRadius = profile.preferences?.searchRadius;
          const legacyRadius = profile.search_radius;
          const finalSearchRadius = preferencesRadius !== undefined 
            ? preferencesRadius 
            : (legacyRadius !== undefined ? legacyRadius : 15);
          
          const userData = {
            ...profile,
            is_merchant: profile.is_merchant || false, // Ensure is_merchant is included
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
          console.warn('⚠️ No profile found and could not create one');
          // Even if profile creation failed, create a fallback user
          const userMetadata = session.user.user_metadata || {};
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
            is_merchant: false,
            preferences: {
              notifications: true,
              searchRadius: 15,
            },
            search_radius: 15,
          };
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
          if (window.location.pathname !== '/') {
            window.history.replaceState({}, document.title, '/');
            console.log('🧹 OAuth callback URL cleaned, redirected to root');
          }
        }
      } catch (error) {
        clearTimeout(profileTimeout);
        console.error('❌ Load user profile error:', error);
        // Even on error, try to set user from session
        if (session?.user) {
          const userMetadata = session.user.user_metadata || {};
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
            preferences: {
              notifications: true,
              searchRadius: 15, // Default search radius
            },
            search_radius: 15, // Legacy column for backward compatibility
          };
          setUser(fallbackUser);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
          console.log('⚠️ Using fallback user due to error');
        }
        setIsLoading(false);
      }
    };

    // Initial session check with timeout
    const initializeAuth = async () => {
      // If OAuth callback detected, skip initial auth check
      // onAuthStateChange will handle it
      if (hasOAuthCallback) {
        console.log('🔐 OAuth callback detected, skipping initial auth check - waiting for onAuthStateChange');
        // Don't set loading to false yet - wait for onAuthStateChange
        // Set a timeout for OAuth callback (reduced from 30s to 15s)
        setTimeout(() => {
          if (isLoading && isOAuthCallbackRef.current) {
            console.warn('⚠️ OAuth callback timeout - forcing loading to false');
            setIsLoading(false);
            setIsOAuthCallback(false);
            isOAuthCallbackRef.current = false;
          }
        }, 15000); // 15 second timeout for OAuth (reduced from 30)
        return;
      }

      // Safety timeout - force loading to false after 8 seconds (reduced from 15)
      const safetyTimeout = setTimeout(() => {
        console.warn('⚠️ Auth initialization timeout - forcing loading to false');
        setIsLoading(false);
      }, 8000);

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
      
      // Only set timeout if we actually need to process this event (reduced from 25s to 12s)
      if (needsProcessing) {
        stateChangeTimeout = setTimeout(() => {
          console.warn('⚠️ Auth state change timeout - forcing loading to false');
          setIsLoading(false);
        }, 12000);
      }
      
      try {
        if (session) {
          // Reload profile if:
          // 1. User is not already set
          // 2. It's a SIGNED_IN event
          // 3. It's TOKEN_REFRESHED and user is a merchant (to ensure is_merchant is correct)
          const userForReload = userRef.current;
          const isCurrentUserMerchant = userForReload ? (userForReload as any)?.is_merchant === true : false;
          const shouldReload = !userForReload || 
                              event === 'SIGNED_IN' || 
                              (event === 'TOKEN_REFRESHED' && isCurrentUserMerchant);
          
          if (shouldReload) {
            setIsLoading(true); // Set loading during profile load
            const shouldCleanUrl = event === 'SIGNED_IN' || (event === 'TOKEN_REFRESHED' && oauthInProgress);
            await loadUserProfile(session, event, shouldCleanUrl);
            
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
              if (window.location.pathname !== '/') {
                window.history.replaceState({}, document.title, '/');
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
          
          // If we have a user in state and localStorage, don't clear it
          // This might be a temporary session issue
          // BUT: For merchant users, try to reload from database to ensure is_merchant is correct
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              if (parsedUser && parsedUser.id) {
                const isStoredUserMerchant = parsedUser.is_merchant === true;
                console.log('⚠️ Session null but user exists in storage, keeping user state', {
                  is_merchant: isStoredUserMerchant,
                });
                
                // For merchant users, try to reload from database if session becomes available
                if (isStoredUserMerchant) {
                  console.log('🔄 Merchant user detected - will reload profile when session is available');
                  // Don't set user yet - wait for session to reload
                } else {
                  if (stateChangeTimeout) {
                    clearTimeout(stateChangeTimeout);
                  }
                  setUser(parsedUser);
                  setIsLoading(false);
                  return;
                }
              }
            } catch (e) {
              console.error('Failed to parse stored user:', e);
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

      // Ensure we refresh the authoritative user profile from the database
      // before returning from login. This guarantees user.is_merchant is correct.
      try {
        console.log('🔄 Forcing profile refresh after login (refreshUser)...');
        await refreshUser();
        console.log('✅ refreshUser completed successfully after login');
        return;
      } catch (refreshErr) {
        console.error('❌ refreshUser failed after login:', refreshErr);
        // Fallback to API response if refresh failed
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
          console.warn('⚠️ Using API response data as fallback for user state');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const googleLogin = async () => {
    try {
      const data = await authAPI.googleLogin();
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
    try {
      console.log('🚪 Logging out...');
      // Sign out from Supabase
      await authAPI.logout();
      // Clear local state
      setToken(null);
      setUser(null);
      // Clear localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if logout fails, clear local state
      setToken(null);
      setUser(null);
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('⚠️ No session found for refreshUser');
        return;
      }
      
      // Fetch fresh user data from Supabase
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (error) {
        console.error('❌ Error refreshing user:', error);
        return;
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
          is_merchant: profile.is_merchant || false, // Ensure is_merchant is included
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

