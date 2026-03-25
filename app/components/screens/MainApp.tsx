import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Map, Plus, User, ShoppingBag, X, Store, BarChart3 } from 'lucide-react';
import ExploreScreen from './tabs/ExploreScreen';
import MapScreen from './tabs/MapScreen';
import AddPriceScreen from './tabs/AddPriceScreen';
import ProfileScreen from './tabs/ProfileScreen';
import ProductDetailScreen from './details/ProductDetailScreen';
import LocationDetailScreen from './details/LocationDetailScreen';
import FavoritesScreen from './FavoritesScreen';
import NotificationsScreen from './NotificationsScreen';
import SettingsScreen from './SettingsScreen';
import ContributionsScreen from './ContributionsScreen';
import MerchantShopScreen from './MerchantShopScreen';
import MerchantReportsScreen from './MerchantReportsScreen';
import MerchantSubscriptionScreen from './MerchantSubscriptionScreen';
import BadgesScreen from './BadgesScreen';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import TermsOfServiceScreen from './TermsOfServiceScreen';
import AboutScreen from './AboutScreen';
import DeliveryReturnPolicyScreen from './DeliveryReturnPolicyScreen';
import DistanceSalesAgreementScreen from './DistanceSalesAgreementScreen';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, safeGetSession } from '../../lib/supabase';
import { addLocalNotification } from '../../lib/notification-store';
import { asUuidOrNull, isLikelyJwt, isUuid, normalizePushEvent } from '../../lib/push-notification-utils';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging, Importance } from '@capacitor-firebase/messaging';
import { pushTokensAPI } from '../../services/supabase-api';
import {
  usePendingPushDrain,
  usePendingPushRetry,
  usePendingPushRoute,
  usePushRegistration,
} from '../../hooks/usePushNotificationPipeline';

// Regular user tabs
const regularTabs = [
  { path: 'explore', label: 'Keşfet', icon: Compass },
  { path: 'map', label: 'Harita', icon: Map },
  { path: 'add', label: 'Ekle', icon: Plus },
  { path: 'profile', label: 'Profil', icon: User },
];

// Merchant tabs - include both "Dükkanım" and "Profil"
const merchantTabs = [
  { path: 'explore', label: 'Keşfet', icon: Compass },
  { path: 'map', label: 'Harita', icon: Map },
  { path: 'merchant-shop', label: 'Dükkanım', icon: Store },
  { path: 'merchant-reports', label: 'Raporlar', icon: BarChart3 },
  { path: 'profile', label: 'Profil', icon: User },
];

const resolveMerchantRole = (profile: any): boolean => {
  const explicit = profile?.is_merchant === true;
  const status = String(profile?.merchant_subscription_status || '').toLowerCase();
  const hasActiveSubscription = status === 'active' || status === 'past_due';
  const hasMerchantPlan = String(profile?.merchant_subscription_plan || '').trim().length > 0;
  return explicit || hasActiveSubscription || hasMerchantPlan;
};

