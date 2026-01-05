import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, CheckCircle2, Package } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { usersAPI } from '../../services/supabase-api';
import { toast } from 'sonner';

interface Price {
  id: string;
  price: number;
  unit: string;
  photo?: string;
  created_at: string;
  is_verified: boolean;
  product?: {
    id: string;
    name: string;
    category: string;
    image?: string;
  };
  location: {
    id: string;
    name: string;
    type: string;
    city: string;
    district: string;
  };
  // Support both formats
  _id?: string;
  createdAt?: string;
  isVerified?: boolean;
}

export default function ContributionsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prices, setPrices] = useState<Price[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadContributions();
    }
  }, [user?.id]);

  const loadContributions = async () => {
    try {
      setIsLoading(true);
      const data = await usersAPI.getContributions(user!.id);
      setPrices(data || []);
    } catch (error) {
      console.error('Failed to load contributions:', error);
      toast.error('Katkılar yüklenemedi');
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Yükleniyor...</div>
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
          <h1 className="text-xl">Girilen Ürünler</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {prices.length > 0 ? (
          prices.map((item) => {
            const itemId = item.id || item._id || '';
            const createdAt = item.created_at || item.createdAt || '';
            const isVerified = item.is_verified || item.isVerified || false;
            
            return (
              <div
                key={itemId}
                onClick={() => navigate(`/app/product/${item.product?.id || item.product?._id}`)}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:border-green-600 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex gap-4">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-gray-200">
                    {item.photo ? (
                      <>
                        <img 
                          src={item.photo} 
                          alt={item.product?.name || 'Ürün'}
                          className="w-full h-full object-cover"
                          title="Yüklediğiniz fotoğraf"
                          onError={(e) => {
                            console.error('Photo failed to load:', item.photo);
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="absolute top-1 right-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow-md">
                          📷
                        </div>
                      </>
                    ) : (
                      <Package className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {item.product?.name || 'Bilinmeyen ürün'}
                        </h3>
                        <div className="text-2xl text-green-600 font-semibold">
                          {formatPrice(item.price)} TL{' '}
                          <span className="text-sm text-gray-500 font-normal">/ {item.unit}</span>
                        </div>
                      </div>
                      {isToday(createdAt) && (
                        <Badge className="bg-green-600 ml-2 flex-shrink-0">BUGÜN</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{item.location?.name || 'Bilinmeyen konum'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTimeAgo(createdAt)}
                      </span>
                    </div>

                    {isVerified && (
                      <div className="flex items-center gap-1.5 text-sm text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Doğrulanmış</span>
                      </div>
                    )}

                    {!item.photo && (
                      <div className="mt-2 text-xs text-gray-500 italic">
                        Bu fiyat için fotoğraf eklenmemiş
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-2">Henüz fiyat girilmemiş</p>
            <p className="text-sm text-gray-500">
              İlk fiyatınızı eklemek için "Ekle" sekmesine gidin
            </p>
          </div>
        )}
      </div>
    </div>
  );
}



