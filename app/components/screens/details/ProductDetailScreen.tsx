import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, CheckCircle2, ThumbsUp, Flag, Package, Navigation } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '../../ui/avatar';
import { productsAPI, pricesAPI } from '../../../services/supabase-api';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

interface Price {
  id: string;
  price: number;
  unit: string;
  product?: {
    id: string;
    name: string;
    image?: string;
  };
  location: {
    id: string;
    name: string;
    type: string;
    coordinates?: { x: number; y: number } | { lat: number; lng: number };
  };
  is_verified: boolean;
  created_at: string;
  photo?: string;
  user?: {
    id: string;
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

export default function ProductDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [sortBy, setSortBy] = useState<'cheapest' | 'newest' | 'verified'>('cheapest');
  const [isLoading, setIsLoading] = useState(true);
  const [averagePrice, setAveragePrice] = useState(0);
  const [cheapestToday, setCheapestToday] = useState<Price | null>(null);

  useEffect(() => {
    if (id) {
      loadProductData();
    }
  }, [id, sortBy]);

  // Supabase Realtime subscription for this product's prices
  useEffect(() => {
    if (!id) return;
    
    console.log('🔴 Setting up Realtime subscription for product prices:', id);
    
    const channel = supabase
      .channel(`product-prices-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'prices',
          filter: `product=eq.${id}`, // Only listen to prices for this product
        },
        (payload) => {
          console.log('🔴 Realtime event for product:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            const newPrice = payload.new as any;
            console.log('➕ New price added for product:', newPrice);
            
            // Reload prices to get full data with relations
            loadProductData();
            
            toast.success('Yeni fiyat eklendi!', {
              description: `${newPrice.price} ₺ / ${newPrice.unit}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedPriceId = payload.new.id || payload.new._id;
            console.log('🔄 Price updated:', updatedPriceId);
            
            // Fetch full price data with relations and reload all data
            // Realtime payload doesn't include related data (product, location, user)
            loadProductData();
            
            toast.info('Fiyat güncellendi');
          } else if (payload.eventType === 'DELETE') {
            const deletedPriceId = payload.old.id || payload.old._id;
            console.log('🗑️ Price deleted:', deletedPriceId);
            
            // Remove from prices list
            setPrices((prev) =>
              prev.filter((p) => (p.id || p._id) !== deletedPriceId)
            );
            
            // Recalculate average and cheapest
            loadProductData();
            
            toast.info('Fiyat silindi');
          }
        }
      )
      .subscribe((status) => {
        console.log('🔴 Realtime subscription status for product:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription active for product:', id);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error for product:', id);
        }
      });
    
