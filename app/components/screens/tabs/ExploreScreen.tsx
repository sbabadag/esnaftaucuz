import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Bell, Filter, MapPin, Clock, CheckCircle2, Package, RefreshCw, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../ui/sheet';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { productsAPI, pricesAPI, searchAPI } from '../../../services/supabase-api';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
      
      // Load recent prices with individual timeout
      const recentPromise = pricesAPI.getAll({
        sort: 'newest',
        limit: 20,
        todayOnly: true,
      }).catch((err) => {
        console.error('❌ Failed to load recent prices:', err);
        return [];
      });
      
      // Load nearby cheapest with individual timeout
      const nearbyPromise = searchAPI.getNearbyCheapest(37.8667, 32.4833, 5000, 10).catch((err) => {
        console.error('❌ Failed to load nearby prices:', err);
        return [];
      });

      // Wait for all promises (with individual error handling)
      const [trending, recent, nearby] = await Promise.allSettled([
        trendingPromise,
        recentPromise,
        nearbyPromise,
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
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>Konya / Selçuklu ▾</span>
            </div>
            <button
              onClick={() => navigate('/app/notifications')}
              className="p-2 hover:bg-gray-100 rounded-full"
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
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
        ) : (
          <>
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

            {/* Nearby Cheap */}
            <section>
              <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">Sana Yakın En Ucuz</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nearbyCheapest.length > 0 ? (
                  nearbyCheapest.slice(0, 4).map((item) => (
                    <div
                      key={item.id || item._id}
                      onClick={() => navigate(`/app/product/${item.product.id || item.product._id}`)}
                      className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.product.image ? (
                            <img 
                              src={item.product.image} 
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <Package className={`w-6 h-6 sm:w-8 sm:h-8 text-gray-400 ${item.product.image ? 'hidden' : ''}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base sm:text-lg text-gray-900 font-medium truncate">{item.product.name}</h3>
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
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="truncate">{item.location.name}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                              {formatTimeAgo(item.created_at || item.createdAt || '')}
                            </span>
                          </div>
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

            {/* Recent Prices */}
            <section>
              <h2 className="text-base sm:text-lg mb-2 sm:mb-3 text-gray-900 font-semibold">Son Girilen Fiyatlar</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentPrices.length > 0 ? (
                  recentPrices.slice(0, 9).map((item) => (
                    <div
                      key={item.id || item._id}
                      onClick={() => navigate(`/app/product/${item.product.id || item.product._id}`)}
                      className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.product.image ? (
                            <img 
                              src={item.product.image} 
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <Package className={`w-6 h-6 sm:w-8 sm:h-8 text-gray-400 ${item.product.image ? 'hidden' : ''}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base sm:text-lg text-gray-900 font-medium truncate">{item.product.name}</h3>
                              <p className="text-xl sm:text-2xl text-green-600 font-semibold mt-1">
                                {formatPrice(item.price)} TL{' '}
                                <span className="text-xs sm:text-sm text-gray-500 font-normal">/ {item.unit}</span>
                              </p>
                            </div>
                            {isToday(item.created_at || item.createdAt || '') && (
                              <Badge className="bg-green-600 ml-2 flex-shrink-0 text-xs">BUGÜN</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="truncate">{item.location.name}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                              {formatTimeAgo(item.created_at || item.createdAt || '')}
                            </span>
                          </div>
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
