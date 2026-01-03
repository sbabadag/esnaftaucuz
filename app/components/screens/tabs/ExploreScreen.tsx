import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Bell, Filter, MapPin, Clock, CheckCircle2, Package, RefreshCw, X, Navigation } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../ui/sheet';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '../../ui/avatar';
import { productsAPI, pricesAPI, searchAPI, merchantProductsAPI } from '../../../services/supabase-api';
import { useGeolocation } from '../../../../src/hooks/useGeolocation';
import { useAuth } from '../../../contexts/AuthContext';
import { reverseGeocode } from '../../../utils/geocoding';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    products: Product[];
    prices: Price[];
    locations: any[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [trendProducts, setTrendProducts] = useState<Product[]>([]);
  const [nearbyCheapest, setNearbyCheapest] = useState<Price[]>([]);
  const [recentPrices, setRecentPrices] = useState<Price[]>([]);
  const [merchantShops, setMerchantShops] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentLocation, setCurrentLocation] = useState<string>('Konya / Selçuklu');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filters, setFilters] = useState({
    pazar: false,
    manav: false,
    market: false,
    kasap: false,
    todayOnly: false,
    withPhoto: false,
    verified: false,
  });

  // Check for search query in URL on mount
  useEffect(() => {
    const urlQuery = searchParams.get('search');
    if (urlQuery) {
      setSearchQuery(urlQuery);
      performSearch(urlQuery);
    }
  }, []);

  // Auto-fetch location on mount (only once)
  useEffect(() => {
    let mounted = true;
    
    const autoGetLocation = async () => {
      try {
        const position = await getCurrentPosition();
        
        if (position && mounted) {
          const { latitude, longitude } = position;
          console.log('📍 Auto-fetching location on mount:', { latitude, longitude });
          
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
                if (result.error && !result.error.includes('Zaman aşımı')) {
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
        }
      } catch (error) {
        console.error('Auto location fetch error:', error);
        // Silently fail - don't show error on initial load
        if (mounted) {
          setCurrentLocation('Mevcut Konum');
        }
      }
    };
    
    // Auto-fetch location on mount
    autoGetLocation();
    
    return () => {
      mounted = false;
    };
  }, []); // Only run once on mount

  // Reload data when user location or search radius changes
  useEffect(() => {
    if (userLocation) {
      console.log('📍 User location or search radius changed, reloading data...', userLocation);
      loadData();
    }
  }, [userLocation?.lat, userLocation?.lng, (user as any)?.search_radius, (user as any)?.preferences?.searchRadius]); // Reload when coordinates or radius change

  useEffect(() => {
    console.log('🔄 ExploreScreen mounted, loading data...');
    
    // Safety timeout - force loading to false after 20 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Safety timeout triggered - forcing loading to false');
      setIsLoading(false);
      setIsRefreshing(false);
      setPullDistance(0);
      toast.error('Veriler yüklenirken zaman aşımı oluştu. Lütfen tekrar deneyin.');
    }, 20000);
    
    loadData().catch((error) => {
      console.error('❌ Load data failed in useEffect:', error);
      setIsLoading(false);
      setIsRefreshing(false);
    }).finally(() => {
      clearTimeout(safetyTimeout);
    });
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Supabase Realtime subscription for price updates
  useEffect(() => {
    console.log('🔴 Setting up Realtime subscription for prices...');
    
    const channel = supabase
      .channel('prices-changes')
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
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error');
          toast.error('Gerçek zamanlı güncellemeler bağlanamadı');
        }
      });
    
    // Cleanup subscription on unmount
    return () => {
      console.log('🔴 Cleaning up Realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, [userLocation, user]);

  const loadData = async (isRefresh = false) => {
    // Set loading state immediately
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    console.log('🔄 Loading data...');
    
    // Force timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Loading timeout - forcing completion');
      setIsLoading(false);
      setIsRefreshing(false);
      setPullDistance(0);
      toast.error('Veriler yüklenirken zaman aşımı oluştu');
    }, 15000); // 15 second timeout

    try {
      // Load trending products with individual timeout
      const trendingPromise = productsAPI.getTrending().catch((err) => {
        console.error('❌ Failed to load trending products:', err);
        return [];
      });
      
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
      
      // Load recent prices with location filter (only if user location is available)
      const recentPromise = (userLat && userLng) 
        ? pricesAPI.getAll({
            sort: 'newest',
            limit: 100, // Load more to filter by location
            todayOnly: true,
            lat: userLat,
            lng: userLng,
            radius: searchRadiusMeters,
          }).catch((err) => {
            console.error('❌ Failed to load recent prices:', err);
            return [];
          })
        : Promise.resolve([]);
      
      // Load nearby cheapest ONLY if user location is available
      // This ensures we only show prices within the user's search radius
      const nearbyPromise = (userLat && userLng)
        ? searchAPI.getNearbyCheapest(userLat, userLng, searchRadiusMeters, 10).catch((err) => {
            console.error('❌ Failed to load nearby prices:', err);
            return [];
          })
        : Promise.resolve([]);
      
      // Load merchant shops
      const merchantShopsPromise = merchantProductsAPI.getAllMerchantShops(20).catch((err) => {
        console.error('❌ Failed to load merchant shops:', err);
        return [];
      });

      // Wait for all promises (with individual error handling)
      const [trending, recent, nearby, merchantShops] = await Promise.allSettled([
        trendingPromise,
        recentPromise,
        nearbyPromise,
        merchantShopsPromise,
      ]);

      // Process results
      if (trending.status === 'fulfilled') {
        console.log('📦 Trending products loaded:', trending.value?.length || 0);
        setTrendProducts(trending.value || []);
      } else {
        console.error('❌ Trending products failed:', trending.reason);
        setTrendProducts([]);
      }

      if (recent.status === 'fulfilled') {
        console.log('📦 Recent prices loaded:', recent.value?.length || 0);
        setRecentPrices(recent.value || []);
      } else {
        console.error('❌ Recent prices failed:', recent.reason);
        setRecentPrices([]);
      }

      if (nearby.status === 'fulfilled') {
        console.log('📦 Nearby prices loaded:', nearby.value?.length || 0);
        setNearbyCheapest(nearby.value || []);
      } else {
        console.error('❌ Nearby prices failed:', nearby.reason);
        setNearbyCheapest([]);
      }

      if (merchantShops.status === 'fulfilled') {
        console.log('🏪 Merchant shops loaded:', merchantShops.value?.length || 0);
        setMerchantShops(merchantShops.value || []);
      } else {
        console.error('❌ Merchant shops failed:', merchantShops.reason);
        setMerchantShops([]);
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
      
      // Set empty arrays to prevent infinite loading
      setTrendProducts([]);
      setRecentPrices([]);
      setNearbyCheapest([]);
      
      toast.error(error.message || 'Veriler yüklenirken bir hata oluştu');
    } finally {
      clearTimeout(timeoutId);
      console.log('🏁 Setting loading states to false');
      setIsLoading(false);
      setIsRefreshing(false);
      setPullDistance(0);
    }
  };

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
            toast.warning('Konum tespit edildi', {
              description: `Adres bilgisi yüklenemedi: ${errorMsg}. Konumunuz kaydedildi.`,
            });
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
    if (!query.trim()) {
      setSearchResults(null);
      setSearchParams({});
      return;
    }
    
    try {
      setIsSearching(true);
      const results = await searchAPI.search(query, 'all');
      setSearchResults(results);
      setSearchParams({ search: query });
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error(error.message || 'Arama yapılırken bir hata oluştu');
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchParams({});
      return;
    }
    await performSearch(searchQuery);
  };

  const clearSearch = () => {
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
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-white border-b border-gray-200 z-20 transition-transform duration-200"
          style={{ 
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

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 flex-1 min-w-0">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{currentLocation}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs flex-shrink-0"
                onClick={handleGetCurrentLocation}
                disabled={isGettingLocation}
                title="Mevcut konumu al"
              >
                {isGettingLocation ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Navigation className="w-3 h-3" />
                )}
              </Button>
            </div>
            <button
              onClick={() => navigate('/app/notifications')}
              className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0"
            >
              <Bell className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ürün veya yer ara"
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
                        toast.success('Filtre uygulandı');
                      }}
                    >
                      Filtreyi Uygula
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
                      Temizle
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
        className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overflow-y-auto max-w-7xl mx-auto"
        style={{ 
          paddingTop: pullDistance > 0 ? `${Math.min(pullDistance, 60)}px` : '0',
          transition: pullDistance === 0 ? 'padding-top 0.2s' : 'none'
        }}
      >
        {/* Search Results */}
        {searchResults && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Arama Sonuçları: "{searchQuery}"
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

            {isSearching ? (
              <div className="text-center py-8 text-gray-500">Aranıyor...</div>
            ) : (
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
                        <div
                          key={item.id || item._id}
                          onClick={() => navigate(`/app/product/${item.product?.id || item.product?._id || ''}`)}
                          className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                        >
                          <div className="flex gap-3 sm:gap-4">
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {item.photo ? (
                                <>
                                  <img 
                                    src={item.photo} 
                                    alt={`${item.product?.name || 'Ürün'} - Kullanıcı fotoğrafı`}
                                    className="w-full h-full object-cover"
                                    title="Kullanıcı tarafından yüklenen fotoğraf"
                                    onError={(e) => {
                                      console.error('User photo failed to load:', item.photo);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                  <div className="absolute top-1 right-1 bg-green-600 text-white text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-semibold shadow-md">
                                    📷
                                  </div>
                                </>
                              ) : null}
                              <Package className={`w-6 h-6 sm:w-8 sm:h-8 text-gray-400 ${item.photo ? 'hidden' : ''}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base sm:text-lg text-gray-900 font-medium truncate">{item.product?.name || 'Bilinmeyen Ürün'}</h3>
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
                    <p className="text-gray-600 font-medium mb-2">Sonuç bulunamadı</p>
                    <p className="text-sm text-gray-500">
                      "{searchQuery}" için arama sonucu bulunamadı. Farklı bir terim deneyin.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Normal Content (when not searching) */}
        {!searchResults && (
          <>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
            ) : (
              <>
            {/* Merchant Shops */}
            {merchantShops.length > 0 && (
              <section>
                <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">Esnaf Dükkanları</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {merchantShops.map((shop) => (
                    <div
                      key={shop.id}
                      onClick={() => navigate(`/app/merchant-shop/${shop.id}`)}
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
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Trend Products */}
            <section>
              <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">Bugün En Çok Bakılanlar</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {trendProducts.length > 0 ? (
                  trendProducts.slice(0, 12).map((product) => (
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

            {/* Nearby Cheap - Only show if user location is available */}
            {userLocation && (
            <section>
              <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">Sana Yakın En Ucuz</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nearbyCheapest.length > 0 ? (
                  nearbyCheapest.slice(0, 4).map((item) => (
                    <div
                      key={item.id || item._id}
                      onClick={() => navigate(`/app/product/${item.product?.id || item.product?._id || ''}`)}
                      className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.product?.image ? (
                            <img 
                              src={item.product.image} 
                              alt={item.product?.name || 'Ürün'}
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
                              <h3 className="text-base sm:text-lg text-gray-900 font-medium truncate">{item.product?.name || 'Bilinmeyen Ürün'}</h3>
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
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Yakınınızda fiyat bulunamadı</p>
                )}
              </div>
            </section>
            )}

            {/* Recent Prices */}
            <section>
              <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">Son Girilen Fiyatlar</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentPrices.length > 0 ? (
                  recentPrices.slice(0, 9).map((item) => (
                    <div
                      key={item.id || item._id}
                      onClick={() => navigate(`/app/product/${item.product?.id || item.product?._id || ''}`)}
                      className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.product?.image ? (
                            <img 
                              src={item.product.image} 
                              alt={item.product?.name || 'Ürün'}
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
                              <h3 className="text-base sm:text-lg text-gray-900 font-medium truncate">{item.product?.name || 'Bilinmeyen Ürün'}</h3>
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
                            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
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
                            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-green-600">
                              <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span>Doğrulanmış</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Henüz fiyat girilmemiş</p>
                )}
              </div>
            </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
