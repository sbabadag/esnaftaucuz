import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Bell, Filter, MapPin, Clock, CheckCircle2, Package, RefreshCw, X, Navigation, ShoppingBag } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../ui/sheet';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '../../ui/avatar';
import { productsAPI, pricesAPI, searchAPI, merchantProductsAPI, notificationsAPI } from '../../../services/supabase-api';
import { useGeolocation } from '../../../../src/hooks/useGeolocation';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { reverseGeocode } from '../../../utils/geocoding';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { getImmediateUnreadCount, LOCAL_NOTIFICATIONS_UPDATED_EVENT } from '../../../lib/notification-store';

interface Price {
  id: string;
  product: {
    id: string;
    name: string;
    category: string;
    image?: string;
    default_unit?: string;
    defaultUnit?: string;
  };
  price: number;
  unit: string;
  location: {
    id: string;
    name: string;
    type: string;
    city: string;
    district: string;
    coordinates?: { x: number; y: number } | { lat: number; lng: number };
  };
  is_verified: boolean;
  photo?: string;
  created_at: string;
  user?: {
    name: string;
    avatar?: string;
  };
  // Support both formats for backward compatibility
  _id?: string;
  createdAt?: string;
  isVerified?: boolean;
  lat?: number;
  lng?: number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  image?: string;
  // Support both formats
  _id?: string;
}