    // Cleanup subscription on unmount or product change
    return () => {
      console.log('🔴 Cleaning up Realtime subscription for product:', id);
      supabase.removeChannel(channel);
    };
  }, [id]);

  const loadProductData = async () => {
    try {
      setIsLoading(true);
      
      // Load product
      const productData = await productsAPI.getById(id!);
      setProduct(productData);

      // Load prices
      const priceData = await pricesAPI.getByProduct(id!, sortBy);
      console.log('📊 ProductDetailScreen - Prices loaded:', priceData);
      console.log('📍 Location data check:', priceData.map((p: any) => ({
        id: p.id,
        location: p.location,
        locationName: p.location?.name,
        locationCity: p.location?.city,
        locationDistrict: p.location?.district,
        locationId: p.location?.id,
        hasLocation: !!p.location,
        lat: p.lat,
        lng: p.lng,
        locationCoordinates: p.location?.coordinates,
      })));
      setPrices(priceData);

      // Calculate average price
      if (priceData.length > 0) {
        const total = priceData.reduce((sum: number, p: Price) => sum + p.price, 0);
        setAveragePrice(total / priceData.length);
      }

      // Find cheapest today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayPrices = priceData.filter((p: Price) => {
        const priceDate = new Date(p.created_at || p.createdAt || '');
        return priceDate >= today;
      });
      if (todayPrices.length > 0) {
        const cheapest = todayPrices.reduce((min: Price, p: Price) =>
          p.price < min.price ? p : min
        );
        setCheapestToday(cheapest);
      }
    } catch (error) {
      console.error('Failed to load product data:', error);
      toast.error('Ürün bilgileri yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (priceId: string) => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return;
    }

    try {
      await pricesAPI.verify(priceId);
      toast.success('Fiyat doğrulandı');
      loadProductData();
    } catch (error: any) {
      toast.error(error.message || 'Doğrulama başarısız');
    }
  };

  const handleReport = async (priceId: string) => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return;
    }

    try {
      await pricesAPI.report(priceId);
      toast.success('Fiyat rapor edildi');
    } catch (error: any) {
      toast.error(error.message || 'Raporlama başarısız');
    }
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',');
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Bilinmiyor';
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
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isOld = (dateString: string) => {
    if (!dateString) return true;
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 1;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Ürün bulunamadı</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
              <Package className={`w-6 h-6 text-gray-400 ${product.image ? 'hidden' : ''}`} />
            </div>
            <h1 className="text-xl">{product.name}</h1>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white p-6 border-b border-gray-200">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
            <Package className={`w-10 h-10 text-gray-400 ${product.image ? 'hidden' : ''}`} />
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-600 mb-1">Ortalama fiyat</div>
            <div className="text-3xl text-gray-900 mb-3">
              {formatPrice(averagePrice)} TL
            </div>
            {cheapestToday && (
              <div className="text-sm text-green-600">
                Bugün en ucuz: {formatPrice(cheapestToday.price)} TL
              </div>
            )}
          </div>
        </div>
      </div>

      {/* All Product Photos Section */}
      {prices.some(p => p.photo) && (() => {
        // Get photos sorted by current sort criteria
        const photosWithPrices = prices.filter(p => p.photo);
        let sortedPhotos = [...photosWithPrices];
        
        // Sort photos based on current sortBy selection
        switch (sortBy) {
          case 'cheapest':
            sortedPhotos.sort((a, b) => a.price - b.price);
            break;
          case 'newest':
            sortedPhotos.sort((a, b) => {
              const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
              const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
              return dateB - dateA; // Newest first
            });
            break;
          case 'verified':
            sortedPhotos.sort((a, b) => {
              const aVerified = a.is_verified || a.isVerified ? 1 : 0;
              const bVerified = b.is_verified || b.isVerified ? 1 : 0;
              if (aVerified !== bVerified) {
                return bVerified - aVerified; // Verified first
              }
              // If both have same verification status, sort by newest
              const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
              const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
              return dateB - dateA;
            });
            break;
        }
        
        return (
          <div className="bg-white p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-3">
              Bu Ürün İçin Eklenen Tüm Resimler ({photosWithPrices.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sortedPhotos.map((item) => {
                const itemId = item.id || item._id || '';
                const isVerified = item.is_verified || item.isVerified || false;
                return (
                  <div key={itemId} className="relative group">
                    <img
                      src={item.photo}
                      alt={product.name}
                      className="w-full h-32 sm:h-40 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent text-white text-xs p-2 rounded-b-lg">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{formatPrice(item.price)} ₺</div>
                          {isVerified && (
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-xs opacity-90">{item.location?.name}</div>
                        {item.user && (
                          <div className="flex items-center gap-1.5 pt-1 border-t border-white/20">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={item.user.avatar} />
                              <AvatarFallback className="bg-green-600 text-white text-[10px]">
                                {item.user.name?.charAt(0)?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs opacity-90 truncate">{item.user.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Filters */}
      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2>Mevcut Fiyatlar</h2>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cheapest">En ucuz</SelectItem>
              <SelectItem value="newest">En yeni</SelectItem>
              <SelectItem value="verified">En güvenilir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price List */}
      <div className="p-4 space-y-3">
        {prices.length > 0 ? (
          prices.map((item) => {
            const itemId = item.id || item._id || '';
            const createdAt = item.created_at || item.createdAt || '';
            const isVerified = item.is_verified || item.isVerified || false;
            const userId = item.user?.id || item.user?._id || '';
            // Debug: Log location data
            console.log('🔍 Price item location check:', {
              itemId,
              location: item.location,
              locationName: item.location?.name,
              locationId: item.location?.id,
              locationCity: item.location?.city,
              locationDistrict: item.location?.district,
              locationType: item.location?.type,
              coordinates: item.location?.coordinates,
              directLat: item.lat,
              directLng: item.lng,
              location_id: (item as any).location_id, // Check if location_id exists
            });
            
            const coordinates = item.location?.coordinates;
            // Extract lat/lng from coordinates or use direct lat/lng
            let lat: number | undefined = item.lat;
            let lng: number | undefined = item.lng;
            
            if (!lat || !lng) {
              if (coordinates) {
                if ((coordinates as any).lat !== undefined && (coordinates as any).lng !== undefined) {
                  lat = (coordinates as any).lat;
                  lng = (coordinates as any).lng;
                } else if ((coordinates as any).x !== undefined && (coordinates as any).y !== undefined) {
                  // Old format: x = lng, y = lat
                  lng = (coordinates as any).x;
                  lat = (coordinates as any).y;
                } else if (typeof coordinates === 'string') {
                  // PostgreSQL POINT string format: (lng,lat)
                  const match = coordinates.match(/\(([^,]+),([^)]+)\)/);
                  if (match) {
                    lng = parseFloat(match[1]);
                    lat = parseFloat(match[2]);
                  }
                }
              }
            }
            
            const hasCoordinates = lat !== undefined && lng !== undefined;
            
            // Get location name - check multiple sources
            let locationName = 'Konum bilgisi yok';
            if (item.location) {
              // Check if location object exists
              if (item.location.name && item.location.name.trim() !== '') {
                locationName = item.location.name;
              } else if (item.location.city || item.location.district) {
                locationName = [item.location.city, item.location.district].filter(Boolean).join(' / ') || 'Konum bilgisi yok';
              } else if (item.location.type) {
                locationName = item.location.type;
              } else if (item.location.id) {
                locationName = `Konum ID: ${item.location.id}`;
              }
            } else if ((item as any).location_id) {
              // If location object is missing but location_id exists, show location_id
              locationName = `Konum ID: ${(item as any).location_id}`;
            }
            
            console.log('📍 Final location name:', locationName);
            
            return (
              <div key={itemId} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex gap-4">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-gray-200">
                    {item.photo ? (
                      <>
                        <img 
                          src={item.photo} 
                          alt={`${item.product?.name || product.name} - Kullanıcı fotoğrafı`}
                          className="w-full h-full object-cover"
                          title="Kullanıcı tarafından yüklenen fotoğraf"
                          onError={(e) => {
                            console.error('User photo failed to load:', item.photo);
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="absolute top-1 right-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow-md">
                          📷
                        </div>
                      </>
                    ) : null}
                    <Package className={`w-8 h-8 text-gray-400 ${item.photo ? 'hidden' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-2xl text-green-600 font-semibold">
                          {formatPrice(item.price)} TL{' '}
                          <span className="text-sm text-gray-500 font-normal">/ {item.unit}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{locationName}</div>
                      </div>
                      {isOld(createdAt) ? (
                        <Badge variant="secondary" className="ml-2 flex-shrink-0">Eski fiyat</Badge>
                      ) : (
                        <Badge className="bg-green-600 ml-2 flex-shrink-0">BUGÜN</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{locationName}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTimeAgo(createdAt)}
                        </span>
                        {isVerified && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            Doğrulanmış
                          </span>
                        )}
                      </div>
                      {/* Konuma Git Button */}
                      {hasCoordinates && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0 text-xs h-8 px-3 border-green-600 text-green-600 hover:bg-green-50"
                          onClick={() => {
                            navigate(`/app/map?lat=${lat}&lng=${lng}&focus=true`);
                          }}
                        >
                          <Navigation className="w-3 h-3 mr-1" />
                          Konuma Git
                        </Button>
                      )}
                    </div>

                    {item.user && (
                      <div className="flex items-center gap-2 mb-3">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={item.user.avatar} />
                          <AvatarFallback className="bg-green-600 text-white text-xs">
                            {item.user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-gray-600">{item.user.name}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleVerify(itemId)}
                        disabled={!user || userId === user.id}
                      >
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        Doğrula
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReport(itemId)}
                        disabled={!user}
                      >
                        <Flag className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-gray-500">
            Bu ürün için henüz fiyat girilmemiş
          </div>
        )}
      </div>
    </div>
  );
}
