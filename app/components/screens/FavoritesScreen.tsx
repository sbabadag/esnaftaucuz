import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Package, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { favoritesAPI } from '../../services/supabase-api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';

interface Favorite {
  id: string;
  product_id: string;
  created_at: string;
  product: {
    id: string;
    name: string;
    image?: string;
    category?: string;
  } | null;
}

export default function FavoritesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const loadSeqRef = useRef(0);

  useEffect(() => {
    if (user?.id) {
      loadFavorites(user.id);
    }
  }, [user?.id]);

  const loadFavorites = async (userId: string) => {
    if (!userId) return;
    const seq = ++loadSeqRef.current;

    try {
      setIsLoading(true);
      const cachedRows: Favorite[] = (favoritesAPI as any)._readCache
        ? (favoritesAPI as any)._readCache(userId)
        : [];

      // Render cache immediately to avoid long blank/loading states.
      if (seq !== loadSeqRef.current) return;
      setFavorites(cachedRows);
      setIsLoading(false);

      // Refresh from remote in background; never block UI.
      Promise.race([
        favoritesAPI.getByUser(userId),
        new Promise<Favorite[]>((_, reject) =>
          setTimeout(() => reject(new Error('favorites remote-timeout')), 8000)
        ),
      ])
        .then((data) => {
          if (seq !== loadSeqRef.current) return;
          const rows = (data || []) as Favorite[];
          setFavorites(rows);
        })
        .catch((error: any) => {
          if (seq !== loadSeqRef.current) return;
          console.warn('Favorites remote refresh warning:', error?.message || 'remote-fail');
        });
      return;
    } catch (error: any) {
      if (seq !== loadSeqRef.current) return;
      console.error('Failed to load favorites:', error);
      toast.error(t('FAVORITES_LOAD_ERROR'));
    } finally {
      if (seq !== loadSeqRef.current) return;
      setIsLoading(false);
    }
  };

  // Safety valve: if loading somehow gets stuck, release spinner quietly.
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      console.warn('Favorites load exceeded safety threshold, ending loading state.');
      setIsLoading(false);
    }, 25000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleRemoveFavorite = async (productId: string) => {
    if (!user) return;

    const previousFavorites = favorites;
    try {
      setRemovingIds(prev => new Set(prev).add(productId));
      // Optimistic remove: keep UI responsive even if remote delete is slow.
      setFavorites(prev => prev.filter(fav => fav.product_id !== productId));
      await Promise.race([
        favoritesAPI.remove(productId, user.id),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('favorite remove timeout')), 8000)
        ),
      ]);
      setFavorites(prev => prev.filter(fav => fav.product_id !== productId));
      toast.success(t('FAVORITE_REMOVED'));
    } catch (error: any) {
      console.error('Failed to remove favorite:', error);
      if (String(error?.message || '').includes('timeout')) {
        // Keep optimistic state when timeout occurs; cache has already been updated.
        toast.warning('Silme islemi gonderildi, dogrulama gecikiyor');
      } else {
        // Non-timeout failure: rollback optimistic UI.
        setFavorites(previousFavorites);
        toast.error(t('FAVORITE_REMOVE_ERROR'));
      }
    } finally {
      setRemovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{t('MUST_LOGIN_TO_VIEW_FAVORITES')}</p>
          <Button onClick={() => navigate('/login')}>{t('LOGIN')}</Button>
        </div>
      </div>
    );
  }

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
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">{t('FAVORITES_TITLE')}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
        {favorites.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              {t('NO_FAVORITES_TITLE')}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('NO_FAVORITES_DESC')}
            </p>
            <Button 
              onClick={() => navigate('/app/explore')}
              className="bg-green-600 hover:bg-green-700"
            >
              {t('EXPLORE_PRODUCTS')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((favorite) => (
              <div
                key={favorite.id}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  {/* Product Image */}
                  <div 
                    className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/app/product/${favorite.product_id}`)}
                  >
                    {favorite.product?.image ? (
                      <img
                        src={favorite.product.image}
                        alt={favorite.product?.name || 'Product'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <Package className={`w-8 h-8 text-gray-400 ${favorite.product?.image ? 'hidden' : ''}`} />
                  </div>

                  {/* Product Info */}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/app/product/${favorite.product_id}`)}
                  >
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {favorite.product?.name || (String(favorite.id || '').startsWith('local-') ? 'Urun bilgisi yukleniyor...' : 'Silinmis urun')}
                    </h3>
                    {favorite.product?.category && (
                      <p className="text-sm text-gray-500">{favorite.product.category}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(favorite.created_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveFavorite(favorite.product_id)}
                    disabled={removingIds.has(favorite.product_id)}
                    className="flex-shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  >
                    {removingIds.has(favorite.product_id) ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