export default function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNativePlatform = Capacitor.isNativePlatform();
  const nativeBottomLiftPx = isNativePlatform ? 10 : 0;
  const [bannerVisible, setBannerVisible] = useState(true);
  const [resolvedMerchantRole, setResolvedMerchantRole] = useState<boolean | null>(null);
  const getCachedMerchantHint = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem('user');
      const cached = raw ? JSON.parse(raw) : null;
      if (cached?.id === user?.id) {
        return resolveMerchantRole(cached);
      }
    } catch {
      // ignore cache parse errors
    }
    return false;
  }, [user?.id]);
  
  useEffect(() => {
    let cancelled = false;
    const resolveRole = async () => {
      if (!user?.id) {
        setResolvedMerchantRole(null);
        return;
      }

      // Start with the fastest local hint.
      const localHint = resolveMerchantRole(user) || getCachedMerchantHint();
      setResolvedMerchantRole(localHint);

      try {
        // Retry a couple of times because session/profile can be briefly stale
        // right after OAuth return on mobile.
        for (let attempt = 0; attempt < 3; attempt++) {
          const [{ data: profile, error: profileError }, { data: merchantProducts, error: productsError }] = await Promise.all([
            supabase
              .from('users')
              .select('is_merchant, merchant_subscription_status, merchant_subscription_plan')
              .eq('id', user.id)
              .maybeSingle(),
            supabase
              .from('merchant_products')
              .select('id')
              .eq('merchant_id', user.id)
              .limit(1),
          ]);

          if (cancelled) return;

          const hasProducts = Array.isArray(merchantProducts) && merchantProducts.length > 0;
          const fromProfile = profile && !profileError ? resolveMerchantRole(profile) : false;
          const resolved = fromProfile || hasProducts;

          if (resolved) {
            // Auto-repair: merchant_products prove merchant role but DB flag is stale
            if (hasProducts && profile && !profileError && !resolveMerchantRole(profile)) {
              console.log('🔧 MainApp: Auto-repairing is_merchant in DB');
              supabase
                .from('users')
                .update({ is_merchant: true })
                .eq('id', user.id)
                .then(({ error: repairErr }) => {
                  if (repairErr) console.warn('⚠️ MainApp repair failed:', repairErr);
                  else console.log('✅ MainApp: is_merchant repaired');
                });
            }
            setResolvedMerchantRole(true);
            return;
          }

          // Persist false only when we have an explicit non-merchant profile response.
          // If profile lookup fails/transiently times out, never downgrade to false.
          const hasExplicitNonMerchantProfile =
            !!profile &&
            !profileError &&
            !resolveMerchantRole(profile);
          if (attempt === 2 && hasExplicitNonMerchantProfile && !productsError) {
            setResolvedMerchantRole(false);
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 700));
        }

        // Final fallback path: direct REST read from users table with bearer token.
        try {
          const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
          const sbKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
          if (sbUrl && sbKey) {
            const { accessToken: safeToken } = await safeGetSession();
            const token = String(safeToken || '').trim();
            if (token) {
              const restRes = await fetch(
                `${sbUrl}/rest/v1/users?id=eq.${user.id}&select=is_merchant,merchant_subscription_status,merchant_subscription_plan`,
                {
                  headers: {
                    apikey: sbKey,
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              if (restRes.ok) {
                const rows = await restRes.json().catch(() => []);
                const row = Array.isArray(rows) ? rows[0] : null;
                if (row && resolveMerchantRole(row)) {
                  if (!row.is_merchant) {
                    supabase.from('users').update({ is_merchant: true }).eq('id', user.id).then(() => {});
                  }
                  setResolvedMerchantRole(true);
                  return;
                }
              }
            }
          }
        } catch {
          // Ignore REST fallback errors.
        }
      } catch {
        // Keep fallback/local hint from context.
      }
    };

    resolveRole();
    return () => {
      cancelled = true;
    };
  }, [
    user?.id,
    (user as any)?.is_merchant,
    (user as any)?.merchant_subscription_status,
    (user as any)?.merchant_subscription_plan,
  ]);

  // Safety net for token registration on native.
  // If hook-driven registration is skipped by lifecycle timing, this effect
  // still registers a valid FCM token for the logged-in user.
  useEffect(() => {
    if (!user?.id) return;
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let inFlight = false;
    let registered = false;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const ensurePushToken = async () => {
      if (cancelled || inFlight || registered) return;
      inFlight = true;
      try {
        const platform = Capacitor.getPlatform();
        await FirebaseMessaging.createChannel({
          id: 'price_alerts',
          name: 'Fiyat Bildirimleri',
          description: 'Fiyat dususleri ve onemli bildirimler',
          importance: Importance.High,
          vibration: true,
        }).catch(() => undefined);

        await Promise.race([
          FirebaseMessaging.requestPermissions(),
          new Promise<any>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]).catch(() => null);

        let token: string | null = null;
        for (let i = 0; i < 4 && !token && !cancelled; i++) {
          const tokenResult = await Promise.race([
            FirebaseMessaging.getToken(),
            new Promise<any>((resolve) => setTimeout(() => resolve(null), 10000)),
          ]).catch(() => null);
          token = tokenResult?.token || null;
          if (!token) await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }

        if (!token || cancelled) return;

        const saved = await pushTokensAPI.upsert(
          user.id,
          token,
          platform === 'ios' ? 'ios' : 'android',
        );
        if (saved) {
          registered = true;
          if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
        }
      } catch (error) {
        console.warn('MainApp push token safety net failed:', error);
      } finally {
        inFlight = false;
      }
    };

    ensurePushToken();
    // Keep trying while app is active for flaky networks/session timing.
    retryTimer = setInterval(() => {
      ensurePushToken();
    }, 45000);

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [user?.id]);

  const isMerchant =
    resolvedMerchantRole === true ||
    (resolvedMerchantRole == null &&
      (resolveMerchantRole(user) || getCachedMerchantHint()));
  const themeColor = isMerchant ? 'blue' : 'green';
  const themeColorClass = isMerchant ? 'blue-600' : 'green-600';
  const themeGradientFrom = isMerchant ? 'from-blue-600' : 'from-green-600';
  const themeGradientTo = isMerchant ? 'to-blue-500' : 'to-emerald-600';
  
  // Check if banner was previously dismissed
  useEffect(() => {
    const bannerDismissed = localStorage.getItem('appBannerDismissed');
    if (bannerDismissed === 'true') {
      setBannerVisible(false);
    }
  }, []);
  
  // Debug: Log merchant status when user changes
  useEffect(() => {
    console.log('🔍 MainApp - User changed:', {
      id: user?.id,
      email: user?.email,
      is_merchant: (user as any)?.is_merchant,
      is_merchant_type: typeof (user as any)?.is_merchant,
    });
  }, [user]);
  
  // Get current path - handle both /app/explore and /app/explore/ cases
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentPath = pathParts[pathParts.length - 1] || 'explore';

  // Get tabs based on user type
  const tabs = isMerchant ? merchantTabs : regularTabs;
  const pendingQueueKey = 'pending_push_events_v1';

  const extractPushPayload = useCallback((raw: any) => normalizePushEvent(raw), []);

  const persistLocalNotification = useCallback((payload: any) => {
    if (!user?.id) return;
    try {
      const normalized = extractPushPayload(payload);
      const data = normalized.data || {};
      const type = String(data.type || 'other');
      const title = String(data.title || normalized.title || 'Bildirim');
      const message = String(data.message || normalized.body || 'Yeni bildirim var.');
      const productId = asUuidOrNull(data.product_id || data.productId);
      const priceId = asUuidOrNull(data.price_id || data.priceId);
      const row = {
        id: normalized.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        title,
        message,
        product_id: productId || undefined,
        price_id: priceId || undefined,
        is_read: false,
        created_at: new Date().toISOString(),
      };

      addLocalNotification(user.id, row);
    } catch {
      // ignore local cache write errors
    }
  }, [user?.id, extractPushPayload]);

  const syncNotificationFromPush = useCallback(async (payload: any): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const normalized = extractPushPayload(payload);
      const data = normalized.data || {};
      const type = data.type || 'other';
      const title = data.title || normalized.title || 'Bildirim';
      const message = data.message || normalized.body || 'Yeni bildirim var.';
      const productId = asUuidOrNull(data.product_id || data.productId);
      const priceId = asUuidOrNull(data.price_id || data.priceId);
      const notificationIdRaw = data.notification_id || data.notificationId || normalized.id;
      const notificationId = isUuid(notificationIdRaw) ? String(notificationIdRaw) : undefined;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      let accessToken: string | null = null;
      for (let i = 0; i < 3 && !accessToken; i++) {
        try {
          const { accessToken: safeToken } = await safeGetSession();
          accessToken = safeToken || null;
          if (!accessToken) {
            await new Promise((resolve) => setTimeout(resolve, 1200 * (i + 1)));
          }
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1200 * (i + 1)));
        }
      }
      if (!accessToken) {
        try {
          const fromStorage = localStorage.getItem('authToken');
          if (isLikelyJwt(fromStorage)) {
            accessToken = fromStorage;
          }
        } catch {
          // ignore localStorage errors
        }
      }

      // Primary path: direct authenticated function call with explicit bearer token.
      if (supabaseUrl && supabaseAnonKey && accessToken) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/sync-notification-from-push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              notification_id: notificationId,
              type,
              title,
              message,
              product_id: productId,
              price_id: priceId,
            }),
          });
          const json = await response.json().catch(() => null);
          if (response.ok && (!json || json.ok !== false)) {
            return true;
          }
        } catch (directFnError) {
          console.warn('Direct sync-notification-from-push call failed:', directFnError);
        }
      }

      const invokeRes = await supabase.functions.invoke('sync-notification-from-push', {
        body: {
          notification_id: notificationId,
          type,
          title,
          message,
          product_id: productId,
          price_id: priceId,
        },
      });

      const invokeFailed = !!invokeRes?.error || (invokeRes?.data && invokeRes?.data?.ok === false);
      if (!invokeFailed) return true;

      // Fallback write path from client if edge function path fails.
      if (priceId && type === 'price_drop') {
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'price_drop')
          .eq('price_id', priceId)
          .maybeSingle();
        if (existing?.id) return true;
      }

      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: user.id,
        type,
        title,
        message,
        product_id: productId,
        price_id: priceId,
      });
      if (insertError) return false;
      return true;
    } catch (error) {
      console.warn('sync-notification-from-push skipped:', error);
      return false;
    }
  }, [user?.id, extractPushPayload]);

  useEffect(() => {
    if (!isMerchant) return;
    if (!location.pathname.includes('/app/add')) return;
    if (!user?.id) return;
    navigate(`/app/merchant-shop/${user.id}`, { replace: true });
  }, [isMerchant, location.pathname, navigate, user?.id]);

  usePendingPushDrain({
    userId: user?.id,
    pendingQueueKey,
    persistLocalNotification,
    syncNotificationFromPush,
  });

  usePendingPushRetry({
    userId: user?.id,
    syncNotificationFromPush,
  });

  usePendingPushRoute({
    userId: user?.id,
    pathname: location.pathname,
    navigate,
  });

  usePushRegistration({
    userId: user?.id,
    navigate,
    persistLocalNotification,
    syncNotificationFromPush,
    extractPushPayload,
  });
  
  // Debug: Log tabs
  useEffect(() => {
    console.log('🔍 MainApp - Tabs:', {
      isMerchant,
      tabsCount: tabs.length,
      tabs: tabs.map(t => t.label),
      user_is_merchant: (user as any)?.is_merchant,
    });
  }, [isMerchant, tabs, user]);
  
  // Hide tab bar on detail screens and add price screen
  const hideTabBar = location.pathname.includes('/product/') || 
                     location.pathname.includes('/location/') ||
                     location.pathname.includes('/notifications') ||
                     location.pathname.includes('/settings') ||
                     location.pathname.includes('/badges') ||
                     location.pathname.includes('/contributions') ||
                     location.pathname.includes('/merchant-subscription') ||
                     location.pathname.includes('/add') ||
                     (isMerchant && location.pathname.includes('/merchant-shop/') && location.pathname !== `/app/merchant-shop/${user?.id}`);
  const lockMainViewport = location.pathname.includes('/merchant-subscription');
  // Keep global banner out of in-app windows; Explore has its own top band.
  const showGlobalAppBanner = false;

  const handleTabClick = (path: string) => {
    console.log('🔘 Tab click handler:', { path, currentPath: location.pathname });
    
    // Special handling for merchant-shop tab
    if (path === 'merchant-shop' && user?.id) {
      navigate(`/app/merchant-shop/${user.id}`, { replace: false });
    } else {
      // Use absolute path for navigation
      navigate(`/app/${path}`, { replace: false });
    }
  };
  
  // Check if merchant-shop tab is active
  const isMerchantShopActive = isMerchant && location.pathname.includes('/merchant-shop/') && location.pathname === `/app/merchant-shop/${user?.id}`;

  useEffect(() => {
    // Keep add flow isolated from explore URL search params.
    if (!location.pathname.startsWith('/app/add')) return;
    if (!location.search) return;
    navigate('/app/add', { replace: true });
  }, [location.pathname, location.search, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* App Banner */}
      {bannerVisible && showGlobalAppBanner && (
        <div
          className={`bg-gradient-to-r ${themeGradientFrom} ${themeGradientTo} text-white px-4 pb-3 flex items-center justify-between shadow-md z-30 relative`}
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-white/20 rounded-full p-2">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-sm">esnaftaucuz</h2>
              <p className="text-xs text-white/90">Bugün en ucuzu nerede, tek bakışta</p>
            </div>
          </div>
          <button
            onClick={() => {
              setBannerVisible(false);
              localStorage.setItem('appBannerDismissed', 'true');
            }}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Banner'ı kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main
        className={lockMainViewport ? 'h-[100dvh] overflow-hidden' : ''}
        style={
          lockMainViewport || hideTabBar
            ? undefined
            : {
                paddingBottom: `calc(5rem + env(safe-area-inset-bottom, 0px) + ${nativeBottomLiftPx}px)`,
              }
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/app/explore" replace />} />
          <Route path="explore" element={<ExploreScreen />} />
          <Route path="map" element={<MapScreen />} />
          {!isMerchant && <Route path="add" element={<AddPriceScreen />} />}
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="product/:id" element={<ProductDetailScreen />} />
          <Route path="location/:id" element={<LocationDetailScreen />} />
          <Route path="favorites" element={<FavoritesScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="privacy-policy" element={<PrivacyPolicyScreen />} />
          <Route path="terms-of-service" element={<TermsOfServiceScreen />} />
          <Route path="about" element={<AboutScreen />} />
          <Route path="delivery-return-policy" element={<DeliveryReturnPolicyScreen />} />
          <Route path="distance-sales-agreement" element={<DistanceSalesAgreementScreen />} />
          <Route path="badges" element={<BadgesScreen />} />
          <Route path="contributions" element={<ContributionsScreen />} />
          <Route path="merchant-subscription" element={<MerchantSubscriptionScreen />} />
          <Route path="merchant-shop/:merchantId" element={<MerchantShopScreen />} />
          <Route path="merchant-reports" element={<MerchantReportsScreen />} />
        </Routes>
      </main>

      {!hideTabBar && (
        <nav
          className="fixed left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-40 shadow-lg"
          style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${nativeBottomLiftPx}px)` }}
        >
          <div className="flex items-center h-16">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              // Check if tab is active - special handling for merchant-shop
              const isActive = tab.path === 'merchant-shop' 
                ? isMerchantShopActive 
                : currentPath === tab.path;
              
              // Calculate width for each tab (equal distribution)
              const tabWidth = `${100 / tabs.length}%`;
              
              return (
                <button
                  key={tab.path}
                  onClick={() => {
                    console.log('🔘 Tab clicked:', tab.path, tab.label);
                    handleTabClick(tab.path);
                  }}
                  className={`flex flex-col items-center justify-center h-full transition-colors relative ${
                    isActive ? (isMerchant ? 'text-blue-600' : 'text-green-600') : 'text-gray-600'
                  }`}
                  style={{ 
                    width: tabWidth,
                    minWidth: tabWidth,
                    maxWidth: tabWidth,
                  }}
                  aria-label={tab.label}
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <Icon className={`w-5 h-5 flex-shrink-0 ${tab.path === 'add' && (isMerchant ? 'bg-blue-600' : 'bg-green-600')} ${tab.path === 'add' && 'text-white rounded-full p-1 w-8 h-8'}`} />
                    <span className="text-[10px] leading-tight font-medium whitespace-nowrap">{tab.label}</span>
                  </div>
                  {isActive && (
                    <div className={`absolute top-0 left-0 right-0 h-0.5 ${isMerchant ? 'bg-blue-600' : 'bg-green-600'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
