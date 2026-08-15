import { useEffect, useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { toast } from 'sonner';
import { shopReviewsAPI } from '../services/supabase-api';

interface ShopReview {
  id: string;
  shop_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user?: { id: string; name: string; avatar?: string | null };
}

interface ShopReviewsSectionProps {
  merchantId: string;
  userId: string | null;
  isOwnShop: boolean;
}

function StarRow({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5 yıldız`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        const half = !filled && value >= i - 0.75;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-gray-300" style={{ width: size, height: size }} />
            {filled && (
              <Star className="absolute inset-0 text-amber-400 fill-amber-400" style={{ width: size, height: size }} />
            )}
            {half && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: size / 2 }}>
                <Star className="text-amber-400 fill-amber-400" style={{ width: size, height: size }} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export default function ShopReviewsSection({ merchantId, userId, isOwnShop }: ShopReviewsSectionProps) {
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [myReview, setMyReview] = useState<ShopReview | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadReviews = async () => {
    const [list, mine] = await Promise.all([
      shopReviewsAPI.list(merchantId, 20),
      userId ? shopReviewsAPI.my(merchantId, userId) : Promise.resolve(null),
    ]);
    setReviews(list);
    setMyReview(mine);
    setLoaded(true);
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, userId]);

  const avg = reviews.length
    ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length
    : 0;

  const handleSubmit = async () => {
    if (!userId) {
      toast.error('Giriş yapmanız gerekiyor');
      return;
    }
    if (!rating || rating < 1 || rating > 5) {
      toast.error('Lütfen yıldız seçin');
      return;
    }
    setIsSubmitting(true);
    try {
      await shopReviewsAPI.upsert(merchantId, userId, rating, comment);
      toast.success('Değerlendirmeniz kaydedildi');
      setIsDialogOpen(false);
      setComment('');
      await loadReviews();
    } catch (error: any) {
      toast.error(error.message || 'Değerlendirme kaydedilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!myReview) return;
    try {
      await shopReviewsAPI.remove(myReview.id);
      toast.success('Değerlendirmeniz silindi');
      await loadReviews();
    } catch (error: any) {
      toast.error(error.message || 'Silme başarısız');
    }
  };

  if (!loaded) return null;
  if (reviews.length === 0 && isOwnShop) return null;

  return (
    <div className="mx-4 mt-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-semibold text-sm">Değerlendirmeler</h2>
          {reviews.length > 0 && (
            <span className="flex items-center gap-1.5 text-sm">
              <span className="font-bold">{avg.toFixed(1)}</span>
              <StarRow value={avg} size={15} />
              <span className="text-xs text-gray-500">({reviews.length})</span>
            </span>
          )}
        </div>
        {!isOwnShop && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => {
              setRating(myReview?.rating || 5);
              setComment(myReview?.comment || '');
              setIsDialogOpen(true);
            }}
          >
            <Star className="w-3.5 h-3.5 mr-1 text-amber-400 fill-amber-400" />
            {myReview ? 'Puanını Güncelle' : 'Puanla'}
          </Button>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-xs text-gray-500 mt-2">Henüz değerlendirme yok — ilk puanı sen ver! ⭐</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {reviews.slice(0, 10).map((r) => (
            <li key={r.id} className="flex gap-2.5">
              <Avatar className="w-7 h-7 shrink-0">
                {r.user?.avatar ? <AvatarImage src={r.user.avatar} /> : null}
                <AvatarFallback className="text-xs">{(r.user?.name || '?').slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate">{r.user?.name || 'Kullanıcı'}</span>
                  <StarRow value={Number(r.rating)} size={13} />
                  {myReview?.id === r.id && (
                    <button
                      onClick={handleRemove}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-auto shrink-0"
                      title="Değerlendirmeyi sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {r.comment ? <p className="text-xs text-gray-600 mt-0.5 break-words">{r.comment}</p> : null}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(r.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !isSubmitting && setIsDialogOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{myReview ? 'Puanını Güncelle' : 'Dükkanı Puanla'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  onClick={() => setRating(i)}
                  className="p-1"
                  aria-label={`${i} yıldız`}
                >
                  <Star
                    className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                    style={{ width: 32, height: 32 }}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Deneyiminizi paylaşın (isteğe bağlı)"
              className="w-full h-24 rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              maxLength={500}
            />
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Gönder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
