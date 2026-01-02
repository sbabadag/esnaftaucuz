import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, CheckCircle2, ThumbsUp, Flag, Package } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '../../ui/avatar';
import { productsAPI, pricesAPI } from '../../../services/supabase-api';
import { useAuth } from '../../../contexts/AuthContext';
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

  const loadProductData = async () => {
    try {
      setIsLoading(true);
      
      // Load product
      const productData = await productsAPI.getById(id!);
      setProduct(productData);

      // Load prices
      const priceData = await pricesAPI.getByProduct(id!, sortBy);
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
            const coordinates = item.location?.coordinates;
            const hasCoordinates = coordinates && (
              (coordinates as any).x !== undefined || 
              (coordinates as any).lat !== undefined
            );
            
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
                    ) : (item.product?.image || product.image) ? (
                      <img 
                        src={item.product?.image || product.image} 
                        alt={item.product?.name || product.name}
                        className="w-full h-full object-cover opacity-60"
                        title="Ürün resmi"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <Package className={`w-8 h-8 text-gray-400 ${(item.photo || item.product?.image || product.image) ? 'hidden' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-2xl text-green-600 font-semibold">
                          {formatPrice(item.price)} TL{' '}
                          <span className="text-sm text-gray-500 font-normal">/ {item.unit}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{item.location?.name || 'Bilinmeyen konum'}</div>
                      </div>
                      {isOld(createdAt) ? (
                        <Badge variant="secondary" className="ml-2 flex-shrink-0">Eski fiyat</Badge>
                      ) : (
                        <Badge className="bg-green-600 ml-2 flex-shrink-0">BUGÜN</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {hasCoordinates ? 'Konum mevcut' : 'Konum yok'}
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
