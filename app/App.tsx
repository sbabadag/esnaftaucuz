import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SplashScreen from './components/screens/SplashScreen';
import OnboardingScreen from './components/screens/OnboardingScreen';
import LoginScreen from './components/screens/LoginScreen';
import MainApp from './components/screens/MainApp';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from './lib/supabase';

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
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  // Handle OAuth callback redirect - if user is logged in and on root, redirect to explore
  useEffect(() => {
    console.log('🔍 AppRoutes useEffect - user:', user ? user.email : 'null', 'isLoading:', isLoading, 'pathname:', location.pathname);
    
    // Check if this is an OAuth callback (has hash fragments with access_token)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isOAuthCallback = hashParams.has('access_token') || hashParams.has('code');
    
    if (isOAuthCallback) {
      console.log('🔐 OAuth callback detected, waiting for user to load...');
      // Don't navigate yet, wait for user to be loaded
      return;
    }
    
    if (user && !isLoading) {
      // If user is logged in and on root or login page, redirect to explore
      if (location.pathname === '/' || location.pathname === '/login') {
        console.log('✅ User logged in, redirecting to /app/explore');
        navigate('/app/explore', { replace: true });
      }
    }
  }, [user, isLoading, location.pathname, navigate]);

  // Check if this is an OAuth callback - if so, keep loading until user is ready
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const isOAuthCallback = hashParams.has('access_token') || hashParams.has('code');
  
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
      console.log('✅ AppRoutes: Redirecting from root/login to /app/explore');
      return <Navigate to="/app/explore" replace />;
    }
    
    return (
      <Routes>
        <Route path="/app/*" element={<MainApp />} />
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

  // If not authenticated, show auth flow
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route 
        path="/onboarding" 
        element={<OnboardingScreen onComplete={() => setHasSeenOnboarding(true)} />} 
      />
      <Route 
        path="/login" 
        element={<LoginScreen onLogin={() => {}} />} 
      />
      <Route path="/app/*" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    // Handle deep links and OAuth callbacks on mobile
    const isMobile = typeof window !== 'undefined' && 
      (window as any).Capacitor?.isNativePlatform();
    
    // Function to handle OAuth code exchange
    const handleOAuthCode = async (code: string, source: string) => {
      console.log(`🔐 OAuth PKCE callback detected (${source})`);
      console.log('🔐 Code:', code.substring(0, 20) + '...');
      
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('❌ Failed to exchange code for session:', error);
          console.error('Error details:', {
            message: error.message,
            status: error.status,
          });
          window.location.hash = `error=${encodeURIComponent(error.message || 'Failed to exchange code')}`;
          return;
        }
        
        console.log('✅ Code exchanged for session successfully');
        console.log('✅ Session data:', {
          hasSession: !!data.session,
          hasUser: !!data.user,
          userId: data.user?.id,
        });
        
        // Session is now set, AuthContext will handle the rest via onAuthStateChange
        // Clean up URL
        window.history.replaceState({}, document.title, '/');
        
        // Force a page reload to ensure AuthContext picks up the new session
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (err: any) {
        console.error('❌ Error exchanging code for session:', err);
        window.location.hash = `error=${encodeURIComponent(err.message || 'Unknown error')}`;
      }
    };
    
    // Check current URL for OAuth callback (handles case where we're already on callback page)
    const checkCurrentUrlForOAuth = () => {
      const currentUrl = window.location.href;
      console.log('🔍 Checking current URL for OAuth callback:', currentUrl);
      
      // Check if we're on a Supabase callback page
      if (currentUrl.includes('supabase.co/auth/v1/callback')) {
        console.log('🔍 Detected Supabase callback page');
        
        // Try to extract OAuth parameters from current URL
        try {
          const url = new URL(currentUrl);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error') || url.searchParams.get('error_description');
          
          if (code) {
            console.log('🔐 Found OAuth code in current URL');
            handleOAuthCode(code, 'current URL');
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
      
      return false;
    };
    
    // Check immediately on mount (in case we're already on callback page)
    if (isMobile) {
      checkCurrentUrlForOAuth();
    }
    
    if (isMobile) {
      // Listen for app URL open events (deep links)
      const listener = CapacitorApp.addListener('appUrlOpen', (event) => {
        console.log('🔗 App opened with URL:', event.url);
        
        // Parse the URL to extract OAuth callback parameters
        try {
          // Fix URL format if needed (com.esnaftaucuz.app:?code=... -> com.esnaftaucuz.app://?code=...)
          let urlString = event.url;
          console.log('🔗 Raw deep link URL:', urlString);
          
          // Handle different URL formats
          if (urlString.includes('com.esnaftaucuz.app:') && !urlString.includes('://')) {
            urlString = urlString.replace('com.esnaftaucuz.app:', 'com.esnaftaucuz.app://');
            console.log('🔧 Fixed URL format:', urlString);
          }
          
          // Handle URL without protocol
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
          
          // Check for PKCE flow code parameter in query string
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error') || url.searchParams.get('error_description');
          
          // Check for implicit flow access_token in hash fragment
          const hash = url.hash.substring(1);
          const hashParams = new URLSearchParams(hash);
          const accessToken = hashParams.get('access_token');
          const hashError = hashParams.get('error');
          
          if (code) {
            handleOAuthCode(code, 'deep link');
          } else if (accessToken) {
            // Implicit flow - access_token in hash fragment
            console.log('🔐 OAuth implicit callback detected in deep link (access_token)');
            window.location.hash = hash;
          } else if (error || hashError) {
            console.error('❌ OAuth error in deep link:', error || hashError);
            // Show error to user
            window.location.hash = `error=${encodeURIComponent(error || hashError || 'Unknown error')}`;
          } else {
            console.log('⚠️ No OAuth parameters found in deep link URL');
          }
        } catch (e) {
          console.error('❌ Failed to parse deep link URL:', e);
          console.error('URL was:', event.url);
        }
      });
      
      // Also listen for when the app comes back to foreground
      // This helps catch cases where OAuth redirect happens but deep link isn't triggered
      const appStateListener = CapacitorApp.addListener('appStateChange', (state) => {
        console.log('📱 App state changed:', state.isActive ? 'active' : 'inactive');
        if (state.isActive) {
          // Check if we're on a Supabase callback page
          checkCurrentUrlForOAuth();
        }
      });
      
      // Also check periodically (in case app state change doesn't fire)
      const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          checkCurrentUrlForOAuth();
        }
      }, 1000); // Check every second
      
      return () => {
        listener.remove();
        appStateListener.remove();
        clearInterval(intervalId);
      };
    }
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
  );
}

export default App;
