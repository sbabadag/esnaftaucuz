import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Map, Plus, User, ShoppingBag, X, Store } from 'lucide-react';
import ExploreScreen from './tabs/ExploreScreen';
import MapScreen from './tabs/MapScreen';
import AddPriceScreen from './tabs/AddPriceScreen';
import ProfileScreen from './tabs/ProfileScreen';
import ProductDetailScreen from './details/ProductDetailScreen';
import LocationDetailScreen from './details/LocationDetailScreen';
import NotificationsScreen from './NotificationsScreen';
import SettingsScreen from './SettingsScreen';
import ContributionsScreen from './ContributionsScreen';
import MerchantShopScreen from './MerchantShopScreen';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import TermsOfServiceScreen from './TermsOfServiceScreen';
import AboutScreen from './AboutScreen';
import FavoritesScreen from './FavoritesScreen';
import FeedbackScreen from './FeedbackScreen';
import MerchantSubscriptionScreen from './MerchantSubscriptionScreen';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { favoritesAPI, notificationsAPI } from '../../services/supabase-api';
import { toast } from 'sonner';

// Regular user tabs (labelKey will be translated via LanguageContext)
  const regularTabs = [
  { path: 'explore', labelKey: 'EXPLORE', icon: Compass },
  { path: 'map', labelKey: 'MAP', icon: Map },
  { path: 'add', labelKey: 'ADD', icon: Plus },
  { path: 'profile', labelKey: 'PROFILE', icon: User },
];

// Merchant tabs - esnaf sadece ürün sayfasından ürün ekleyebilir, + tuşu yok
const merchantTabs = [
  { path: 'explore', labelKey: 'TREND_TITLE', icon: Compass },
  { path: 'map', labelKey: 'MAP', icon: Map },
  { path: 'merchant-shop', labelKey: 'MY_SHOP', icon: Store },
  { path: 'profile', labelKey: 'PROFILE', icon: User },
];

