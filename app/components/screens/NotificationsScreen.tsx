import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingDown, MapPin, CheckCircle2, Bell, X, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { notificationsAPI } from '../../services/supabase-api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  product_id?: string;
  price_id?: string;
  is_read: boolean;
  created_at: string;
  product?: {
    id: string;
    name: string;
    image?: string;
    category?: string;
  };
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'price_drop':
      return TrendingDown;
    case 'price_verified':
      return CheckCircle2;
    case 'nearby_cheap':
      return MapPin;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'price_drop':
      return 'text-green-600';
    case 'price_verified':
      return 'text-blue-600';
    case 'nearby_cheap':
      return 'text-purple-600';
    default:
      return 'text-gray-600';
  }
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

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-screen-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Reload so joined product data is shown immediately.
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const loadNotifications = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await notificationsAPI.getByUser(user.id);
      setNotifications(data as Notification[]);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      // If table doesn't exist yet, just show empty state
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        console.log('Notifications table not found, showing empty state');
        setNotifications([]);
      } else {
        toast.error('Bildirimler yüklenemedi');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      setMarkingAsRead(prev => new Set(prev).add(notificationId));
      await notificationsAPI.markAsRead(notificationId, user.id);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error: any) {
      console.error('Failed to mark as read:', error);
      toast.error('İşlem başarısız oldu');
    } finally {
      setMarkingAsRead(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      await notificationsAPI.markAllAsRead(user.id);
      setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));
      toast.success('Tüm bildirimler okundu olarak işaretlendi');
    } catch (error: any) {
      console.error('Failed to mark all as read:', error);
      toast.error('İşlem başarısız oldu');
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!user) return;

    try {
      await notificationsAPI.delete(notificationId, user.id);
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      toast.success('Bildirim silindi');
    } catch (error: any) {
      console.error('Failed to delete notification:', error);
      toast.error('Bildirim silinemedi');
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read && user) {
      handleMarkAsRead(notification.id);
    }
    
    if (notification.product_id) {
      navigate(`/app/product/${notification.product_id}`);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Bildirimleri görmek için giriş yapmanız gerekiyor</p>
          <Button onClick={() => navigate('/login')}>Giriş Yap</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky bg-white border-b border-gray-200 p-4 z-10" style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl">Bildirimler</h1>
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-sm"
            >
              Tümünü okundu işaretle
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 ? (
        <div className="p-4 space-y-2" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
          {notifications.map((notif) => {
            const Icon = getNotificationIcon(notif.type);
            const color = getNotificationColor(notif.type);
            const isUnread = !notif.is_read;

            return (
              <div
                key={notif.id}
                className={`bg-white rounded-lg p-4 border transition-colors cursor-pointer ${
                  isUnread ? 'border-green-200 bg-green-50' : 'border-gray-200'
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${isUnread ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className={`font-semibold ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notif.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                        {notif.product && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                              {notif.product.image ? (
                                <img
                                  src={notif.product.image}
                                  alt={notif.product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <Package className={`w-4 h-4 text-gray-400 ${notif.product.image ? 'hidden' : ''}`} />
                            </div>
                            <span className="text-xs text-gray-500">{notif.product.name}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">{formatTimeAgo(notif.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isUnread && (
                          <div className="w-2 h-2 bg-green-600 rounded-full flex-shrink-0" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notif.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                          aria-label="Sil"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <Bell className="w-16 h-16 mb-4" />
          <p>Henüz bildirim yok</p>
        </div>
      )}
    </div>
  );
}
