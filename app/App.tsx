import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SplashScreen from './components/screens/SplashScreen';
import OnboardingScreen from './components/screens/OnboardingScreen';
import LoginScreen from './components/screens/LoginScreen';
import MainApp from './components/screens/MainApp';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './lib/supabase';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { asUuidOrNull, isLikelyJwt, normalizePushEvent } from './lib/push-notification-utils';

// Protected route wrapper - redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-gray-500">Yükleniyor...</div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// App routes component (needs to be inside AuthProvider)
function AppRoutes() {
  const { user, isLoading } = useAuth(); // useAuth handles live-reload cases internally
  const location = useLocation();
  const navigate = useNavigate();
  const OAUTH_PENDING_MAX_AGE_MS = 2 * 60 * 1000;
  const oauthPendingTs = (() => {
    try {
      return Number(localStorage.getItem('oauth-pending-ts') || '0');
    } catch {
      return 0;
    }
  })();
  const hasRecentOAuthPending = oauthPendingTs > 0 && (Date.now() - oauthPendingTs) < OAUTH_PENDING_MAX_AGE_MS;
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('hasSeenOnboarding') === 'true';
  });
  const [showLoggedInLaunchIntro, setShowLoggedInLaunchIntro] = useState(false);
  const [loggedInIntroShown, setLoggedInIntroShown] = useState(false);
  const checkoutParams = new URLSearchParams(location.search);
  const checkoutStatus = checkoutParams.get('checkout');
  const hasCheckoutRedirect = checkoutStatus === 'success' || checkoutStatus === 'cancel';

  useEffect(() => {
    if (!user || isLoading || loggedInIntroShown) return;

    setShowLoggedInLaunchIntro(true);
    setLoggedInIntroShown(true);
    const timer = setTimeout(() => {
      setShowLoggedInLaunchIntro(false);
    }, 5200);

    return () => clearTimeout(timer);
  }, [user, isLoading, loggedInIntroShown]);

  useEffect(() => {
    if (user) return;
    setShowLoggedInLaunchIntro(false);
    setLoggedInIntroShown(false);
  }, [user]);

  // Handle OAuth callback redirect - if user is logged in and on root, redirect to explore
  useEffect(() => {
    console.log('🔍 AppRoutes useEffect - user:', user ? user.email : 'null', 'isLoading:', isLoading, 'pathname:', location.pathname);
    
    // Check if this is an OAuth callback (has hash fragments with access_token)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasExplicitOAuthCallback = hashParams.has('access_token') || hashParams.has('code');
    const isOAuthCallback = hasExplicitOAuthCallback || hasRecentOAuthPending;
    
    if (isOAuthCallback && isLoading) {
      console.log('🔐 OAuth callback detected, waiting for user to load...');
      // Don't navigate yet, wait for user to be loaded
      return;
    }
    
    if (user && !isLoading) {
      if (hasCheckoutRedirect) {
        console.log('💳 Checkout redirect detected, routing to merchant subscription');
        navigate(`/app/merchant-subscription${location.search}`, { replace: true });
        return;
      }
      // If user is logged in and on root or login page, redirect to explore
      if (location.pathname === '/' || location.pathname === '/login') {
        console.log('✅ User logged in, redirecting to /app/explore');
        navigate('/app/explore', { replace: true });
      }
      return;
    }

    if (!user && !isLoading && location.pathname.startsWith('/app') && !hasExplicitOAuthCallback) {
      navigate('/login', { replace: true });
    }
  }, [user, isLoading, location.pathname, location.search, hasCheckoutRedirect, hasRecentOAuthPending, navigate]);

  // Check if this is an OAuth callback - if so, keep loading until user is ready
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const hasExplicitOAuthCallback = hashParams.has('access_token') || hashParams.has('code');
  const isOAuthCallback = hasExplicitOAuthCallback || hasRecentOAuthPending;
  
  // If OAuth callback is in progress, show loading
  if (isOAuthCallback && isLoading) {
    console.log('🔐 OAuth callback in progress, showing loading...');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-500">Giriş yapılıyor...</div>
      </div>
    );
  }
  
  // If user is already logged in, redirect to main app
  // Also handle OAuth callback - if we're on root with a user, redirect to explore
  if (user && !isLoading) {
    console.log('✅ AppRoutes: User is logged in, rendering main app routes');
    // If we're on root path and user is logged in, redirect to explore
    if (location.pathname === '/' || location.pathname === '/login') {
      if (hasCheckoutRedirect) {
        console.log('💳 AppRoutes: Redirecting checkout callback to /app/merchant-subscription');
        return <Navigate to={`/app/merchant-subscription${location.search}`} replace />;
      }
      console.log('✅ AppRoutes: Redirecting from root/login to /app/explore');
      return <Navigate to="/app/explore" replace />;
    }
    
    return (
      <Routes>
        <Route path="/app/*" element={<MainApp key={`${user.id}:${(user as any)?.is_merchant ? 'merchant' : 'normal'}`} />} />
        <Route path="*" element={<Navigate to="/app/explore" replace />} />
      </Routes>
    );
  }
  
  // Debug log for when user is not logged in
  if (!isLoading && !user) {
    console.log('⚠️ AppRoutes: No user, showing auth flow');
  }

  // If still loading auth state, show loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (showLoggedInLaunchIntro) {
    return <SplashScreen autoNavigateToOnboarding={false} />;
  }

  const handleOnboardingComplete = () => {
    setHasSeenOnboarding(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenOnboarding', 'true');
    }
  };

  // If not authenticated, show auth flow
  return (
    <Routes>
      <Route path="/" element={<Navigate to={hasSeenOnboarding ? "/login" : "/onboarding"} replace />} />
      <Route 
        path="/onboarding" 
        element={hasSeenOnboarding ? <Navigate to="/login" replace /> : <OnboardingScreen onComplete={handleOnboardingComplete} />} 
      />
      <Route 
        path="/login" 
        element={<LoginScreen onLogin={() => {}} />} 
      />
      <Route path="/app/*" element={<ProtectedRoute><MainApp key={user?.id || 'anon'} /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    const OAUTH_PENDING_KEY = 'oauth-pending-ts';
    const MERCHANT_SIGNUP_INTENT_KEY = 'merchant-signup-intent';
    const MERCHANT_SUBSCRIPTION_ONBOARDING_KEY = 'merchant-subscription-onboarding-user';
    const getAppRootPath = () => {
      const normalize = (value: string) => {
        let out = String(value || '/').trim();
        if (!out.startsWith('/')) out = `/${out}`;
        if (!out.endsWith('/')) out = `${out}/`;
        return out.replace(/\/{2,}/g, '/');
      };
      const configuredBase = normalize(String(import.meta.env.BASE_URL || '/'));
      if (configuredBase !== '/') return configuredBase;
      const pathname = String(window.location.pathname || '/');
      if (pathname.startsWith('/esnaftaucuz/')) return '/esnaftaucuz/';
      if (pathname === '/esnaftaucuz') return '/esnaftaucuz/';
      return '/';
    };
    const markOAuthPending = () => {
      try {
        localStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()));
      } catch {
        // best effort
      }
    };
    const clearOAuthPending = () => {
      try {
        localStorage.removeItem(OAUTH_PENDING_KEY);
      } catch {
        // best effort
      }
    };

    let pushActionListener: any = null;
    const pendingQueueKey = 'pending_push_events_v1';
    const trySyncPushImmediately = async (normalized: any) => {
      try {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const token = localStorage.getItem('authToken') || '';
        if (!sbUrl || !sbKey || !isLikelyJwt(token)) return;
        const pd = normalized?.data || {};
        const productId = asUuidOrNull(pd?.product_id || pd?.productId);
        const priceId = asUuidOrNull(pd?.price_id || pd?.priceId);
        await fetch(`${sbUrl}/functions/v1/sync-notification-from-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: sbKey,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            notification_id: normalized?.id,
            type: pd?.type || 'other',
            title: normalized?.title || 'Bildirim',
            message: normalized?.body || 'Yeni bildirim var.',
            product_id: productId,
            price_id: priceId,
          }),
        }).catch(() => null);
      } catch {
        // ignore best-effort sync errors here
      }
    };
    const enqueuePendingPushEvent = (normalized: any) => {
      try {
        const raw = localStorage.getItem(pendingQueueKey);
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        const exists = list.some((item: any) =>
          (normalized?.id && item?.id === normalized.id) ||
          (
            String(item?.title || '') === String(normalized?.title || '') &&
            String(item?.body || '') === String(normalized?.body || '')
          )
        );
        if (exists) return;
        localStorage.setItem(
          pendingQueueKey,
          JSON.stringify([normalized, ...list].slice(0, 100))
        );
      } catch {
        // ignore queue storage errors
      }
    };
    const registerGlobalPushActionListener = async () => {
      const isNative = typeof window !== 'undefined' &&
        (window as any).Capacitor?.isNativePlatform &&
        (window as any).Capacitor.isNativePlatform();
      if (!isNative) return;
      try {
        pushActionListener = await FirebaseMessaging.addListener('notificationActionPerformed', async (event: any) => {
          const normalized = normalizePushEvent(event);
          try {
            localStorage.setItem('pending_push_route', 'notifications');
          } catch {
            // ignore storage errors
          }
          enqueuePendingPushEvent(normalized);
          try {
            localStorage.setItem('pending_push_payload', JSON.stringify(normalized));
          } catch {
            // ignore payload serialization errors
          }
          await trySyncPushImmediately(normalized);
        });
      } catch (e) {
        console.warn('Global push action listener registration failed:', e);
      }
    };
    registerGlobalPushActionListener();

    // Handle deep links and OAuth callbacks on mobile
    const isMobile = typeof window !== 'undefined' && 
      (window as any).Capacitor?.isNativePlatform();
    
    // Function to handle OAuth code exchange
    const handleOAuthCode = async (code: string, source: string, merchantIntentHint: boolean = false) => {
      console.log(`🔐 OAuth PKCE callback detected (${source})`);
      console.log('🔐 Code:', code.substring(0, 20) + '...');
      if (merchantIntentHint) {
        try {
          localStorage.setItem(MERCHANT_SIGNUP_INTENT_KEY, '1');
          console.log('🏪 Merchant intent preserved from callback URL');
        } catch {
          // best effort
        }
      }
      markOAuthPending();
      
      try {
        let exchangeResult: any = null;
        let lastError: any = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            exchangeResult = await Promise.race([
              supabase.auth.exchangeCodeForSession(code),
              new Promise<any>((_, reject) =>
                setTimeout(() => reject(new Error('oauth_exchange_timeout')), 30000)
              ),
            ]);
            lastError = null;
            break;
          } catch (attemptError) {
            lastError = attemptError;
            console.warn(`⚠️ OAuth code exchange attempt ${attempt} failed:`, attemptError);
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1200));
            }
          }
        }

        if (!exchangeResult) {
          throw lastError || new Error('oauth_exchange_timeout');
        }

        const { data, error } = exchangeResult as any;
        
        if (error) {
          console.error('❌ Failed to exchange code for session:', error);
          console.error('Error details:', {
            message: error.message,
            status: error.status,
          });
          clearOAuthPending();
          window.location.hash = `error=${encodeURIComponent(error.message || 'Failed to exchange code')}`;
          return;
        }
        
        console.log('✅ Code exchanged for session successfully');
        console.log('✅ Session data:', {
          hasSession: !!data.session,
          hasUser: !!data.user,
          userId: data.user?.id,
        });
        if (merchantIntentHint && data?.user?.id) {
          try {
            localStorage.setItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY, data.user.id);
          } catch {
            // best effort
          }
        }
        
        // Session is now set, AuthContext will handle the rest via onAuthStateChange
        // Clean up URL
        clearOAuthPending();
        window.history.replaceState({}, document.title, getAppRootPath());
        // Notify router listeners when callback URL is normalized.
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch (err: any) {
        console.error('❌ Error exchanging code for session:', err);
        const rawMessage = String(err?.message || 'Unknown error');
        const normalizedMessage =
          rawMessage === 'oauth_exchange_timeout'
            ? 'Google giriş isteği zaman aşımına uğradı. Lütfen tekrar deneyin.'
            : rawMessage;
        clearOAuthPending();
        window.location.hash = `error=${encodeURIComponent(normalizedMessage)}`;
      }
    };
    
    // Check current URL for OAuth callback (handles case where we're already on callback page)
    const checkCurrentUrlForOAuth = () => {
      const currentUrl = window.location.href;
      const hasOAuthHint =
        currentUrl.includes('supabase.co/auth/v1/callback') ||
        currentUrl.includes('code=') ||
        currentUrl.includes('access_token=') ||
        currentUrl.includes('error=');
      
      // Check if we're on a Supabase callback page
      if (currentUrl.includes('supabase.co/auth/v1/callback')) {
        console.log('🔍 Detected Supabase callback page:', currentUrl);
        
        // Try to extract OAuth parameters from current URL
        try {
          const url = new URL(currentUrl);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error') || url.searchParams.get('error_description');
          const merchantIntent = url.searchParams.get('merchant_intent') === '1';
          
          if (code) {
            console.log('🔐 Found OAuth code in current URL');
            handleOAuthCode(code, 'current URL', merchantIntent);
            return true;
          } else if (error) {
            console.error('❌ OAuth error in current URL:', error);
            window.location.hash = `error=${encodeURIComponent(error || 'Unknown error')}`;
            return true;
          }
        } catch (e) {
          console.error('❌ Failed to parse current URL:', e);
        }
      }
      
      // Also check hash fragment for implicit flow
      const hash = window.location.hash.substring(1);
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const hashError = hashParams.get('error');
        
        if (accessToken) {
          console.log('🔐 OAuth implicit callback detected in hash');
          // Let Supabase handle it via normal flow
          return true;
        } else if (hashError) {
          console.error('❌ OAuth error in hash:', hashError);
          return true;
        }
      }
      
      return hasOAuthHint;
    };
    
    // Check immediately on mount (in case we're already on callback page)
    if (isMobile) {
      checkCurrentUrlForOAuth();
    }
    
    if (isMobile) {
      const handleIncomingDeepLink = (incomingUrl: string, source: string) => {
        console.log(`🔗 App opened with URL (${source}):`, incomingUrl);
        const normalizedIncoming = String(incomingUrl || '').toLowerCase();
        const isKnownOAuthCallback =
          normalizedIncoming.startsWith('com.esnaftaucuz.app:') ||
          normalizedIncoming.includes('supabase.co/auth/v1/callback');
        if (!isKnownOAuthCallback) {
          console.log('ℹ️ Ignoring unrelated deep link URL');
          return;
        }
        try {
          // Fix URL format if needed (com.esnaftaucuz.app:?code=... -> com.esnaftaucuz.app://?code=...)
          let urlString = incomingUrl;
          console.log('🔗 Raw deep link URL:', urlString);

          if (urlString.includes('com.esnaftaucuz.app:') && !urlString.includes('://')) {
            urlString = urlString.replace('com.esnaftaucuz.app:', 'com.esnaftaucuz.app://');
            console.log('🔧 Fixed URL format:', urlString);
          }

          if (!urlString.includes('://')) {
            urlString = `com.esnaftaucuz.app://${urlString}`;
            console.log('🔧 Added protocol:', urlString);
          }

          const url = new URL(urlString);
          console.log('🔗 Parsed URL:', {
            protocol: url.protocol,
            host: url.host,
            pathname: url.pathname,
            search: url.search,
            hash: url.hash,
          });

          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error') || url.searchParams.get('error_description');
          const checkout = url.searchParams.get('checkout');
          const paymentId = url.searchParams.get('paymentId');
          const merchantIntent = url.searchParams.get('merchant_intent') === '1';

          const hash = url.hash.substring(1);
          const hashParams = new URLSearchParams(hash);
          const accessToken = hashParams.get('access_token');
          const hashError = hashParams.get('error');
          const hasActionableParams =
            !!code ||
            !!accessToken ||
            !!error ||
            !!hashError ||
            checkout === 'success' ||
            checkout === 'cancel';

          // Close in-app browser only when callback payload is actionable.
          // Some devices can emit stale callback URLs without query params.
          if (hasActionableParams) {
            Browser.close().catch(() => {});
          }

          if (code) {
            handleOAuthCode(code, `${source} deep link`, merchantIntent);
          } else if (checkout === 'success' || checkout === 'cancel') {
            const qs = new URLSearchParams();
            qs.set('checkout', checkout);
            if (paymentId) qs.set('paymentId', paymentId);
            const appRootPath = getAppRootPath();
            const target = `${appRootPath}?${qs.toString()}`;
            window.history.replaceState({}, document.title, target);
            window.location.replace(target);
          } else if (accessToken) {
            console.log('🔐 OAuth implicit callback detected in deep link (access_token)');
            markOAuthPending();
            window.location.hash = hash;
          } else if (error || hashError) {
            console.error('❌ OAuth error in deep link:', error || hashError);
            clearOAuthPending();
            window.location.hash = `error=${encodeURIComponent(error || hashError || 'Unknown error')}`;
          } else {
            console.log('⚠️ No actionable OAuth parameters in deep link URL; ignoring stale callback');
          }
        } catch (e) {
          console.error('❌ Failed to parse deep link URL:', e);
          console.error('URL was:', incomingUrl);
        }
      };

      const probeLaunchUrl = (source: string) => {
        CapacitorApp.getLaunchUrl()
          .then((result) => {
            if (result?.url) {
              handleIncomingDeepLink(result.url, source);
            }
          })
          .catch(() => {});
      };

      // Some Android devices deliver deep-link before JS listeners are attached.
      // Probe launch URL a few times right after startup to avoid missing OAuth callback.
      let launchProbeCount = 0;
      const maxLaunchProbes = 8;
      const launchProbeTimer = setInterval(() => {
        launchProbeCount += 1;
        probeLaunchUrl(`launch-probe-${launchProbeCount}`);
        if (launchProbeCount >= maxLaunchProbes) {
          clearInterval(launchProbeTimer);
        }
      }, 700);

      // iOS can cold-start app from OAuth callback before listener is attached.
      probeLaunchUrl('launch');

      // Listen for app URL open events (deep links)
      const listener = CapacitorApp.addListener('appUrlOpen', (event) => {
        handleIncomingDeepLink(event.url, 'appUrlOpen');
      });
      
      // Also listen for when the app comes back to foreground
      // This helps catch cases where OAuth redirect happens but deep link isn't triggered
      const appStateListener = CapacitorApp.addListener('appStateChange', (state) => {
        console.log('📱 App state changed:', state.isActive ? 'active' : 'inactive');
        if (state.isActive) {
          probeLaunchUrl('resume');
          // Check if we're on a Supabase callback page
          checkCurrentUrlForOAuth();
        }
      });
      
      // Also check periodically for a short window (in case app state change doesn't fire).
      // Keeping this forever creates unnecessary JS work on native screens.
      let intervalChecks = 0;
      const intervalId = setInterval(() => {
        intervalChecks += 1;
        if (document.visibilityState === 'visible') {
          const relevant = checkCurrentUrlForOAuth();
          if (!relevant || intervalChecks >= 6) {
            clearInterval(intervalId);
          }
        }
      }, 5000);
      
      return () => {
        try {
          pushActionListener?.remove?.();
        } catch {
          // ignore
        }
        listener.remove();
        appStateListener.remove();
        clearInterval(intervalId);
        clearInterval(launchProbeTimer);
      };
    }

    return () => {
      try {
        pushActionListener?.remove?.();
      } catch {
        // ignore
      }
    };
  }, []);
    
    // If running inside Capacitor webview and currently loading from file://,
    // try to detect a running dev server and redirect the webview to it so
    // livereload / hot-reload works even if Capacitor didn't set server.url.
    const tryRedirectToDevServer = async () => {
      try {
        const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform && (window as any).Capacitor.isNativePlatform();
        if (!isNative) return;
        if (!window.location || !window.location.protocol) return;
        if (!window.location.protocol.startsWith('file')) return;

        const candidates = [
          process.env.CAPACITOR_SERVER_URL,
          'http://192.168.3.13:5173',
          'http://172.31.244.78:5173',
          'http://localhost:5173',
        ].filter(Boolean) as string[];

        const timeout = (ms: number, promise: Promise<Response>) =>
          new Promise<null | Response>((resolve) => {
            const timer = setTimeout(() => resolve(null), ms);
            promise.then((res) => {
              clearTimeout(timer);
              resolve(res);
            }).catch(() => resolve(null));
          });

        for (const url of candidates) {
          try {
            const res = await timeout(1500, fetch(url, { method: 'GET', mode: 'no-cors' } as any));
            // If fetch succeeded (or no-cors responded), redirect
            if (res !== null) {
              console.log('🔁 Redirecting webview to dev server:', url);
              window.location.replace(url);
              return;
            }
          } catch (e) {
            // ignore and try next
          }
        }
      } catch (err) {
        console.error('Dev server redirect check failed:', err);
      }
    };

    tryRedirectToDevServer();

  return (
    <MotionConfig reducedMotion="never">
      <LanguageProvider>
        <AuthProvider>
          <ThemeProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-background">
                <AppRoutes />
                <Toaster />
              </div>
            </BrowserRouter>
          </ThemeProvider>
        </AuthProvider>
      </LanguageProvider>
    </MotionConfig>
  );
}

export default App;