export default function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLoading } = useAuth();
  const [bannerVisible, setBannerVisible] = useState(true);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);
  const shownNotificationIdsRef = useRef<Set<string>>(new Set());
  const processedFavoritePriceEventsRef = useRef<Set<string>>(new Set());
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsPollingBootstrappedRef = useRef(false);
  
  // Merchant status is derived directly from the authoritative `user` object
  // so the UI updates immediately after login.
  const isMerchant = (user as any)?.is_merchant === true;
  const themeColor = isMerchant ? 'blue' : 'green';
  const themeColorClass = isMerchant ? 'blue-600' : 'green-600';
  const themeGradientFrom = isMerchant ? 'from-blue-600' : 'from-green-600';
  const themeGradientTo = isMerchant ? 'to-blue-500' : 'to-emerald-600';
  const bannerGradient = isMerchant ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600' : `bg-gradient-to-r ${themeGradientFrom} ${themeGradientTo}`;
  
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

  // Language
  const { t } = useLanguage();

  // Get tabs based on user type
  const tabs = isMerchant ? merchantTabs : regularTabs;
  
  // Debug: Log tabs
  useEffect(() => {
    console.log('🔍 MainApp - Tabs:', {
      isMerchant,
      tabsCount: tabs.length,
      tabs: tabs.map(t => t.label),
      user_is_merchant: (user as any)?.is_merchant,
    });
  }, [isMerchant, tabs, user]);

  // Realtime notifications: show instant toast when a new notification arrives.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const inserted = payload.new as any;
          if (!inserted?.id) return;

          // Avoid duplicate toasts when channel reconnects.
          if (shownNotificationIdsRef.current.has(inserted.id)) return;
          shownNotificationIdsRef.current.add(inserted.id);

          toast.success(inserted.title || 'Yeni bildirim', {
            description: inserted.message || 'Detaylari gormek icin bildirimler sayfasini ac.',
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // iOS/Safari can occasionally miss realtime events; poll notifications as fallback.
  useEffect(() => {
    if (!user?.id) {
      knownNotificationIdsRef.current.clear();
      notificationsPollingBootstrappedRef.current = false;
      return;
    }

    let isActive = true;

    const syncNotifications = async (allowToast: boolean) => {
      try {
        const rows = await notificationsAPI.getByUser(user.id, 20);
        if (!isActive) return;

        const latest = Array.isArray(rows) ? rows : [];
        const latestIds = new Set<string>();
        latest.forEach((item: any) => {
          if (item?.id) latestIds.add(item.id);
        });

        if (!notificationsPollingBootstrappedRef.current) {
          knownNotificationIdsRef.current = latestIds;
          notificationsPollingBootstrappedRef.current = true;
          return;
        }

        if (allowToast) {
          latest.forEach((item: any) => {
            if (!item?.id) return;
            if (knownNotificationIdsRef.current.has(item.id)) return;
            if (shownNotificationIdsRef.current.has(item.id)) return;

            shownNotificationIdsRef.current.add(item.id);
            toast.success(item.title || 'Yeni bildirim', {
              description: item.message || 'Detaylari gormek icin bildirimler sayfasini ac.',
              duration: 5000,
            });
          });
        }

        knownNotificationIdsRef.current = latestIds;
      } catch (error) {
        console.error('Notification polling fallback failed:', error);
      }
    };

    // Prime without toasts so existing notifications do not spam.
    syncNotifications(false);

    const intervalId = setInterval(() => {
      syncNotifications(true);
    }, 10000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncNotifications(true);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isActive = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id]);

  // Keep favorite product IDs in sync so we can watch price drops in real-time.
  useEffect(() => {
    if (!user?.id) {
      setFavoriteProductIds([]);
      return;
    }

    const loadFavorites = async () => {
      try {
        const favorites = await favoritesAPI.getByUser(user.id);
        const ids = Array.from(
          new Set(
            (favorites || [])
              .map((fav: any) => fav?.product_id)
              .filter((id: any) => typeof id === 'string' && id.length > 0)
          )
        );
        setFavoriteProductIds(ids);
      } catch (error) {
        console.error('Failed to load favorites for realtime price tracking:', error);
      }
    };

    loadFavorites();

    const favoritesChannel = supabase
      .channel(`favorites-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_favorites',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const productId = (payload.new as any)?.product_id;
          if (!productId) return;
          setFavoriteProductIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_favorites',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const productId = (payload.old as any)?.product_id;
          if (!productId) return;
          setFavoriteProductIds((prev) => prev.filter((id) => id !== productId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(favoritesChannel);
    };
  }, [user?.id]);

  // Fallback realtime price-drop notifier for favorited products.
  // This ensures notifications stay live even if DB trigger rollout lags.
  useEffect(() => {
    if (!user?.id || favoriteProductIds.length === 0) return;

    const onPriceChangeForFavorite = async (payload: any) => {
      const row = payload?.new as any;
      if (!row?.id || !row?.product_id) return;
      if (row.is_active !== true) return;
      if (row.user_id === user.id) return;

      const eventKey = `${payload.eventType}:${row.id}:${row.updated_at || row.created_at || row.price}`;
      if (processedFavoritePriceEventsRef.current.has(eventKey)) return;
      processedFavoritePriceEventsRef.current.add(eventKey);

      try {
        // Compare with previous minimum active price for the same product.
        const { data: prevMinRow, error: prevMinError } = await supabase
          .from('prices')
          .select('price')
          .eq('product_id', row.product_id)
          .eq('is_active', true)
          .neq('id', row.id)
          .order('price', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (prevMinError || !prevMinRow?.price) return;
        if (Number(row.price) >= Number(prevMinRow.price)) return;

        // Avoid duplicate inserts when server-side trigger already created this.
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'price_drop')
          .eq('price_id', row.id)
          .maybeSingle();

        if (existing?.id) return;

        const { data: product } = await supabase
          .from('products')
          .select('name')
          .eq('id', row.product_id)
          .maybeSingle();

        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'price_drop',
          title: 'Fiyat Dustu! 🎉',
          message: `${product?.name || 'Urun'} icin yeni dusuk fiyat: ${row.price} TL (onceki en dusuk: ${prevMinRow.price} TL)`,
          product_id: row.product_id,
          price_id: row.id,
        });
      } catch (error) {
        console.error('Realtime favorite price-drop notification fallback failed:', error);
      }
    };

    const priceChannel = supabase.channel(`favorite-price-watch-${user.id}`);

    favoriteProductIds.forEach((productId) => {
      priceChannel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prices',
          filter: `product_id=eq.${productId}`,
        },
        onPriceChangeForFavorite
      );
      priceChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'prices',
          filter: `product_id=eq.${productId}`,
        },
        onPriceChangeForFavorite
      );
    });

    priceChannel.subscribe();

    return () => {
      supabase.removeChannel(priceChannel);
    };
  }, [user?.id, favoriteProductIds]);
  
  // Hide tab bar on detail and modal-like screens.
  const hideTabBar = (
    location.pathname.includes('/product/') ||
    location.pathname.includes('/location/') ||
    location.pathname.includes('/notifications') ||
    location.pathname.includes('/settings') ||
    location.pathname.includes('/merchant-subscription') ||
    location.pathname.includes('/contributions') ||
    location.pathname.includes('/privacy-policy') ||
    location.pathname.includes('/terms-of-service') ||
    location.pathname.includes('/about') ||
    location.pathname.includes('/favorites') ||
    // Add page is only available to regular users; hide tab bar when explicitly on add route.
    (!isMerchant && location.pathname.includes('/add')) ||
    // If merchant is viewing another merchant's shop (not their own), hide tabs to avoid confusion.
    (isMerchant && location.pathname.startsWith('/app/merchant-shop/') && !location.pathname.startsWith(`/app/merchant-shop/${user?.id}`))
  );

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
  
  // Check if merchant-shop tab is active (match exact owner shop path)
  const isMerchantShopActive = isMerchant && location.pathname.startsWith(`/app/merchant-shop/${user?.id}`);

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">

      {/* Top-right username (small) */}
      {user?.name && (
        <div
          className="fixed right-4 z-60"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
          title={user.name}
        >
          <span
            className="text-xs font-medium max-w-[160px] block truncate px-2 py-0.5 rounded"
            style={{
              color: '#ffffff',
              background: 'rgba(0,0,0,0.18)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {String(user.name).split(' ')[0]}
          </span>
        </div>
      )}

      <main className={hideTabBar ? '' : 'pb-20'}>
        <Routes>
          <Route path="/" element={<Navigate to="/app/explore" replace />} />
          <Route path="explore" element={<ExploreScreen />} />
          <Route path="map" element={<MapScreen />} />
          {!isMerchant && <Route path="add" element={<AddPriceScreen />} />}
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="product/:id" element={<ProductDetailScreen />} />
          <Route path="location/:id" element={<LocationDetailScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="feedback" element={<FeedbackScreen />} />
          <Route path="contributions" element={<ContributionsScreen />} />
          <Route path="merchant-shop/:merchantId" element={<MerchantShopScreen />} />
          <Route path="merchant-subscription" element={<MerchantSubscriptionScreen />} />
          <Route path="privacy-policy" element={<PrivacyPolicyScreen />} />
          <Route path="terms-of-service" element={<TermsOfServiceScreen />} />
          <Route path="about" element={<AboutScreen />} />
          <Route path="favorites" element={<FavoritesScreen />} />
        </Routes>
      </main>

  {!hideTabBar && !isLoading && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-40 shadow-lg">
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
                    <span className="text-[10px] leading-tight font-medium whitespace-nowrap">{t(tab.labelKey || tab.label || '')}</span>
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
