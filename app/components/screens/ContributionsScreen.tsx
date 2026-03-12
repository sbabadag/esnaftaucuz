import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, CheckCircle2, Package } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { pricesAPI, usersAPI } from '../../services/supabase-api';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';

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

const CONTRIBUTIONS_TIMEOUT_MS = 8000;
const getContributionsCacheKey = (userId: string) => `contributions-cache:${userId}`;
const GLOBAL_CONTRIBUTIONS_CACHE_KEY = 'contributions-cache:last';

const readContributionsCache = (userId: string): Price[] => {
  try {
    const raw = localStorage.getItem(getContributionsCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeContributionsCache = (userId: string, values: Price[]) => {
  try {
    localStorage.setItem(getContributionsCacheKey(userId), JSON.stringify(values || []));
    localStorage.setItem(GLOBAL_CONTRIBUTIONS_CACHE_KEY, JSON.stringify(values || []));
  } catch {
    // Ignore quota/serialization issues; cache is best effort.
  }
};

const enrichMissingRelations = async (items: Price[], userId?: string): Promise<Price[]> => {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];

  const missingProductIds = Array.from(
    new Set(
      list
        .filter((item: any) => {
          const productRef = item?.product;
          const missingObj = !productRef || typeof productRef !== 'object' || !productRef?.name;
          return missingObj && (item?.product_id || (typeof productRef === 'string' ? productRef : null));
        })
        .map((item: any) => item.product_id || (typeof item?.product === 'string' ? item.product : null))
        .filter(Boolean)
    )
  );
  const missingLocationIds = Array.from(
    new Set(
      list
        .filter((item: any) => !item?.location && item?.location_id)
        .map((item: any) => item.location_id)
        .filter(Boolean)
    )
  );

  if (missingProductIds.length === 0 && missingLocationIds.length === 0) return list;

  const [productsRes, locationsRes] = await Promise.all([
    missingProductIds.length
      ? supabase
          .from('products')
          .select('id, name, category, image, default_unit')
          .in('id', missingProductIds as string[])
      : Promise.resolve({ data: [], error: null } as any),
    missingLocationIds.length
      ? supabase
          .from('locations')
          .select('id, name, type, city, district')
          .in('id', missingLocationIds as string[])
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const productMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]));
  const locationMap = new Map((locationsRes.data || []).map((l: any) => [l.id, l]));

  // Offline fallback: product index cache used by AddPrice screen.
  try {
    const candidateKeys = [
      userId ? `add-price-products-index:${userId}` : '',
      'add-price-products-index:anon',
    ].filter(Boolean);
    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const row of parsed) {
        if (row?.id && row?.name && !productMap.has(row.id)) {
          productMap.set(row.id, row);
        }
      }
    }
  } catch {
    // best effort only
  }

  return list.map((item: any) => ({
    ...item,
    product:
      (item?.product && typeof item.product === 'object' && item.product?.name
        ? item.product
        : undefined) ||
      (item.product_id ? productMap.get(item.product_id) || undefined : undefined) ||
      (typeof item?.product === 'string' ? productMap.get(item.product) || undefined : undefined),
    location: item.location || (item.location_id ? locationMap.get(item.location_id) || undefined : undefined),
  }));
};

