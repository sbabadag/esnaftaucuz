import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, CheckCircle2, ThumbsUp, Flag, Package, Navigation, Heart, Plus, Camera, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '../../ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { productsAPI, pricesAPI, favoritesAPI, locationsAPI } from '../../../services/supabase-api';
import { useAuth } from '../../../contexts/AuthContext';
import { useGeolocation } from '../../../../src/hooks/useGeolocation';
import { forwardGeocode } from '../../../utils/geocoding';
import { supabase, safeGetSession } from '../../../lib/supabase';
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

const resolveMerchantRole = (profile: any): boolean => {
  const explicit = profile?.is_merchant === true;
  const status = String(profile?.merchant_subscription_status || '').toLowerCase();
  const hasActiveSubscription = status === 'active' || status === 'past_due';
  const hasMerchantPlan = String(profile?.merchant_subscription_plan || '').trim().length > 0;
  return explicit || hasActiveSubscription || hasMerchantPlan;
};

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
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isAddPriceDialogOpen, setIsAddPriceDialogOpen] = useState(false);
  const [isSubmittingPrice, setIsSubmittingPrice] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { getCurrentPosition } = useGeolocation();
  const [priceFormData, setPriceFormData] = useState({
    price: '',
    unit: 'kg',
    locationId: '',
    locationName: '',
    photo: null as File | null,
    photoPreview: null as string | null,
    lat: null as number | null,
    lng: null as number | null,
  });
  const [locations, setLocations] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadProductData();
      checkFavoriteStatus();
    }
  }, [id, sortBy, user]);

  useEffect(() => {
    if (isAddPriceDialogOpen) {
      loadLocations();
    }
  }, [isAddPriceDialogOpen]);

  const checkFavoriteStatus = async () => {
    if (!user || !id) {
      setIsFavorited(false);
      return;
    }

    try {
      const favorited = await favoritesAPI.isFavoritedStrict(id, user.id);
      setIsFavorited(favorited);
    } catch (error) {
      console.error('Failed to check favorite status:', error);
      // Keep current UI state when read fails (do not force gray).
    }
  };

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
          filter: `product_id=eq.${id}`, // Only listen to prices for this product
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
      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const resolveAccessTokenQuick = async (): Promise<string | null> => {
        const direct = localStorage.getItem('authToken');
        if (direct) return direct;
        try {
          const { accessToken } = await safeGetSession();
          return accessToken || null;
        } catch {
          return null;
        }
      };
      const authToken = await resolveAccessTokenQuick();

      // Primary path: direct Edge Function fetch to avoid client auth/RLS edge cases on mobile.
      try {
        const feedResponse = await Promise.race([
          fetch(`${sbUrl}/functions/v1/product-detail-feed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: sbKey,
              Authorization: `Bearer ${authToken || sbKey}`,
            },
            body: JSON.stringify({ product_id: id, sort_by: sortBy, limit: 50 }),
          }),
          new Promise<any>((resolve) =>
            setTimeout(() => resolve(null), 10000),
          ),
        ]);
        const feedJson =
          feedResponse && (feedResponse as any).ok
            ? await (feedResponse as any).json().catch(() => null)
            : null;
        if (feedJson?.ok) {
          const productData = feedJson.product;
          const rows = Array.isArray(feedJson.prices) ? feedJson.prices : [];
          if (productData) setProduct(productData);
          setPrices(rows);

          if (rows.length > 0) {
            const total = rows.reduce((sum: number, p: Price) => sum + Number((p as any).price || 0), 0);
            setAveragePrice(total / rows.length);
          } else {
            setAveragePrice(0);
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayPrices = rows.filter((p: Price) => {
            const priceDate = new Date((p as any).created_at || (p as any).createdAt || '');
            return priceDate >= today;
          });
          if (todayPrices.length > 0) {
            const cheapest = todayPrices.reduce((min: Price, p: Price) =>
              Number((p as any).price || 0) < Number((min as any).price || 0) ? p : min
            );
            setCheapestToday(cheapest);
          } else {
            setCheapestToday(null);
          }
          return;
        }
      } catch (feedError) {
        console.warn('product-detail-feed failed, falling back:', feedError);
      }
      const headers = {
        apikey: sbKey,
        Authorization: `Bearer ${authToken || sbKey}`,
        Accept: 'application/json',
      };

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);

      const [productResp, pricesResp] = await Promise.all([
        fetch(
          `${sbUrl}/rest/v1/products?select=id,name,category,image,default_unit&id=eq.${id}&limit=1`,
          { headers: { ...headers, Accept: 'application/vnd.pgrst.object+json' }, signal: controller.signal }
        ),
        fetch(
          `${sbUrl}/rest/v1/prices?select=id,price,unit,created_at,is_verified,photo,coordinates,product_id,location_id,user_id&product_id=eq.${id}&order=created_at.desc&limit=50`,
          { headers, signal: controller.signal }
        ),
      ]);
      clearTimeout(tid);

      const productData = productResp.ok ? await productResp.json().catch(() => null) : null;
      if (productData) setProduct(productData);

      let priceData: any[] = [];
      if (pricesResp.ok) {
        priceData = await pricesResp.json().catch(() => []);
        if (!Array.isArray(priceData)) priceData = [];

        if (priceData.length > 0) {
          const locationIds = [...new Set(priceData.map((p: any) => p.location_id).filter(Boolean))];
          const userIds = [...new Set(priceData.map((p: any) => p.user_id).filter(Boolean))];

          const ctrl2 = new AbortController();
          const tid2 = setTimeout(() => ctrl2.abort(), 8000);
          const [locResp, userResp] = await Promise.all([
            locationIds.length
              ? fetch(`${sbUrl}/rest/v1/locations?select=id,name,type,city,district,coordinates&id=in.(${locationIds.join(',')})`, { headers, signal: ctrl2.signal })
              : Promise.resolve(null),
            userIds.length
              ? fetch(`${sbUrl}/rest/v1/users?select=id,name,avatar&id=in.(${userIds.join(',')})`, { headers, signal: ctrl2.signal })
              : Promise.resolve(null),
          ]);
          clearTimeout(tid2);

          const locations = locResp?.ok ? await locResp.json().catch(() => []) : [];
          const users = userResp?.ok ? await userResp.json().catch(() => []) : [];
          const locMap = new Map((locations || []).map((l: any) => [l.id, l]));
          const userMap = new Map((users || []).map((u: any) => [u.id, u]));

          priceData = priceData.map((p: any) => ({
            ...p,
            location: locMap.get(p.location_id) || null,
            user: userMap.get(p.user_id) || null,
          }));
        }
      }
      // Fallback to client API when direct REST path returns empty (usually auth/RLS edge cases on mobile).
      if (priceData.length === 0 && id) {
        try {
          const fallbackRows = await pricesAPI.getByProduct(id, sortBy);
          if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
            priceData = fallbackRows as any[];
          }
        } catch (fallbackError) {
          console.warn('Price fallback load failed:', fallbackError);
        }
      }

      // Keep numeric math stable even if backend returns numeric strings.
      priceData = (priceData || []).map((row: any) => ({
        ...row,
        price: typeof row?.price === 'number' ? row.price : Number(row?.price || 0),
      }));

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

  const handleToggleFavorite = async () => {
    if (!user) {
      toast.error('Favorilere eklemek için giriş yapmanız gerekiyor');
      return;
    }

    if (!id) return;

    const previousStatus = isFavorited;
    try {
      setIsTogglingFavorite(true);
      // Optimistic UI feedback so the tap is immediately visible.
      const desiredStatus = !previousStatus;
      setIsFavorited(desiredStatus);
      const newStatus = await favoritesAPI.setFavoriteState(id, user.id, desiredStatus, {
        id,
        name: product?.name,
        image: product?.image,
        category: product?.category,
      });
      setIsFavorited(newStatus);
      toast.success(newStatus ? 'Favorilere eklendi' : 'Favorilerden kaldirildi');
    } catch (error: any) {
      console.error('Failed to toggle favorite:', error);
      setIsFavorited(previousStatus);
      toast.error(String(error?.message || 'Islem basarisiz oldu'));
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const isMerchant = resolveMerchantRole(user);
  const isMerchantOnboardingPending = (() => {
    try {
      return !!user?.id && localStorage.getItem('merchant-subscription-onboarding-user') === user.id;
    } catch {
      return false;
    }
  })();
  const canManageMerchantPrices = isMerchant && !isMerchantOnboardingPending;

  const loadLocations = async () => {
    try {
      const data = await locationsAPI.getAll();
      setLocations(data);
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const handleGetLocation = async () => {
    try {
      setIsGettingLocation(true);
      const position = await getCurrentPosition();
      if (position) {
        setPriceFormData({
          ...priceFormData,
          lat: position.latitude,
          lng: position.longitude,
        });
        toast.success('Konum alındı');
      }
    } catch (error) {
      console.error('Failed to get location:', error);
      toast.error('Konum alınamadı');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleLocationSearch = async (query: string) => {
    if (query.trim()) {
      try {
        const results = await locationsAPI.getAll(query);
        setLocations(results);
      } catch (error) {
        console.error('Location search error:', error);
      }
    } else {
      loadLocations();
    }
  };

  const handlePhotoSelect = (file: File | null) => {
    if (file) {
      setPriceFormData({
        ...priceFormData,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
    }
  };

  const handleAddPrice = async () => {
    if (!user || !isMerchant) {
      toast.error('Sadece esnaf ürün ekleyebilir');
      return;
    }

    if (!id || !priceFormData.price || !priceFormData.locationId) {
      toast.error('Lütfen fiyat ve konum bilgilerini girin');
      return;
    }

    try {
      setIsSubmittingPrice(true);

      let lat = priceFormData.lat;
      let lng = priceFormData.lng;

      if (!lat || !lng) {
        try {
          const position = await getCurrentPosition();
          if (position) {
            lat = position.latitude;
            lng = position.longitude;
          }
        } catch (error) {
          console.log('Geolocation not available');
        }
      }

      await pricesAPI.create({
        product: id,
        price: parseFloat(priceFormData.price),
        unit: priceFormData.unit,
        location: priceFormData.locationId,
        photo: priceFormData.photo || undefined,
        lat: lat || undefined,
        lng: lng || undefined,
      });

      toast.success('Fiyat eklendi');
      setIsAddPriceDialogOpen(false);
      setPriceFormData({
        price: '',
        unit: 'kg',
        locationId: '',
        locationName: '',
        photo: null,
        photoPreview: null,
        lat: null,
        lng: null,
      });
      loadProductData();
    } catch (error: any) {
      console.error('Failed to add price:', error);
      toast.error(error.message || 'Fiyat eklenirken bir hata oluştu');
    } finally {
      setIsSubmittingPrice(false);
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
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 p-4 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
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
            <h1 className="text-xl leading-tight truncate">{product.name}</h1>
          </div>
          {user && (
            <button
              onClick={handleToggleFavorite}
              disabled={isTogglingFavorite}
              className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                isFavorited
                  ? 'text-white bg-red-500 hover:bg-red-600'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
              aria-label={isFavorited ? 'Favorilerden kaldır' : 'Favorilere ekle'}
            >
              <Heart className={`w-5 h-5 transition-all ${isFavorited ? 'fill-current scale-110' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white p-6 border-b border-gray-200" style={{ marginTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
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
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-gray-600">Ortalama fiyat</div>
              {canManageMerchantPrices && (
                <Button
                  size="sm"
                  onClick={() => setIsAddPriceDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Fiyat Ekle
                </Button>
              )}
            </div>
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
            // Extract lat/lng from coordinates - prioritize location.coordinates and item.coordinates over item.lat/lng
            // because coordinates strings are the source of truth from the database
            let lat: number | undefined;
            let lng: number | undefined;
            
            // Priority 1: item.coordinates (if directly set on price)
            let coordinates = (item as any).coordinates;
            if (coordinates && typeof coordinates === 'string') {
              const match = coordinates.match(/\(([^,]+),([^)]+)\)/);
              if (match) {
                lng = parseFloat(match[1]);
                lat = parseFloat(match[2]);
              }
            }
            
            // Priority 2: location.coordinates (most reliable for location data)
            if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && item.location?.coordinates) {
              coordinates = item.location.coordinates;
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
            
            // Fallback to item.lat/lng if coordinates not available
            if (!lat || !lng) {
              lat = item.lat;
              lng = item.lng;
            }
            
            const hasCoordinates = lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng);
            
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

                    <div className="mb-3">
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                        <span className="flex items-center gap-1 min-w-0 flex-1">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{locationName}</span>
                        </span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-4 h-4" />
                          {formatTimeAgo(createdAt)}
                        </span>
                        {isVerified && (
                          <span className="flex items-center gap-1 text-green-600 flex-shrink-0">
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
                          className="w-full sm:w-auto text-xs h-8 px-3 border-green-600 text-green-600 hover:bg-green-50"
                          onClick={() => {
                            const productId = item.product?.id || item.product?._id || product?.id || product?._id;
                            const url = productId 
                              ? `/app/map?lat=${lat}&lng=${lng}&focus=true&productId=${productId}`
                              : `/app/map?lat=${lat}&lng=${lng}&focus=true`;
                            navigate(url);
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

      {/* Add Price Dialog for Merchants */}
      {isMerchant && (
        <Dialog open={isAddPriceDialogOpen} onOpenChange={setIsAddPriceDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Fiyat Ekle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Ürün</Label>
                <Input value={product.name} disabled />
              </div>
              <div>
                <Label>Fiyat *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={priceFormData.price}
                  onChange={(e) => setPriceFormData({ ...priceFormData, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Birim</Label>
                <Select
                  value={priceFormData.unit}
                  onValueChange={(value) => setPriceFormData({ ...priceFormData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="adet">adet</SelectItem>
                    <SelectItem value="litre">litre</SelectItem>
                    <SelectItem value="paket">paket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Konum *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Konum ara"
                    value={priceFormData.locationName}
                    onChange={(e) => {
                      setPriceFormData({ ...priceFormData, locationName: e.target.value });
                      handleLocationSearch(e.target.value);
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGetLocation}
                    disabled={isGettingLocation}
                  >
                    <MapPin className="w-4 h-4" />
                  </Button>
                </div>
                {locations.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                    {locations.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                        onClick={() => {
                          setPriceFormData({
                            ...priceFormData,
                            locationId: loc.id,
                            locationName: loc.name,
                          });
                        }}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Fotoğraf (Opsiyonel)</Label>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
                    />
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-green-600">
                      {priceFormData.photoPreview ? (
                        <div className="relative">
                          <img
                            src={priceFormData.photoPreview}
                            alt="Preview"
                            className="w-full h-32 object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPriceFormData({ ...priceFormData, photo: null, photoPreview: null });
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">Fotoğraf Ekle</span>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddPriceDialogOpen(false)}
                  className="flex-1"
                >
                  İptal
                </Button>
                <Button
                  onClick={handleAddPrice}
                  disabled={isSubmittingPrice || !priceFormData.price || !priceFormData.locationId}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isSubmittingPrice ? 'Ekleniyor...' : 'Ekle'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
