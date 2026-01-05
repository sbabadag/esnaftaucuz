import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SplashScreen from './components/screens/SplashScreen';
import OnboardingScreen from './components/screens/OnboardingScreen';
import LocationPermissionScreen from './components/screens/LocationPermissionScreen';
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
  const { user, isLoading } = useAuth(); // useAuth handles HMR cases internally
  const location = useLocation();
  const navigate = useNavigate();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

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
        path="/location" 
        element={<LocationPermissionScreen onAllow={() => setHasLocationPermission(true)} />} 
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
            // PKCE flow - code parameter in query string
            console.log('🔐 OAuth PKCE callback detected in deep link (code parameter)');
            console.log('🔐 Code:', code.substring(0, 20) + '...');
            // Exchange the code for a session manually
            // Supabase client needs to exchange the code for access token
            supabase.auth.exchangeCodeForSession(code)
              .then(({ data, error }) => {
                if (error) {
                  console.error('❌ Failed to exchange code for session:', error);
                  console.error('Error details:', {
                    message: error.message,
                    status: error.status,
                  });
                  window.location.hash = `error=${encodeURIComponent(error.message || 'Failed to exchange code')}`;
                } else {
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
                }
              })
              .catch((err) => {
                console.error('❌ Error exchanging code for session:', err);
                window.location.hash = `error=${encodeURIComponent(err.message || 'Unknown error')}`;
              });
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
          const currentUrl = window.location.href;
          if (currentUrl.includes('supabase.co/auth/v1/callback')) {
            console.log('🔍 Detected Supabase callback page, checking for OAuth parameters...');
            // Try to extract OAuth parameters from current URL
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const error = urlParams.get('error');
            
            if (code) {
              console.log('🔐 Found OAuth code in URL, exchanging for session...');
              supabase.auth.exchangeCodeForSession(code)
                .then(({ data, error }) => {
                  if (error) {
                    console.error('❌ Failed to exchange code:', error);
                  } else {
                    console.log('✅ Code exchanged successfully');
                    window.location.href = 'com.esnaftaucuz.app://';
                  }
                });
            } else if (error) {
              console.error('❌ OAuth error in URL:', error);
            }
          }
        }
      });
      
      return () => {
        listener.remove();
        appStateListener.remove();
      };
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <AppRoutes />
          <Toaster />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
