import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Settings, Heart, Award, Share2, LogOut, ChevronRight, Store, CreditCard } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';
import { useTheme } from '../../../contexts/ThemeContext';
import { useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, lang, setLang } = useLanguage();

  // Debug: Log user and is_merchant status
  useEffect(() => {
    console.log('🔍 ProfileScreen - User data:', {
      id: user?.id,
      email: user?.email,
      is_merchant: (user as any)?.is_merchant,
      is_merchant_type: typeof (user as any)?.is_merchant,
      fullUser: user,
    });
  }, [user]);

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

  const isMerchant = (user as any)?.is_merchant === true;
  const themeColor = isMerchant ? 'blue' : 'green';
  const themeColorClass = isMerchant ? 'blue-600' : 'green-600';
  const merchantSubscriptionStatus = (user as any)?.merchant_subscription_status || 'inactive';
  const merchantSubscriptionFee = (user as any)?.merchant_subscription_fee_tl || 1000;
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

  const menuItems = [
    // Esnaf için özel menü öğesi
    ...(isMerchant ? [
      { icon: Store, label: t('MY_SHOP'), onClick: () => navigate(`/app/merchant-shop/${user?.id}`) },
      { icon: CreditCard, label: 'Abonelik ve Ödeme', onClick: () => navigate('/app/merchant-subscription') },
    ] : []),
    { icon: Share2, label: t('CONTRIBUTIONS'), onClick: () => navigate('/app/contributions') },
    { icon: Heart, label: t('FAVORITES_TITLE'), onClick: () => navigate('/app/favorites') },
    { icon: Award, label: t('BADGES'), onClick: () => {} },
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
              {(user as any)?.is_merchant && (
                <Badge className="bg-white text-blue-600">Esnaf</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm ${isMerchant ? 'text-white/80' : 'text-gray-600'}`}>{t('LEVEL_LABEL')}</span>
              <Badge variant="secondary">{getLevelBadge()} 🏅</Badge>
            </div>
            {isMerchant && (
              <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${isMerchant ? 'border-white/30 bg-white/10 text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span>Abonelik</span>
                  <span className="font-semibold">{getMerchantSubscriptionLabel()}</span>
                </div>
                <div className={`${isMerchant ? 'text-white/80' : 'text-gray-500'}`}>
                  {merchantSubscriptionFee} TL / ay
                  {merchantSubscriptionPeriodEnd ? ` - Bitiş: ${new Date(merchantSubscriptionPeriodEnd).toLocaleDateString('tr-TR')}` : ''}
                </div>
              </div>
            )}
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
