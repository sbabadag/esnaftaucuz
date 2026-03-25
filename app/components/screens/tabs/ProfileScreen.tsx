import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import { Settings, Heart, Award, Share2, LogOut, ChevronRight, Store, CreditCard, RefreshCw, Crown, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';
import { useTheme } from '../../../contexts/ThemeContext';
import { useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { supabase } from '../../../lib/supabase';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    is_merchant: boolean;
    merchant_subscription_status: string;
    merchant_subscription_plan: string;
  } | null>(null);

  const fetchMerchantStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_merchant, merchant_subscription_status, merchant_subscription_plan')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        setDbStatus({
          is_merchant: !!data.is_merchant,
          merchant_subscription_status: data.merchant_subscription_status || 'inactive',
          merchant_subscription_plan: data.merchant_subscription_plan || '',
        });
      }
    } catch { /* best effort */ }
  }, [user?.id]);

  // Fetch on mount and every time this route becomes active
  useEffect(() => {
    fetchMerchantStatus();
    if (refreshUser) {
      refreshUser().catch(() => {});
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t('LOGOUT_SUCCESS'));
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(t('LOGOUT_ERROR'));
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'K';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  // Get level badge text
  const getLevelBadge = () => {
    if (!user?.level) return t('LEVEL_NEW');
    const levels: Record<number, string> = {
      1: t('LEVEL_NEW'),
      2: t('LEVEL_NEIGHBOR'),
      3: t('LEVEL_EXPERT'),
      4: t('LEVEL_MASTER'),
      5: t('LEVEL_LEGEND'),
    };
    return levels[user.level] || t('LEVEL_NEW');
  };

  // Prefer fresh DB data over cached user object
  const effectiveIsMerchant = dbStatus?.is_merchant ?? (user as any)?.is_merchant ?? false;
  const merchantStatus = String(dbStatus?.merchant_subscription_status || (user as any)?.merchant_subscription_status || '').toLowerCase();
  const merchantPlan = String(dbStatus?.merchant_subscription_plan || (user as any)?.merchant_subscription_plan || '').trim();
  const isMerchant =
    effectiveIsMerchant === true ||
    merchantStatus === 'active' ||
    merchantStatus === 'past_due' ||
    merchantPlan.length > 0;
  const themeColor = isMerchant ? 'blue' : 'green';
  const themeColorClass = isMerchant ? 'blue-600' : 'green-600';
  const merchantSubscriptionStatus = merchantStatus || 'inactive';
  const merchantSubscriptionFee = (user as any)?.merchant_subscription_fee_tl || 500;
  const merchantSubscriptionPeriodEnd = (user as any)?.merchant_subscription_current_period_end;

  const getMerchantSubscriptionLabel = () => {
    switch (merchantSubscriptionStatus) {
      case 'active':
        return 'Aktif';
      case 'past_due':
        return 'Ödeme Bekleniyor';
      case 'canceled':
        return 'İptal Edildi';
      case 'inactive':
      default:
        return 'Pasif';
    }
  };

  const getSubscriptionBadgeColor = () => {
    switch (merchantSubscriptionStatus) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'past_due': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'canceled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      await fetchMerchantStatus();
      if (refreshUser) await refreshUser();
      toast.success('Üyelik durumu güncellendi');
    } catch {
      toast.error('Durum güncellenemedi');
    } finally {
      setIsRefreshing(false);
    }
  };

  const menuItems = [
    // Esnaf için özel menü öğesi
    ...(isMerchant ? [
      { icon: Store, label: t('MY_SHOP'), onClick: () => navigate(`/app/merchant-shop/${user?.id}`) },
      { icon: CreditCard, label: 'Abonelik ve Ödeme', onClick: () => navigate('/app/merchant-subscription') },
    ] : []),
    { icon: Share2, label: t('CONTRIBUTIONS'), onClick: () => navigate('/app/contributions') },
    { icon: Heart, label: t('FAVORITES_TITLE'), onClick: () => navigate('/app/favorites') },
    { icon: Award, label: t('BADGES'), onClick: () => navigate('/app/badges') },
    { icon: Settings, label: t('SETTINGS'), onClick: () => navigate('/app/settings') },
    { icon: Share2, label: t('FEEDBACK_AND_SUPPORT'), onClick: () => navigate('/app/feedback') },
    // Theme toggle (not a navigation item)
    { icon: Share2, label: `${t('THEME')}: ${theme === 'dark' ? t('DARK') : t('LIGHT')}`, onClick: () => toggleTheme() },
    // Language selector entry (cycles en/tr)
    { icon: Share2, label: `${t('LANGUAGE')}: ${lang === 'tr' ? 'Türkçe' : 'English'}`, onClick: () => {
      const next = lang === 'tr' ? 'en' : 'tr';
      try { setLang(next as any); } catch {}
      // show toast in the newly selected language
      toast.success(next === 'tr' ? 'Dil değiştirildi' : 'Language changed');
    } },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <div
        className={`${isMerchant ? 'bg-blue-600' : 'bg-white'} p-6 border-b ${isMerchant ? 'border-blue-600' : 'border-gray-200'}`}
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src={user?.avatar || ''} />
            <AvatarFallback className={`${isMerchant ? 'bg-blue-600' : 'bg-green-600'} text-white text-2xl`}>
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className={`text-2xl ${isMerchant ? 'text-white' : ''}`}>{user?.name || 'Kullanıcı'}</h2>
              {isMerchant && (
                <Badge className="bg-white text-blue-600">Esnaf</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm ${isMerchant ? 'text-white/80' : 'text-gray-600'}`}>{t('LEVEL_LABEL')}</span>
              <Badge variant="secondary">{getLevelBadge()} 🏅</Badge>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl ${isMerchant ? 'text-blue-600' : 'text-green-600'}`}>
              {typeof user?.contributions === 'object' 
                ? user.contributions?.shares || 0 
                : user?.contributions || 0}
            </div>
            <div className="text-sm text-gray-600">{t('SHARES')}</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl ${isMerchant ? 'text-blue-600' : 'text-green-600'}`}>
              {typeof user?.contributions === 'object' 
                ? user.contributions?.verifications || 0 
                : 0}
            </div>
            <div className="text-sm text-gray-600">{t('VERIFICATIONS')}</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl ${isMerchant ? 'text-blue-600' : 'text-green-600'}`}>{user?.points || 0}</div>
            <div className="text-sm text-gray-600">{t('POINTS')}</div>
          </div>
        </div>
      </div>

      {/* Membership Status Card */}
      <div className="mx-4 mt-4 rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isMerchant ? (
              <Crown className="w-5 h-5 text-blue-600" />
            ) : (
              <User className="w-5 h-5 text-gray-500" />
            )}
            <span className="font-semibold text-gray-800">Üyelik Durumu</span>
          </div>
          <button
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Hesap Tipi</span>
            <span className={`text-sm font-semibold ${isMerchant ? 'text-blue-600' : 'text-gray-700'}`}>
              {isMerchant ? 'Esnaf Hesabı' : 'Normal Kullanıcı'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Abonelik</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getSubscriptionBadgeColor()}`}>
              {getMerchantSubscriptionLabel()}
            </span>
          </div>
          {isMerchant && merchantPlan && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Plan</span>
              <span className="text-sm text-gray-700">
                {merchantPlan.includes('basic') ? 'Temel Esnaf' : merchantPlan.includes('premium') ? 'Premium Esnaf' : merchantPlan}
              </span>
            </div>
          )}
          {isMerchant && merchantSubscriptionPeriodEnd && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Bitiş Tarihi</span>
              <span className="text-sm text-gray-700">
                {new Date(merchantSubscriptionPeriodEnd).toLocaleDateString('tr-TR')}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">E-posta</span>
            <span className="text-sm text-gray-700">{user?.email || '-'}</span>
          </div>
        </div>
        {!isMerchant && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => navigate('/app/merchant-subscription')}
              className="w-full text-center text-sm text-blue-600 font-medium hover:text-blue-700"
            >
              Esnaf hesabına yükselt →
            </button>
          </div>
        )}
        {isMerchant && merchantSubscriptionStatus !== 'active' && (
          <div className="px-4 py-3 border-t border-gray-100 bg-yellow-50">
            <button
              onClick={() => navigate('/app/merchant-subscription')}
              className="w-full text-center text-sm text-yellow-700 font-medium hover:text-yellow-800"
            >
              Aboneliği yönet →
            </button>
          </div>
        )}
      </div>

      {/* Menu */}
        <div className="p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="w-full bg-white rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-gray-600" />
              <span>{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-lg p-4 flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600"
        >
          <LogOut className="w-5 h-5" />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
}