export default function ExploreScreen() {
  const navigate = useNavigate();
  const { getCurrentPosition } = useGeolocation();
  const { user } = useAuth();
  const isMerchant = (user as any)?.is_merchant === true;
  const { t, lang, setLang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    products: Product[];
    prices: Price[];
    locations: any[];
  } | null>(null);
  const [allProductsIndex, setAllProductsIndex] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [trendProducts, setTrendProducts] = useState<Product[]>([]);
  const [nearbyCheapest, setNearbyCheapest] = useState<Price[]>([]);
  const [recentPrices, setRecentPrices] = useState<Price[]>([]);
  const [merchantShops, setMerchantShops] = useState<any[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchReqSeqRef = useRef(0);
  const forceDirectRef = useRef(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<any>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const [heroHeight, setHeroHeight] = useState<number>(0);
  const HEADER_OVERLAP = 0; // pixels to pull content up so it starts immediately under the search box
  const HEADER_GAP = 8; // small extra gap to avoid overlap
  const retryCountRef = useRef<number>(0);
  const lastSlowToastAtRef = useRef<number>(0);
  const restoredCacheRef = useRef<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<string>('Konya / Selçuklu');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const exploreCacheKey = `explore-cache:${user?.id || 'anon'}`;
  const productsIndexCacheKey = `products-search-index:${user?.id || 'anon'}`;
  const [filters, setFilters] = useState({
    pazar: false,
    manav: false,
    market: false,
    kasap: false,
    todayOnly: false,
    withPhoto: false,
    verified: false,
  });
  const isBenignAddressUnavailableError = (value: unknown) => {
    const msg = String(value || '').toLowerCase();
    return msg.includes('adres bilgisi şu an alınamıyor') || msg.includes('konumunuz yine de kullanılacak');
  };
  const hasAnyData =
    trendProducts.length > 0 ||
    recentPrices.length > 0 ||
    nearbyCheapest.length > 0 ||
    merchantShops.length > 0;
  const hasSearchMatches = !!searchResults && (
    (searchResults.products?.length || 0) > 0 ||
    (searchResults.prices?.length || 0) > 0 ||
    (searchResults.locations?.length || 0) > 0
  );
  const isNativePlatform =
    typeof window !== 'undefined' &&
    !!(window as any).Capacitor?.isNativePlatform &&
    (window as any).Capacitor.isNativePlatform();
  const showSlowLoadingToast = () => {
    // Web'de veri sonunda geldigi icin bu toast gürültü üretiyor.
    if (!isNativePlatform) return;
    // If we already rendered something (including cache), don't show scary timeout toast.
    if (hasAnyData || restoredCacheRef.current) return;
    // Pull-to-refresh flow should stay silent.
    if (isRefreshing) return;
    const now = Date.now();
    if (now - lastSlowToastAtRef.current < 30000) return;
    lastSlowToastAtRef.current = now;
    toast.error('Veriler gec yukleniyor, lutfen tekrar deneyin');
  };

  useEffect(() => {
    if (!user?.id) {
      setUnreadNotificationCount(0);
      return;
    }

    let mounted = true;

    const refreshUnreadCount = async () => {
      try {
        // Immediate optimistic source so bell badge appears without waiting network.
        const immediateCount = getImmediateUnreadCount(user.id);
        if (mounted) setUnreadNotificationCount(immediateCount || 0);

        const count = await notificationsAPI.getUnreadCount(user.id);
        if (mounted) {
          setUnreadNotificationCount(Math.max(count || 0, immediateCount || 0));
        }
      } catch (error) {
        console.error('Failed to refresh unread notification count:', error);
        if (mounted) setUnreadNotificationCount(getImmediateUnreadCount(user.id));
      }
    };

    refreshUnreadCount();

    const channel = supabase
      .channel(`explore-unread-count-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshUnreadCount();
        }
      )
      .subscribe();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const onLocalNotificationsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      if (custom?.detail?.userId && custom.detail.userId !== user.id) return;
      refreshUnreadCount();
    };
    window.addEventListener(LOCAL_NOTIFICATIONS_UPDATED_EVENT, onLocalNotificationsUpdated as EventListener);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener(LOCAL_NOTIFICATIONS_UPDATED_EVENT, onLocalNotificationsUpdated as EventListener);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(exploreCacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      let restoredAny = false;
      if (Array.isArray(parsed?.trendProducts) && parsed.trendProducts.length > 0) {
        setTrendProducts(parsed.trendProducts);
        restoredAny = true;
      }
      if (Array.isArray(parsed?.recentPrices) && parsed.recentPrices.length > 0) {
        setRecentPrices(parsed.recentPrices);
        restoredAny = true;
      }
      if (Array.isArray(parsed?.nearbyCheapest) && parsed.nearbyCheapest.length > 0) {
        setNearbyCheapest(parsed.nearbyCheapest);
        restoredAny = true;
      }
      if (Array.isArray(parsed?.merchantShops) && parsed.merchantShops.length > 0) {
        setMerchantShops(parsed.merchantShops);
        restoredAny = true;
      }
      if (restoredAny) {
        // Render cached content immediately while fresh network calls continue.
        restoredCacheRef.current = true;
        setIsLoading(false);
      }
    } catch (e) {
      console.warn('Failed to restore explore cache:', e);
    }
  }, [exploreCacheKey]);

  useEffect(() => {
    let mounted = true;
    try {
      const raw = localStorage.getItem(productsIndexCacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllProductsIndex(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to restore products search index cache:', e);
    }

    const loadProductsIndex = async () => {
      try {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        if (!sbUrl || !sbKey) return;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(
          `${sbUrl}/rest/v1/products?select=id,name,category,image,is_active&order=name.asc&limit=2000`,
          {
            headers: {
              apikey: sbKey,
              Authorization: `Bearer ${sbKey}`,
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timer);
        if (!response.ok) return;
        const rows = await response.json().catch(() => []);
        if (!mounted || !Array.isArray(rows)) return;
        if (rows.length > 0) {
          setAllProductsIndex(rows as Product[]);
          try {
            localStorage.setItem(productsIndexCacheKey, JSON.stringify(rows));
          } catch {}
        }
      } catch (e) {
        console.warn('Failed to load products search index:', e);
      }
    };

    loadProductsIndex();
    return () => {
      mounted = false;
    };
  }, [productsIndexCacheKey]);


  // Check for search query in URL on mount
  useEffect(() => {
    const urlQuery = searchParams.get('search');
    const refreshFlag = searchParams.get('refresh');
    if (refreshFlag === '1') {
      forceDirectRef.current = true;
    }
    if (urlQuery) {
      setSearchQuery(urlQuery);
      performSearch(urlQuery);
    }
  }, []);

  // Auto-fetch location on mount and retry if permission is granted later
  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;
    
    const autoGetLocation = async (isRetry = false) => {
      // Skip if we already have location
      if (userLocation) {
        console.log('📍 Location already set, skipping auto-fetch');
        return;
      }
      
      try {
        console.log(`📍 ${isRetry ? 'Retrying' : 'Attempting'} to get location...`);
        const position = await getCurrentPosition();
        
        if (position && mounted) {
          const { latitude, longitude } = position;
          console.log('📍 Auto-fetching location:', { latitude, longitude });
          
          // Save user coordinates for filtering
          setUserLocation({ lat: latitude, lng: longitude });
          
          // Reverse geocoding silently (no toast) using Google Maps API ONLY
          try {
            // Add timeout for geocoding (15 seconds for auto-fetch - retry mekanizması için)
            const geocodePromise = reverseGeocode(latitude, longitude);
            const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
              setTimeout(() => {
                resolve({ success: false, error: 'Zaman aşımı' });
              }, 15000); // 15 seconds for retries
            });
            
            const result = await Promise.race([geocodePromise, timeoutPromise]);
            
            if (mounted) {
              if (result.success && result.address) {
                setCurrentLocation(result.address);
                console.log('✅ Auto location set:', result.address);
              } else {
                // Fallback: use coordinates with a user-friendly message
                setCurrentLocation('Mevcut Konum');
                console.log('⚠️ Auto geocoding failed:', result.error || 'Bilinmeyen hata');
                console.log('📍 Using coordinates for filtering:', { lat: latitude, lng: longitude });
                // Show silent toast only if it's a critical error (not timeout)
                if (
                  result.error &&
                  !result.error.includes('Zaman aşımı') &&
                  !isBenignAddressUnavailableError(result.error)
                ) {
                  toast.info('Konum tespit edildi', {
                    description: result.error || 'Adres bilgisi yüklenemedi. Konumunuz kaydedildi.',
                  });
                }
              }
            }
          } catch (geocodeError: any) {
            console.error('Auto geocoding error:', geocodeError);
            if (mounted) {
              setCurrentLocation('Mevcut Konum');
              console.log('📍 Using coordinates for filtering:', { lat: latitude, lng: longitude });
            }
          }
        } else if (mounted && !isRetry) {
          // If first attempt failed and we don't have location, retry after 3 seconds
          // This catches cases where permission is granted after the screen loads
          console.log('📍 Location not available, will retry in 3 seconds...');
          retryTimeout = setTimeout(() => {
            if (mounted && !userLocation) {
              autoGetLocation(true);
            }
          }, 3000);
        }
      } catch (error: any) {
        console.error('Auto location fetch error:', error);
        // If permission denied or not available, retry after 3 seconds (only once)
        if (mounted && !isRetry && !userLocation) {
          console.log('📍 Location fetch failed, will retry in 3 seconds...');
          retryTimeout = setTimeout(() => {
            if (mounted && !userLocation) {
              autoGetLocation(true);
            }
          }, 3000);
        } else if (mounted) {
          setCurrentLocation('Mevcut Konum');
        }
      }
    };
    
    // Auto-fetch location on mount
    autoGetLocation();
    
    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, []); // Only run once on mount

  // Define loadData function before using it in useEffect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadData = useCallback(async (isRefresh = false, forceDirect = false) => {
    // Set loading state immediately
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    console.log('🔄 Loading data...');
    const shouldForceDirect = forceDirect || forceDirectRef.current;
    if (shouldForceDirect) {
      forceDirectRef.current = false; // one-shot bypass after add-price redirect
    }
    
    const hasRenderableData = () =>
      trendProducts.length > 0 ||
      recentPrices.length > 0 ||
      nearbyCheapest.length > 0 ||
      merchantShops.length > 0;

    // Force timeout to prevent infinite loading, but keep UX tolerant on slow networks.
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Loading timeout - forcing completion');
      setIsLoading(false);
      setIsRefreshing(false);
      setPullDistance(0);
      // Do not show immediate scary toast here; a longer safety timer handles it.
    }, 25000);

    try {
      // Primary source: server-side feed (service-role) to avoid client-side RLS/join issues.
      if (!shouldForceDirect) try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        let feedData: any = null;
        let feedError: any = null;

        if (supabaseUrl && supabaseAnonKey) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(`${supabaseUrl}/functions/v1/explore-feed`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({ limitRecent: 6, limitTrending: 6, limitShops: 20 }),
              signal: controller.signal,
            });
            clearTimeout(timer);
            const json = await response.json().catch(() => null);
            if (response.ok && json?.ok) {
              feedData = json;
            } else {
              feedError = json || new Error(`explore-feed http ${response.status}`);
            }
          } catch (directFetchError) {
            feedError = directFetchError;
          }
        }

        // Secondary: invoke client API only if direct call failed.
        if (!feedData?.ok) {
          const invokeRes = await Promise.race([
            supabase.functions.invoke('explore-feed', {
              body: { limitRecent: 6, limitTrending: 6, limitShops: 20 },
            }),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('explore-feed invoke timeout')), 10000)),
          ]) as any;
          if (!invokeRes?.error && invokeRes?.data?.ok) {
            feedData = invokeRes.data;
            feedError = null;
          } else {
            feedError = invokeRes?.error || feedError;
          }
        }

        if (!feedError && feedData?.ok) {
          const recentFromFn = Array.isArray(feedData.recentPrices) ? feedData.recentPrices : [];
          const trendFromFn = Array.isArray(feedData.trendProducts) ? feedData.trendProducts : [];
          const shopsFromFn = Array.isArray(feedData.merchantShops) ? feedData.merchantShops : [];
          let shopsToUse = shopsFromFn;

          try {
            const shopsFromApi = await Promise.race([
              merchantProductsAPI.getAllMerchantShops(20),
              new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('merchant-shops timeout')), 8000)),
            ]);
            if (Array.isArray(shopsFromApi)) {
              // Prefer API shops because they are derived from merchant_products
              // and guaranteed to have at least one product.
              shopsToUse = shopsFromApi;
            }
          } catch (shopsErr) {
            console.warn('⚠️ Merchant shops API fallback failed, using function shops:', shopsErr);
          }

          if (trendFromFn.length > 0) setTrendProducts(trendFromFn);
          if (recentFromFn.length > 0) setRecentPrices(recentFromFn);
          setMerchantShops(shopsToUse);
          if (recentFromFn.length > 0) setNearbyCheapest(recentFromFn.slice(0, 8));

          if (trendFromFn.length > 0 || recentFromFn.length > 0 || shopsToUse.length > 0) {
            try {
              localStorage.setItem(
                exploreCacheKey,
                JSON.stringify({
                  trendProducts: trendFromFn,
                  recentPrices: recentFromFn,
                  nearbyCheapest: recentFromFn.slice(0, 8),
                  merchantShops: shopsToUse,
                  savedAt: new Date().toISOString(),
                })
              );
            } catch (_) {}

            if (isRefresh) toast.success('Yenilendi');
            return;
          }
        }
      } catch (feedPrimaryError) {
        console.warn('⚠️ Primary explore-feed path failed, falling back to legacy loaders:', feedPrimaryError);
      }

      const enrichPricesWithProducts = async (rows: any[]) => {
        const list = Array.isArray(rows) ? rows : [];
        const missingProductRows = list.filter((row: any) => !row?.product && row?.product_id);
        if (missingProductRows.length === 0) return list;

        const productIds = Array.from(
          new Set(
            missingProductRows
              .map((row: any) => row?.product_id)
              .filter((id: any) => typeof id === 'string' && id.length > 0)
          )
        );
        if (productIds.length === 0) return list;

        const { data: productsByIdRows, error: productsByIdError } = await supabase
          .from('products')
          .select('id, name, category, image')
          .in('id', productIds);

        if (productsByIdError) {
          console.error('❌ Failed to enrich prices with products:', productsByIdError);
          return list;
        }

        const productsById = new Map((productsByIdRows || []).map((p: any) => [p.id, p]));
        return list.map((row: any) => {
          if (row?.product || !row?.product_id) return row;
          const product = productsById.get(row.product_id);
          return product ? { ...row, product } : row;
        });
      };

      const withTimeout = async <T,>(promise: Promise<T>, label: string, ms: number = 12000): Promise<T> => {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
          ),
        ]);
      };

      // Load with per-request timeout to avoid one hung call blocking the whole screen.
      const trendingPromise = withTimeout(productsAPI.getTrending(), 'trending', 12000);
      
      // Get user's search radius preference (default: 15 km = 15000 meters)
      // Priority: preferences.searchRadius (newer) > search_radius (legacy) > default
      const preferencesRadius = (user as any)?.preferences?.searchRadius;
      const legacyRadius = (user as any)?.search_radius;
      const searchRadiusKm = preferencesRadius !== undefined
                            ? preferencesRadius
                            : legacyRadius !== undefined
                            ? legacyRadius
                            : 15;
      const searchRadiusMeters = searchRadiusKm * 1000;
      
      console.log('🔍 Search radius calculation:', {
        preferencesRadius,
        legacyRadius,
        finalRadius: searchRadiusKm,
        user: user ? { id: user.id, hasPreferences: !!(user as any).preferences } : null,
      });
      
      // Only load nearby prices if user location is available
      // Don't use fallback coordinates - only show nearby prices when we have real user location
      const userLat = userLocation?.lat;
      const userLng = userLocation?.lng;
      
      console.log('📍 Using location for filtering:', JSON.stringify({ 
        lat: userLat, 
        lng: userLng, 
        radiusKm: searchRadiusKm,
        hasUserLocation: !!(userLat && userLng)
      }));
      
      // Load recent prices globally. "Recent" should not disappear when location filters are strict.
      const recentPromise = withTimeout(pricesAPI.getAll({
        sort: 'newest',
        limit: 20,
        todayOnly: false,
      }), 'recent-prices', 12000);
      
      // Load nearby cheapest - with location filter if available, otherwise show cheapest overall
      const nearbyPromise = (userLat && userLng)
        ? withTimeout(searchAPI.getNearbyCheapest(userLat, userLng, searchRadiusMeters, 10), 'nearby-prices', 12000)
        : withTimeout(
            pricesAPI.getAll({
              sort: 'cheapest',
              limit: 10, // Show cheapest prices even without location
            }),
            'cheapest-prices',
            12000
          );
      
      // Load merchant shops
      const merchantShopsPromise = withTimeout(merchantProductsAPI.getAllMerchantShops(20), 'merchant-shops', 12000);

      // Wait for all promises (with individual error handling)
      const [trending, recent, nearby, merchantShopsResult] = await Promise.allSettled([
        trendingPromise,
        recentPromise,
        nearbyPromise,
        merchantShopsPromise,
      ]);

      // Process results
      let nextTrendProducts = trendProducts;
      let nextRecentPrices = recentPrices;
      let nextNearbyCheapest = nearbyCheapest;
      let nextMerchantShops = merchantShops;
      const recentPricesData = recent.status === 'fulfilled' ? (recent.value || []) : [];

      if (trending.status === 'fulfilled') {
        const trendingProducts = trending.value || [];
        console.log('📦 Trending products loaded:', trendingProducts.length);

        if (trendingProducts.length > 0) {
          nextTrendProducts = trendingProducts;
          setTrendProducts(trendingProducts);
        } else {
          // Fallback: derive products from recent prices when trending is empty.
          let fallbackProducts = Array.from(
            new Map(
              recentPricesData
                .map((price: any) => price?.product)
                .filter((product: any) => product?.id)
                .map((product: any) => [product.id, product])
            ).values()
          ).slice(0, 6) as Product[];

          // If recent rows do not include expanded product objects, fetch by product_id.
          if (fallbackProducts.length === 0) {
            const productIds = Array.from(
              new Set(
                recentPricesData
                  .map((price: any) => price?.product_id)
                  .filter((id: any) => typeof id === 'string' && id.length > 0)
              )
            ).slice(0, 12);

            if (productIds.length > 0) {
              const { data: fallbackQueryProducts, error: fallbackQueryError } = await supabase
                .from('products')
                .select('id, name, category, image')
                .in('id', productIds)
                .limit(6);

              if (fallbackQueryError) {
                console.error('❌ Trending fallback product query failed:', fallbackQueryError);
              } else {
                fallbackProducts = (fallbackQueryProducts || []) as Product[];
              }
            }
          }

          console.log('📦 Trending fallback products loaded from recent prices:', fallbackProducts.length);
          nextTrendProducts = fallbackProducts;
          setTrendProducts(fallbackProducts);
        }
      } else {
        console.error('❌ Trending products failed:', trending.reason);
      }

      if (recent.status === 'fulfilled') {
        const enrichedRecent = await enrichPricesWithProducts(recentPricesData);
        console.log('📦 Recent prices loaded:', enrichedRecent.length);
        console.log('📦 Recent prices sample:', enrichedRecent.slice(0, 3).map((p: any) => ({
          id: p.id,
          product: p.product?.name,
          price: p.price,
          location: p.location?.name,
        })));
        nextRecentPrices = enrichedRecent;
        setRecentPrices(enrichedRecent);
      } else {
        console.error('❌ Recent prices failed:', recent.reason);
      }

      if (nearby.status === 'fulfilled') {
        const nearbyPricesData = nearby.value || [];
        const enrichedNearby = await enrichPricesWithProducts(nearbyPricesData);
        console.log('📦 Nearby prices loaded:', enrichedNearby.length);
        if (enrichedNearby.length > 0) {
          console.log('📦 Nearby prices sample:', enrichedNearby.slice(0, 3).map((p: any) => ({
            id: p.id,
            product: p.product?.name,
            price: p.price,
            location: p.location?.name,
            lat: p.lat,
            lng: p.lng,
          })));
        } else {
          console.log('⚠️ No nearby prices found - check location and radius settings');
        }
        nextNearbyCheapest = enrichedNearby;
        setNearbyCheapest(enrichedNearby);
      } else {
        console.error('❌ Nearby prices failed:', nearby.reason);
      }

      if (merchantShopsResult.status === 'fulfilled') {
        console.log('🏪 Merchant shops loaded:', merchantShopsResult.value?.length || 0);
        nextMerchantShops = merchantShopsResult.value || [];
        setMerchantShops(nextMerchantShops);
      } else {
        console.error('❌ Merchant shops failed:', merchantShopsResult.reason);
      }

      // Final safety net: if network wrappers return empty/rejected, fetch minimal data directly.
      if (nextRecentPrices.length === 0) {
        const { data: fallbackRecentRows, error: fallbackRecentError } = await supabase
          .from('prices')
          .select(`
            id,
            price,
            unit,
            created_at,
            is_verified,
            photo,
            coordinates,
            product_id,
            location_id,
            product:products(id, name, category, image),
            location:locations(id, name, type, city, district)
          `)
          .order('created_at', { ascending: false })
          .limit(20);

        if (fallbackRecentError) {
          console.error('❌ Fallback recent prices query failed:', fallbackRecentError);
        } else if (Array.isArray(fallbackRecentRows) && fallbackRecentRows.length > 0) {
          const enrichedFallbackRecent = await enrichPricesWithProducts(fallbackRecentRows as any[]);
          nextRecentPrices = enrichedFallbackRecent as Price[];
          setRecentPrices(nextRecentPrices);
          console.log('✅ Fallback recent prices loaded:', nextRecentPrices.length);
        }
      }

      if (nextTrendProducts.length === 0 && nextRecentPrices.length > 0) {
        const derivedProducts = Array.from(
          new Map(
            nextRecentPrices
              .map((row: any) => row?.product)
              .filter((p: any) => p?.id)
              .map((p: any) => [p.id, p])
          ).values()
        ).slice(0, 8) as Product[];
        if (derivedProducts.length > 0) {
          nextTrendProducts = derivedProducts;
          setTrendProducts(derivedProducts);
          console.log('✅ Fallback trending derived from recent:', derivedProducts.length);
        }
      }

      if (nextNearbyCheapest.length === 0 && nextRecentPrices.length > 0) {
        nextNearbyCheapest = nextRecentPrices.slice(0, 8);
        setNearbyCheapest(nextNearbyCheapest);
      }

      // Ultimate fallback via service-role edge function when client-side queries cannot read data.
      if (nextRecentPrices.length === 0 && nextTrendProducts.length === 0) {
        try {
          const { data: feedData, error: feedError } = await supabase.functions.invoke('explore-feed', {
            body: { limitRecent: 20, limitTrending: 12, limitShops: 20 },
          });
          if (!feedError && feedData?.ok) {
            const recentFromFn = Array.isArray(feedData.recentPrices) ? feedData.recentPrices : [];
            const trendFromFn = Array.isArray(feedData.trendProducts) ? feedData.trendProducts : [];
            const shopsFromFn = Array.isArray(feedData.merchantShops) ? feedData.merchantShops : [];
            if (recentFromFn.length > 0) {
              nextRecentPrices = recentFromFn;
              setRecentPrices(recentFromFn);
            }
            if (trendFromFn.length > 0) {
              nextTrendProducts = trendFromFn;
              setTrendProducts(trendFromFn);
            }
            if (shopsFromFn.length > 0) {
              nextMerchantShops = shopsFromFn;
              setMerchantShops(shopsFromFn);
            }
            if (nextNearbyCheapest.length === 0 && recentFromFn.length > 0) {
              nextNearbyCheapest = recentFromFn.slice(0, 8);
              setNearbyCheapest(nextNearbyCheapest);
            }
          }
        } catch (fnErr) {
          console.error('❌ explore-feed fallback failed:', fnErr);
        }
      }

      try {
        localStorage.setItem(
          exploreCacheKey,
          JSON.stringify({
            trendProducts: nextTrendProducts,
            recentPrices: nextRecentPrices,
            nearbyCheapest: nextNearbyCheapest,
            merchantShops: nextMerchantShops,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (cacheErr) {
        console.warn('Failed to persist explore cache:', cacheErr);
      }

      console.log('✅ Data loading completed');
      
      if (isRefresh) {
        toast.success('Yenilendi');
      }
    } catch (error: any) {
      console.error('❌ Failed to load data:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      
      // Preserve previously rendered lists on transient failures.
      toast.error(error.message || 'Veriler yuklenirken bir hata olustu');
    } finally {
      clearTimeout(timeoutId);
      console.log('🏁 Setting loading states to false');
      setIsLoading(false);
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [userLocation, user, exploreCacheKey]);

  // Reload data when user location or search radius changes
  useEffect(() => {
    if (userLocation) {
      console.log('📍 User location or search radius changed, reloading data...', userLocation);
      loadData();
    }
  }, [userLocation?.lat, userLocation?.lng, (user as any)?.search_radius, (user as any)?.preferences?.searchRadius, loadData]); // Reload when coordinates or radius change

  useEffect(() => {
    console.log('🔄 ExploreScreen mounted, loading data...');
    
    // Safety timeout - force loading to false on very slow networks.
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Safety timeout triggered - forcing loading to false');
      setIsLoading(false);
      setIsRefreshing(false);
      setPullDistance(0);
      if (trendProducts.length === 0 && recentPrices.length === 0 && nearbyCheapest.length === 0 && merchantShops.length === 0) {
        showSlowLoadingToast();
      }
    }, 45000);
    
    loadData().catch((error) => {
      console.error('❌ Load data failed in useEffect:', error);
      setIsLoading(false);
      setIsRefreshing(false);
    }).finally(() => {
      clearTimeout(safetyTimeout);
    });
    
    // Use ResizeObserver to track hero + header heights precisely (handles font/load/layout changes)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      try {
        ro = new ResizeObserver(() => {
          try {
            const hh = headerRef.current?.offsetHeight || 0;
            const hv = heroRef.current?.offsetHeight || 0;
            setHeaderHeight(hh);
            setHeroHeight(hv);
          } catch (e) { /* ignore */ }
        });
        if (headerRef.current) ro.observe(headerRef.current);
        if (heroRef.current) ro.observe(heroRef.current);
      } catch (e) {
        ro = null;
      }
    }
    // initial measure (defer slightly to allow layout)
    setTimeout(() => {
      try {
        setHeaderHeight(headerRef.current?.offsetHeight || 0);
        setHeroHeight(heroRef.current?.offsetHeight || 0);
      } catch (e) {}
    }, 0);

    return () => {
      clearTimeout(safetyTimeout);
      if (ro && headerRef.current) ro.disconnect();
    };
  }, [loadData, trendProducts.length, recentPrices.length, nearbyCheapest.length, merchantShops.length]);

  // Supabase Realtime subscription for price updates
  useEffect(() => {
    console.log('🔴 Setting up Realtime subscription for prices...');
    
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    const setupSubscription = () => {
      // Clean up existing channel if any
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.warn('Failed to remove existing channel:', e);
        }
      }
      
      channelRef.current = supabase
        .channel(`prices-changes-${Date.now()}`) // Unique channel name to avoid conflicts
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'prices',
          },
          (payload) => {
            console.log('🔴 Realtime event received:', payload.eventType, payload);
            
            // Handle different event types
            if (payload.eventType === 'INSERT') {
              const newPriceId = payload.new.id || payload.new._id;
              console.log('➕ New price added:', newPriceId);
              
              // Fetch full price data with relations instead of using raw payload
              // Realtime payload doesn't include related data (product, location, user)
              pricesAPI.getById(newPriceId)
                .then((fullPrice) => {
                  if (!fullPrice) return;
                  
                  console.log('✅ Full price data fetched:', fullPrice);
                  
                  // Add to recent prices if it matches filters
                  setRecentPrices((prev) => {
                    // Check if already exists
                    const exists = prev.some((p) => (p.id || p._id) === (fullPrice.id || fullPrice._id));
                    if (exists) return prev;
                    
                    // Add to beginning of list
                    return [fullPrice, ...prev].slice(0, 100); // Keep max 100 items
                  });
                  
                  // Show toast notification
                  toast.success('Yeni fiyat eklendi!', {
                    description: fullPrice.product?.name || 'Yeni bir fiyat paylaşıldı',
                  });
                  
                  // Reload nearby cheapest prices
                  if (userLocation) {
                    // Priority: preferences.searchRadius (newer) > search_radius (legacy) > default
                    const searchRadiusKm = (user as any)?.preferences?.searchRadius !== undefined
                                          ? (user as any).preferences.searchRadius
                                          : (user as any)?.search_radius !== undefined
                                          ? (user as any).search_radius
                                          : 15;
                    const searchRadiusMeters = searchRadiusKm * 1000;
                    
                    searchAPI.getNearbyCheapest(
                      userLocation.lat, 
                      userLocation.lng, 
                      searchRadiusMeters, 
                      10
                    ).then((nearby) => {
                      setNearbyCheapest(nearby);
                    }).catch((err) => {
                      console.error('❌ Failed to reload nearby prices:', err);
                    });
                  }
                })
              .catch((err) => {
                console.error('❌ Failed to fetch full price data:', err);
                // Fallback: reload all data
                loadData(true);
              });
          } else if (payload.eventType === 'UPDATE') {
            const updatedPriceId = payload.new.id || payload.new._id;
            console.log('🔄 Price updated:', updatedPriceId);
            
            // Fetch full price data with relations
            pricesAPI.getById(updatedPriceId)
              .then((fullPrice) => {
                if (!fullPrice) return;
                
                // Update in recent prices
                setRecentPrices((prev) =>
                  prev.map((p) =>
                    (p.id || p._id) === (fullPrice.id || fullPrice._id) ? fullPrice : p
                  )
                );
                
                // Update in nearby cheapest
                setNearbyCheapest((prev) =>
                  prev.map((p) =>
                    (p.id || p._id) === (fullPrice.id || fullPrice._id) ? fullPrice : p
                  )
                );
                
                toast.info('Fiyat güncellendi', {
                  description: fullPrice.product?.name || 'Bir fiyat güncellendi',
                });
              })
              .catch((err) => {
                console.error('❌ Failed to fetch updated price data:', err);
                // Fallback: reload all data
                loadData(true);
              });
          } else if (payload.eventType === 'DELETE') {
            const deletedPriceId = payload.old.id || payload.old._id;
            console.log('🗑️ Price deleted:', deletedPriceId);
            
            // Remove from recent prices
            setRecentPrices((prev) =>
              prev.filter((p) => (p.id || p._id) !== deletedPriceId)
            );
            
            // Remove from nearby cheapest
            setNearbyCheapest((prev) =>
              prev.filter((p) => (p.id || p._id) !== deletedPriceId)
            );
            
            toast.info('Fiyat silindi');
          }
        }
      )
      .subscribe((status) => {
        console.log('🔴 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription active');
          retryCountRef.current = 0; // Reset retry count on success
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error');
          
          // Retry subscription if we haven't exceeded max retries
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(`🔄 Retrying realtime subscription (${retryCountRef.current}/${maxRetries})...`);
            
            setTimeout(() => {
              setupSubscription();
            }, retryDelay * retryCountRef.current); // Exponential backoff
          } else {
            console.error('❌ Realtime subscription failed after max retries');
            // Don't show error toast on every retry, only on final failure
            // The app will still work without real-time updates
            console.warn('⚠️ Real-time updates disabled. App will continue to work normally.');
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Realtime subscription timed out');
          // Retry on timeout
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            setTimeout(() => {
              setupSubscription();
            }, retryDelay * retryCountRef.current);
          }
        }
      });
    };
    
    // Initial subscription setup
    setupSubscription();
    
    // Cleanup subscription on unmount
    return () => {
      console.log('🔴 Cleaning up Realtime subscription...');
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.warn('Failed to remove channel:', e);
        }
      }
      retryCountRef.current = 0; // Reset retry count on cleanup
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, user, loadData]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Only trigger if scrolled to top
    if (container.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isRefreshing) return;
    
    const container = scrollContainerRef.current;
    if (!container || container.scrollTop > 0) {
      touchStartY.current = null;
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartY.current;
    
    if (distance > 0) {
      // Prevent default scroll when pulling down
      e.preventDefault();
      const pullDistance = Math.min(distance, 120); // Max 120px
      setPullDistance(pullDistance);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null || isRefreshing) return;
    
    const container = scrollContainerRef.current;
    if (container && container.scrollTop === 0 && pullDistance >= 80) {
      // Trigger refresh if pulled enough
      loadData(true);
    } else {
      // Reset if not enough pull
      setPullDistance(0);
    }
    
    touchStartY.current = null;
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',');
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays === 1) return '1 gün önce';
    return `${diffDays} gün önce`;
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handleGetCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      const position = await getCurrentPosition();
      
      if (position) {
        const { latitude, longitude } = position;
        console.log('📍 Current location:', { latitude, longitude });
        
        // Save user coordinates for filtering
        setUserLocation({ lat: latitude, lng: longitude });
        
        // Reverse geocoding using Google Maps API ONLY
        try {
          // Add timeout for geocoding (20 seconds - retry mekanizması için yeterli süre)
          const geocodePromise = reverseGeocode(latitude, longitude);
          const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
            setTimeout(() => {
              resolve({ success: false, error: 'Zaman aşımı - Google Maps API yanıt vermedi' });
            }, 20000); // 20 seconds for retries
          });
          
          const result = await Promise.race([geocodePromise, timeoutPromise]);
          
          if (result.success && result.address) {
            setCurrentLocation(result.address);
            toast.success('Konum alındı', {
              description: result.address,
            });
            // Reload data with new location
            loadData();
          } else {
            // Show detailed error message
            const errorMsg = result.error || 'Bilinmeyen hata';
            console.error('❌ Geocoding failed:', errorMsg);
            setCurrentLocation('Mevcut Konum');
            if (!isBenignAddressUnavailableError(errorMsg)) {
              toast.warning('Konum tespit edildi', {
                description: `Adres bilgisi yüklenemedi: ${errorMsg}. Konumunuz kaydedildi.`,
              });
            }
            // Reload data with new location even if geocoding failed
            loadData();
          }
        } catch (geocodeError: any) {
          console.error('Geocoding error:', geocodeError);
          // Even if geocoding fails, we still have coordinates
          setCurrentLocation('Mevcut Konum');
          toast.info('Konum tespit edildi', {
            description: 'Koordinatlar kaydedildi. Fiyatlar konumunuza göre filtrelenecek.',
          });
          // Reload data with new location even if geocoding failed
          loadData();
        }
      } else {
        toast.error('Konum alınamadı. Lütfen konum iznini kontrol edin.');
      }
    } catch (error: any) {
      console.error('Location error:', error);
      const errorMessage = error.message || 'Bilinmeyen hata';
      
      if (errorMessage.includes('permission') || errorMessage.includes('izin')) {
        toast.error('Konum izni gerekli', {
          description: 'Lütfen ayarlardan konum iznini açın.',
        });
      } else {
        toast.error('Konum alınamadı', {
          description: errorMessage,
        });
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  const performSearch = async (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      searchReqSeqRef.current += 1;
      setSearchResults(null);
      setSearchParams({});
      return;
    }

    const trNormalize = (value: string) =>
      (value || '')
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
    const qn = trNormalize(normalized);
    const getNameScore = (name: string, category?: string) => {
      const n = trNormalize(name || '');
      const c = trNormalize(category || '');
      if (n && n === qn) return 100;
      if (n && n.startsWith(qn)) return 80;
      if (n && n.split(/\s+/).some((w) => w.startsWith(qn))) return 60;
      if (n && n.includes(qn)) return 40;
      if (c && c.includes(qn)) return 20;
      return -1;
    };

    // Instant local fallback so "character-by-character" search always renders quickly.
    const localProductsMap = new Map<string, Product>();
    [...allProductsIndex, ...trendProducts, ...recentPrices.map((p: any) => p?.product).filter(Boolean)].forEach((p: any) => {
      const pid = p?.id || p?._id;
      if (!pid) return;
      const score = getNameScore(p?.name || '', p?.category || '');
      if (score >= 0) {
        localProductsMap.set(pid, p);
      }
    });
    const localProducts = Array.from(localProductsMap.values())
      .sort((a: any, b: any) => getNameScore(b?.name || '', b?.category || '') - getNameScore(a?.name || '', a?.category || ''))
      .slice(0, 10);
    const localPrices = (recentPrices || [])
      .filter((p: any) => {
        const score = getNameScore(p?.product?.name || '', p?.product?.category || '');
        return score >= 0;
      })
      .sort((a: any, b: any) => getNameScore(b?.product?.name || '', b?.product?.category || '') - getNameScore(a?.product?.name || '', a?.product?.category || ''))
      .slice(0, 20);
    const localLocations = localPrices
      .map((p: any) => p?.location)
      .filter((l: any) => !!l?.id)
      .filter((l: any, idx: number, arr: any[]) => arr.findIndex((x) => x.id === l.id) === idx)
      .slice(0, 10);

    setSearchResults({
      products: localProducts,
      prices: localPrices as any,
      locations: localLocations,
    });
    setSearchParams({ search: query });

    const reqSeq = ++searchReqSeqRef.current;
    try {
      setIsSearching(true);
      const results = await searchAPI.search(query, 'all');
      if (reqSeq !== searchReqSeqRef.current) return;
      // DB results are the source of truth (search across full product database).
      const rankedProducts = Array.from(results?.products || [])
        .filter((p: any) => getNameScore(p?.name || '', p?.category || '') >= 0)
        .sort((a: any, b: any) => getNameScore(b?.name || '', b?.category || '') - getNameScore(a?.name || '', a?.category || ''))
        .slice(0, 120);
      const rankedPrices = Array.from(results?.prices || [])
        .filter((p: any) => getNameScore(p?.product?.name || '', p?.product?.category || '') >= 0)
        .sort((a: any, b: any) => getNameScore(b?.product?.name || '', b?.product?.category || '') - getNameScore(a?.product?.name || '', a?.product?.category || ''))
        .slice(0, 20);
      const remoteLocations = Array.from(results?.locations || []).slice(0, 10);

      setSearchResults({
        products: rankedProducts,
        prices: rankedPrices,
        locations: remoteLocations,
      });
      setSearchParams({ search: query });
    } catch (error: any) {
      if (reqSeq !== searchReqSeqRef.current) return;
      console.error('Search error:', error);
      // Keep local results instead of collapsing the UI on transient API failures.
    } finally {
      if (reqSeq !== searchReqSeqRef.current) return;
      setIsSearching(false);
    }
  };

  // Auto-search as the user types (debounced)
  useEffect(() => {
    const debounceMs = 350;
    const handler = setTimeout(() => {
      const q = searchQuery.trim();
      if (q) {
        // perform search for the latest query
        performSearch(q).catch((err) => {
          console.error('Debounced search failed:', err);
        });
      } else {
        // Clear results immediately when query is empty
        searchReqSeqRef.current += 1;
        setSearchResults(null);
        setSearchParams({});
      }
    }, debounceMs);

    return () => clearTimeout(handler);
    // Intentionally exclude performSearch from deps to avoid re-creating timer when its identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchParams({});
      return;
    }
    await performSearch(searchQuery);
  };

  const clearSearch = () => {
    searchReqSeqRef.current += 1;
    setSearchQuery('');
    setSearchResults(null);
    setSearchParams({});
  };

  return (
    <div 
      className="min-h-screen bg-gray-50 relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Debug banner showing webview origin to confirm where assets are loaded from */}
      <div className="fixed left-0 right-0 z-60 flex justify-center pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
        <div className="bg-red-600 text-white text-xs px-3 py-1 rounded opacity-95 pointer-events-auto">
          Origin: {typeof window !== 'undefined' ? window.location.protocol + '//' + window.location.host : 'n/a'} {typeof window !== 'undefined' && window.location.pathname}
        </div>
      </div>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="absolute left-0 right-0 flex items-center justify-center bg-white border-b border-gray-200 z-20 transition-transform duration-200"
          style={{ 
            top: 'calc(109px + env(safe-area-inset-top, 0px))',
            transform: `translateY(${Math.min(pullDistance, 120) - 60}px)`,
            height: '60px'
          }}
        >
          {pullDistance >= 80 ? (
            <div className="flex items-center gap-2 text-green-600">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Bırakınca yenilenecek</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <RefreshCw 
                className="w-5 h-5 transition-transform" 
                style={{ transform: `rotate(${pullDistance * 3}deg)` }}
              />
              <span className="text-sm">Aşağı çekin</span>
            </div>
          )}
        </div>
      )}

      {/* Fixed Hero Section */}
      <div ref={heroRef} className={`fixed left-0 right-0 ${isMerchant ? 'bg-gradient-to-br from-blue-600 via-blue-500 to-blue-600 text-white' : 'bg-gradient-to-br from-green-600 via-green-500 to-emerald-600 text-white'}`} style={{ 
        top: 'env(safe-area-inset-top, 0px)',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        height: 'auto',
        minHeight: '56px', // increased to avoid overlapping header/search
        zIndex: 100
      }}>
        <div className="px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="bg-white/20 rounded-full p-2 flex-shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">esnaftaucuz</h1>
            <p className={`text-xs opacity-90 leading-tight ${isMerchant ? 'text-blue-50' : 'text-green-50'}`}>{t('HERO_SUB')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user?.name && (
              <div className="block mr-2">
                <span className={`text-sm font-medium ${isMerchant ? 'text-blue-50' : 'text-white'}`}>
                  {String(user.name).split(' ')[0]}
                </span>
              </div>
            )}
            <button
              onClick={() => navigate('/app/notifications')}
              className="p-2 hover:bg-white/20 rounded-full flex-shrink-0 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center font-semibold">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
              aria-label="Toggle language"
              className="ml-2 px-3 py-1 rounded bg-white/20 text-sm"
            >
              {lang === 'tr' ? 'TR' : 'EN'}
            </button>
          </div>
        </div>
      </div>

      {/* Header - positioned directly below hero with no gap */}
      <div ref={headerRef} className="bg-white border-b border-gray-200 sticky" style={{ 
        // place the search/header directly below the hero (measured heroHeight) with a small gap
        top: `calc(${heroHeight + HEADER_GAP}px + env(safe-area-inset-top, 0px))`, 
        margin: 0, 
        padding: 0,
        zIndex: 99
      }}>
        <div className="px-4 py-1.5" style={{ marginTop: 0 }}>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('SEARCH_PLACEHOLDER')}
                className="pl-10"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Filtrele</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div>
                    <h3 className="mb-3">Yer Türü</h3>
                    <div className="space-y-2">
                      {['pazar', 'manav', 'market', 'kasap'].map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={type}
                            checked={filters[type as keyof typeof filters] as boolean}
                            onCheckedChange={(checked) => setFilters({ ...filters, [type]: checked })}
                          />
                          <Label htmlFor={type} className="capitalize">{type}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3">Zaman</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="todayOnly"
                        checked={filters.todayOnly}
                        onCheckedChange={(checked) => setFilters({ ...filters, todayOnly: !!checked })}
                      />
                      <Label htmlFor="todayOnly">Sadece bugün girilenler</Label>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3">Güven</h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="withPhoto"
                          checked={filters.withPhoto}
                          onCheckedChange={(checked) => setFilters({ ...filters, withPhoto: !!checked })}
                        />
                        <Label htmlFor="withPhoto">Fotoğraflı</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="verified"
                          checked={filters.verified}
                          onCheckedChange={(checked) => setFilters({ ...filters, verified: !!checked })}
                        />
                        <Label htmlFor="verified">Doğrulanmış</Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={async () => {
                        await loadData();
                        toast.success(t('REFRESHED'));
                      }}
                    >
                      {t('FILTER_APPLY')}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setFilters({
                          pazar: false,
                          manav: false,
                          market: false,
                          kasap: false,
                          todayOnly: false,
                          withPhoto: false,
                          verified: false,
                        });
                      }}
                    >
                      {t('CLEAR')}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Content */}
        <div 
        ref={scrollContainerRef}
        className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6 space-y-3 sm:space-y-4 overflow-y-auto max-w-7xl mx-auto"
          style={{ 
          paddingTop: pullDistance > 0 ? `${Math.min(pullDistance, 60)}px` : '0px',
          // account for hero (measured) + measured header height so content starts immediately under search box
          marginTop: `calc(${heroHeight + HEADER_GAP}px + env(safe-area-inset-top, 0px) + ${headerHeight}px - ${HEADER_OVERLAP}px)`,
          minHeight: `calc(100vh - (${heroHeight + HEADER_GAP}px + ${headerHeight}px - ${HEADER_OVERLAP}px) - env(safe-area-inset-top, 0px))`,
          maxHeight: `calc(100vh - (${heroHeight + HEADER_GAP}px + ${headerHeight}px - ${HEADER_OVERLAP}px) - env(safe-area-inset-top, 0px))`,
          transition: pullDistance === 0 ? 'padding-top 0.2s' : 'none',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Trend Products - En üste taşındı */}
        {!searchResults && (
          <section>
            <h2 className="text-base sm:text-lg mb-0 sm:mb-0 text-gray-900 font-semibold">Bugun En Cok Bakilanlar</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
              {trendProducts.length > 0 ? (
                trendProducts.slice(0, 6).map((product) => (
                  <div
                    key={product.id || product._id}
                    onClick={() => navigate(`/app/product/${product.id || product._id}`)}
                    className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                  >
                    <div className="flex flex-col gap-1.5 sm:gap-2">
                      <div className="w-full h-12 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <Package className={`w-4 h-4 sm:w-6 sm:h-6 text-gray-400 ${product.image ? 'hidden' : ''}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate text-xs sm:text-sm">{product.name}</h3>
                        <p className="text-xs text-gray-500 truncate">{product.category}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 col-span-full">Henüz trend ürün yok</p>
              )}
            </div>
          </section>
        )}

        {/* Search Results */}
        {searchResults && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {lang === 'tr' ? `Arama Sonuçları: "${searchQuery}"` : `Search results: "${searchQuery}"`}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSearch}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Temizle
              </Button>
            </div>
            {isSearching && (
              <div className="text-sm text-gray-500">Araniyor...</div>
            )}

              <>
                {/* Products Results */}
                {searchResults.products.length > 0 && (
                  <section>
                    <h3 className="text-base font-semibold mb-3 text-gray-700">
                      Ürünler ({searchResults.products.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                      {searchResults.products.map((product) => (
                        <div
                          key={product.id || product._id}
                          onClick={() => navigate(`/app/product/${product.id || product._id}`)}
                          className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                        >
                          <div className="flex flex-col gap-1.5 sm:gap-2">
                            <div className="w-full h-12 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                              {product.image ? (
                                <img 
                                  src={product.image} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <Package className={`w-4 h-4 sm:w-6 sm:h-6 text-gray-400 ${product.image ? 'hidden' : ''}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate text-xs sm:text-sm">{product.name}</h4>
                              <p className="text-xs text-gray-500 truncate">{product.category}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Prices Results */}
                {searchResults.prices.length > 0 && (
                  <section>
                    <h3 className="text-base font-semibold mb-3 text-gray-700">
                      Fiyatlar ({searchResults.prices.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {searchResults.prices.map((item) => (
                        (() => {
                          const productDisplayName =
                            item.product?.name ||
                            (item as any).product_name ||
                            (item as any).productName ||
                            (item as any).name ||
                            'Urun';
                          const productImage = item.product?.image;
                          const previewImage = item.photo || productImage;
                          return (
                        <div
                          key={item.id || item._id}
                          onClick={() => {
                            const pid = item.product?.id || item.product?._id || (item as any).product_id;
                            if (!pid) return;
                            navigate(`/app/product/${pid}`);
                          }}
                          className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                        >
                          <div className="flex gap-3 sm:gap-4">
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {previewImage ? (
                                <>
                                  <img 
                                    src={previewImage} 
                                    alt={`${productDisplayName} - Gorsel`}
                                    className="w-full h-full object-cover"
                                    title={item.photo ? 'Kullanici tarafindan yuklenen fotograf' : 'Urun gorseli'}
                                    onError={(e) => {
                                      console.error('Card image failed to load:', previewImage);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                  {item.photo && (
                                    <div className="absolute top-1 right-1 bg-green-600 text-white text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-semibold shadow-md">
                                      📷
                                    </div>
                                  )}
                                </>
                              ) : null}
                              <Package className={`w-6 h-6 sm:w-8 sm:h-8 text-gray-400 ${previewImage ? 'hidden' : ''}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base sm:text-lg text-gray-900 font-medium truncate">{productDisplayName}</h3>
                                  <p className="text-xl sm:text-2xl text-green-600 font-semibold mt-1">
                                    {formatPrice(item.price)} TL{' '}
                                    <span className="text-xs sm:text-sm text-gray-500 font-normal">/ {item.unit}</span>
                                  </p>
                                </div>
                                {isToday(item.created_at || item.createdAt || '') && (
                                  <Badge className="bg-green-600 ml-2 flex-shrink-0 text-xs">BUGÜN</Badge>
                                )}
                              </div>
                              <div className="mb-1.5 sm:mb-2">
                                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2">
                                  <span className="flex items-center gap-1 min-w-0 flex-1">
                                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span className="truncate">{item.location?.name || 'Konum bilgisi yok'}</span>
                                  </span>
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                    {formatTimeAgo(item.created_at || item.createdAt || '')}
                                  </span>
                                </div>
                                {/* Konuma Git Button - Extract coordinates from item or location */}
                                {(() => {
                                  // Prioritize coordinates strings over item.lat/lng (more reliable)
                                  let lat: number | undefined;
                                  let lng: number | undefined;
                                  
                                  // Priority 1: item.coordinates (if directly set on price)
                                  let coords = (item as any).coordinates;
                                  if (coords && typeof coords === 'string') {
                                    const match = coords.match(/\(([^,]+),([^)]+)\)/);
                                    if (match) {
                                      lng = parseFloat(match[1]);
                                      lat = parseFloat(match[2]);
                                    }
                                  }
                                  
                                  // Priority 2: location.coordinates
                                  if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && item.location?.coordinates) {
                                    coords = item.location.coordinates;
                                    if ((coords as any).lat !== undefined && (coords as any).lng !== undefined) {
                                      lat = (coords as any).lat;
                                      lng = (coords as any).lng;
                                    } else if ((coords as any).x !== undefined && (coords as any).y !== undefined) {
                                      // Old format: x = lng, y = lat
                                      lng = (coords as any).x;
                                      lat = (coords as any).y;
                                    } else if (typeof coords === 'string') {
                                      // PostgreSQL POINT string format: (lng,lat)
                                      const match = coords.match(/\(([^,]+),([^)]+)\)/);
                                      if (match) {
                                        lng = parseFloat(match[1]);
                                        lat = parseFloat(match[2]);
                                      }
                                    }
                                  }
                                  
                                  // Fallback to item.lat/lng if coordinates not available
                                  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                                    lat = item.lat;
                                    lng = item.lng;
                                  }
                                  
                                  return (lat && lng && !isNaN(lat) && !isNaN(lng)) ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full sm:w-auto text-xs h-7 px-2 border-green-600 text-green-600 hover:bg-green-50"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent card click
                                        console.log('🧭 Navigating to map with coordinates:', { lat, lng, productName: item.product?.name });
                                        const productId = item.product?.id || item.product?._id;
                                        const url = productId 
                                          ? `/app/map?lat=${lat}&lng=${lng}&focus=true&productId=${productId}`
                                          : `/app/map?lat=${lat}&lng=${lng}&focus=true`;
                                        navigate(url);
                                      }}
                                    >
                                      <Navigation className="w-3 h-3 mr-1" />
                                      Konuma Git
                                    </Button>
                                  ) : null;
                                })()}
                              </div>
                              {item.user && (
                                <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                                  <Avatar className="w-5 h-5 sm:w-6 sm:h-6">
                                    <AvatarImage src={item.user.avatar} />
                                    <AvatarFallback className="bg-green-600 text-white text-xs">
                                      {item.user.name?.charAt(0)?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs sm:text-sm text-gray-600">{item.user.name}</span>
                                </div>
                              )}
                              {(item.is_verified || item.isVerified) && (
                                <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 text-xs sm:text-sm text-green-600">
                                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span>Doğrulanmış</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                          );
                        })()
                      ))}
                    </div>
                  </section>
                )}

                {/* Locations Results */}
                {searchResults.locations.length > 0 && (
                  <section>
                    <h3 className="text-base font-semibold mb-3 text-gray-700">
                      Yerler ({searchResults.locations.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {searchResults.locations.map((location) => (
                        <div
                          key={location.id}
                          onClick={() => navigate(`/app/location/${location.id}`)}
                          className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">{location.name}</h3>
                              <p className="text-sm text-gray-600 mb-1 capitalize">{location.type}</p>
                              {location.address && (
                                <p className="text-xs text-gray-500">{location.address}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {location.city}{location.district && `, ${location.district}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* No Results */}
                {searchResults.products.length === 0 && 
                 searchResults.prices.length === 0 && 
                 searchResults.locations.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-2">{t('NO_RESULTS_TITLE')}</p>
                    <p className="text-sm text-gray-500">
                      {t('NO_RESULTS_DESC', { q: searchQuery })}
                    </p>
                  </div>
                )}
              </>
          </div>
        )}

        {/* Normal Content (when not searching) */}
        {!searchQuery.trim() && (
          <>
            {isLoading && !hasAnyData ? (
              <div className="text-center py-8 text-gray-500">{t('LOADING')}</div>
            ) : (
              <>
            {/* Merchant Shops */}
            {merchantShops.length > 0 && (
              <section>
                <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">{t('STORES_TITLE')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {merchantShops.map((shop) => {
                    const merchantId = shop?.id || shop?.merchant_id || shop?.merchant?.id;
                    if (!merchantId) return null;
                    return (
                    <button
                      type="button"
                      key={merchantId}
                      onClick={() => navigate(`/app/merchant-shop/${merchantId}`)}
                      className="bg-white rounded-lg p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 flex-shrink-0">
                          <AvatarImage src={shop.avatar} />
                          <AvatarFallback className="bg-green-600 text-white">
                            {shop.name?.charAt(0)?.toUpperCase() || 'E'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg truncate">{shop.name || 'Esnaf'}</h3>
                            <Badge className="bg-blue-600 text-white text-xs">Dükkan</Badge>
                          </div>
                          <p className="text-sm text-gray-500">Esnaf ürünlerini görüntüle</p>
                        </div>
                      </div>
                    </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recent Prices - always visible even without location permission */}
            <section>
              <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">Son Eklenen Fiyatlar</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentPrices.length > 0 ? (
                  recentPrices.slice(0, 6).map((item) => {
                    if (!item) return null;
                    const productName =
                      item.product?.name ||
                      (item as any).product_name ||
                      (item as any).productName ||
                      (item as any).name ||
                      'Urun';
                    return (
                      <div
                        key={item.id || item._id}
                        onClick={() => {
                          const pid = item.product?.id || item.product?._id || (item as any).product_id;
                          if (!pid) return;
                          navigate(`/app/product/${pid}`);
                        }}
                        className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                      >
                        <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg text-gray-900 font-medium truncate">{productName}</h3>
                            <p className="text-xl sm:text-2xl text-green-600 font-semibold mt-1">
                              {formatPrice(item.price)} TL{' '}
                              <span className="text-xs sm:text-sm text-gray-500 font-normal">/ {item.unit}</span>
                            </p>
                          </div>
                          {isToday(item.created_at || item.createdAt || '') && (
                            <Badge className="bg-green-600 ml-2 flex-shrink-0 text-xs">BUGÜN</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <span className="flex items-center gap-1 min-w-0 flex-1">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="truncate">{item.location?.name || 'Konum bilgisi yok'}</span>
                          </span>
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            {formatTimeAgo(item.created_at || item.createdAt || '')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 col-span-full">Henuz fiyat verisi bulunamadi</p>
                )}
              </div>
            </section>

            {/* Nearby Cheap - Only show if user location is available */}
            {userLocation && (
            <section>
              <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">Sana Yakın En Ucuz</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(nearbyCheapest.length > 0 ? nearbyCheapest : recentPrices).length > 0 ? (
                  (nearbyCheapest.length > 0 ? nearbyCheapest : recentPrices).slice(0, 4).map((item) => {
                    if (!item) return null;
                    const fallbackProductName =
                      item.product?.name ||
                      (item as any).product_name ||
                      (item as any).productName ||
                      (item as any).name ||
                      'Urun';
                    return (
                      <div
                        key={item.id || item._id}
                        onClick={() => {
                          const pid = item.product?.id || item.product?._id || (item as any).product_id;
                          if (!pid) return;
                          navigate(`/app/product/${pid}`);
                        }}
                        className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                      >
                        <div className="flex gap-3 sm:gap-4">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {item.product?.image ? (
                              <img 
                                src={item.product.image} 
                                alt={fallbackProductName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <Package className={`w-6 h-6 sm:w-8 sm:h-8 text-gray-400 ${item.product?.image ? 'hidden' : ''}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base sm:text-lg text-gray-900 font-medium truncate">{fallbackProductName}</h3>
                                <p className="text-xl sm:text-2xl text-green-600 font-semibold mt-1">
                                  {formatPrice(item.price)} TL{' '}
                                  <span className="text-xs sm:text-sm text-gray-500 font-normal">/ {item.unit}</span>
                                </p>
                              </div>
                              {isToday(item.created_at || item.createdAt || '') && (
                                <Badge className="bg-green-600 ml-2 flex-shrink-0 text-xs">BUGÜN</Badge>
                              )}
                            </div>
                            <div className="mb-1.5 sm:mb-2">
                              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2">
                                <span className="flex items-center gap-1 min-w-0 flex-1">
                                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span className="truncate">{item.location?.name || 'Konum bilgisi yok'}</span>
                                </span>
                                <span className="flex items-center gap-1 flex-shrink-0">
                                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                  {formatTimeAgo(item.created_at || item.createdAt || '')}
                                </span>
                              </div>
                              {/* Konuma Git Button - Extract coordinates from item or location */}
                              {(() => {
                                // Prioritize location.coordinates over item.lat/lng (more reliable)
                                let lat: number | undefined;
                                let lng: number | undefined;
                                
                                // First, try to parse from location.coordinates
                                const coords = item.location?.coordinates;
                                if (coords) {
                                  if ((coords as any).lat !== undefined && (coords as any).lng !== undefined) {
                                    lat = (coords as any).lat;
                                    lng = (coords as any).lng;
                                  } else if ((coords as any).x !== undefined && (coords as any).y !== undefined) {
                                    // Old format: x = lng, y = lat
                                    lng = (coords as any).x;
                                    lat = (coords as any).y;
                                  } else if (typeof coords === 'string') {
                                    // PostgreSQL POINT string format: (lng,lat)
                                    const match = coords.match(/\(([^,]+),([^)]+)\)/);
                                    if (match) {
                                      lng = parseFloat(match[1]);
                                      lat = parseFloat(match[2]);
                                    }
                                  }
                                }
                                
                                // Fallback to item.lat/lng if coordinates not available
                                if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                                  lat = item.lat;
                                  lng = item.lng;
                                }
                                
                                return (lat && lng && !isNaN(lat) && !isNaN(lng)) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full sm:w-auto text-xs h-7 px-2 border-green-600 text-green-600 hover:bg-green-50"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent card click
                                      navigate(`/app/map?lat=${lat}&lng=${lng}&focus=true`);
                                    }}
                                  >
                                    <Navigation className="w-3 h-3 mr-1" />
                                    Konuma Git
                                  </Button>
                                ) : null;
                              })()}
                            </div>
                            {item.user && (
                              <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                                <Avatar className="w-5 h-5 sm:w-6 sm:h-6">
                                  <AvatarImage src={item.user.avatar} />
                                  <AvatarFallback className="bg-green-600 text-white text-xs">
                                    {item.user.name?.charAt(0)?.toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs sm:text-sm text-gray-600">{item.user.name}</span>
                              </div>
                            )}
                            {(item.is_verified || item.isVerified) && (
                              <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 text-xs sm:text-sm text-green-600">
                                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>Doğrulanmış</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }).filter(Boolean)
                ) : (
                  <p className="text-sm text-gray-500">Henüz fiyat girilmemiş</p>
                )}
              </div>
            </section>
            )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