export default function ContributionsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [prices, setPrices] = useState<Price[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    try {
      const keys = [
        user?.id ? `add-price-products-index:${user.id}` : '',
        'add-price-products-index:anon',
      ].filter(Boolean);
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        for (const row of parsed) {
          if (row?.id && row?.name && !map.has(row.id)) {
            map.set(String(row.id), String(row.name));
          }
        }
      }
    } catch {
      // best effort
    }
    return map;
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadContributions();
    }
  }, [user?.id]);

  const loadContributions = async () => {
    if (!user?.id) return;

    const cached = readContributionsCache(user.id);
    const globalCached = (() => {
      try {
        const raw = localStorage.getItem(GLOBAL_CONTRIBUTIONS_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    const initialData = cached.length > 0 ? cached : globalCached;

    if (initialData.length > 0) {
      setPrices(initialData);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const fallbackFromRecentFeed = async (): Promise<Price[]> => {
        const authToken = localStorage.getItem('authToken');
        const candidateUserIds = Array.from(
          new Set([user.id, authToken].filter((v): v is string => typeof v === 'string' && v.length > 0))
        );
        if (candidateUserIds.length === 0) return [];

        try {
          const recent = await pricesAPI.getAll({ sort: 'newest', limit: 400 });
          const mine = (recent || []).filter((item: any) => {
            const ownerId = String(item?.user_id || item?.user?.id || '');
            return candidateUserIds.includes(ownerId);
          });
          return enrichMissingRelations(mine as Price[], user.id);
        } catch (recentError) {
          console.error('Recent feed fallback failed:', recentError);
          return [];
        }
      };

      const apiPromise = usersAPI.getContributions(user.id).then((items) => items || []);
      const timeoutPromise = new Promise<Price[] | null>((resolve) =>
        setTimeout(() => resolve(null), CONTRIBUTIONS_TIMEOUT_MS)
      );
      const data = await Promise.race([apiPromise, timeoutPromise]);

      // Soft-timeout: unblock UI and update when API eventually returns.
      if (data === null) {
        setIsLoading(false);
        apiPromise
          .then((lateData) => {
            if (lateData.length > 0) {
              enrichMissingRelations(lateData)
                .then((enrichedLateData) => {
                  setPrices(enrichedLateData);
                  writeContributionsCache(user.id, enrichedLateData);
                })
                .catch(() => {
                  setPrices(lateData);
                  writeContributionsCache(user.id, lateData);
                });
            } else if (initialData.length === 0) {
              fallbackFromRecentFeed()
                .then((recentFallback) => {
                  if (recentFallback.length > 0) {
                    setPrices(recentFallback);
                    writeContributionsCache(user.id, recentFallback);
                  } else {
                    setPrices([]);
                  }
                })
                .catch(() => setPrices([]));
            }
          })
          .catch((lateError) => {
            console.error('Late contributions load failed:', lateError);
          });
        return;
      }

      const normalized = data || [];
      if (normalized.length > 0) {
        try {
          const enriched = await enrichMissingRelations(normalized, user.id);
          setPrices(enriched);
          writeContributionsCache(user.id, enriched);
        } catch {
          setPrices(normalized);
          writeContributionsCache(user.id, normalized);
        }
      } else if (initialData.length === 0) {
        const recentFallback = await fallbackFromRecentFeed();
        if (recentFallback.length > 0) {
          setPrices(recentFallback);
          writeContributionsCache(user.id, recentFallback);
        } else {
          setPrices([]);
        }
      }
    } catch (error) {
      console.error('Failed to load contributions:', error);
      // Keep cache/empty state visible and avoid blocking the user with repeated toasts.
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

  const resolveProductName = (item: any): string => {
    if (item?.product && typeof item.product === 'object' && item.product?.name) {
      return String(item.product.name);
    }
    if (typeof item?.product === 'string') {
      const value = item.product.trim();
      // If backend returned direct name as string, show it.
      if (value && !/^[0-9a-f-]{36}$/i.test(value)) return value;
    }
    if (typeof item?.product_name === 'string' && item.product_name.trim()) return item.product_name;
    if (typeof item?.productName === 'string' && item.productName.trim()) return item.productName;
    const productId = String(item?.product_id || item?.product?.id || '');
    if (productId && productNameById.has(productId)) {
      return productNameById.get(productId)!;
    }
    return t('UNKNOWN_PRODUCT');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">{t('LOADING')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky bg-white border-b border-gray-200 p-4 z-10" style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">{t('CONTRIBUTIONS_TITLE')}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
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
                          {resolveProductName(item)}
                        </h3>
                        <div className="text-2xl text-green-600 font-semibold">
                          {formatPrice(item.price)} TL{' '}
                          <span className="text-sm text-gray-500 font-normal">/ {item.unit}</span>
                        </div>
                      </div>
                      {isToday(createdAt) && (
                        <Badge className="bg-green-600 ml-2 flex-shrink-0">{t('TODAY')}</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                      <span className="truncate">{item.location?.name || t('UNKNOWN_LOCATION')}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTimeAgo(createdAt)}
                      </span>
                    </div>

                    {isVerified && (
                      <div className="flex items-center gap-1.5 text-sm text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('VERIFICATIONS')}</span>
                      </div>
                    )}

                    {!item.photo && (
                      <div className="mt-2 text-xs text-gray-500 italic">
                        {t('PHOTO_MISSING')}
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
            <p className="text-gray-600 font-medium mb-2">{t('NO_CONTRIBUTIONS_TITLE')}</p>
            <p className="text-sm text-gray-500">
              {t('NO_CONTRIBUTIONS_DESC')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}






