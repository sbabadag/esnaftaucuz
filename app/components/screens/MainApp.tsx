import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Map, Plus, User, ShoppingBag, X, Store } from 'lucide-react';
import ExploreScreen from './tabs/ExploreScreen';
import MapScreen from './tabs/MapScreen';
import AddPriceScreen from './tabs/AddPriceScreen';
import ProfileScreen from './tabs/ProfileScreen';
import ProductDetailScreen from './details/ProductDetailScreen';
import LocationDetailScreen from './details/LocationDetailScreen';
import NotificationsScreen from './NotificationsScreen';
import SettingsScreen from './SettingsScreen';
import ContributionsScreen from './ContributionsScreen';
import MerchantShopScreen from './MerchantShopScreen';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import TermsOfServiceScreen from './TermsOfServiceScreen';
import AboutScreen from './AboutScreen';
import FavoritesScreen from './FavoritesScreen';
import FeedbackScreen from './FeedbackScreen';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// Regular user tabs
const regularTabs = [
  { path: 'explore', label: 'Keşfet', icon: Compass },
  { path: 'map', label: 'Harita', icon: Map },
  { path: 'add', label: 'Ekle', icon: Plus },
  { path: 'profile', label: 'Profil', icon: User },
];

// Merchant tabs - esnaf sadece ürün sayfasından ürün ekleyebilir, + tuşu yok
const merchantTabs = [
  { path: 'explore', label: 'Keşfet', icon: Compass },
  { path: 'map', label: 'Harita', icon: Map },
  { path: 'merchant-shop', label: 'Dükkanım', icon: Store },
  { path: 'profile', label: 'Profil', icon: User },
];

export default function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLoading } = useAuth();
  const [bannerVisible, setBannerVisible] = useState(true);
  
  // Merchant status is derived directly from the authoritative `user` object
  // so the UI updates immediately after login.
  const isMerchant = (user as any)?.is_merchant === true;
  const themeColor = isMerchant ? 'blue' : 'green';
  const themeColorClass = isMerchant ? 'blue-600' : 'green-600';
  const themeGradientFrom = isMerchant ? 'from-blue-600' : 'from-green-600';
  const themeGradientTo = isMerchant ? 'to-blue-500' : 'to-emerald-600';
  const bannerGradient = isMerchant ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600' : `bg-gradient-to-r ${themeGradientFrom} ${themeGradientTo}`;
  
  // Check if banner was previously dismissed
  useEffect(() => {
    const bannerDismissed = localStorage.getItem('appBannerDismissed');
    if (bannerDismissed === 'true') {
      setBannerVisible(false);
    }
  }, []);
  
  // Debug: Log merchant status when user changes
  useEffect(() => {
    console.log('🔍 MainApp - User changed:', {
      id: user?.id,
      email: user?.email,
      is_merchant: (user as any)?.is_merchant,
      is_merchant_type: typeof (user as any)?.is_merchant,
    });
  }, [user]);
  
  // Get current path - handle both /app/explore and /app/explore/ cases
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentPath = pathParts[pathParts.length - 1] || 'explore';

  // Get tabs based on user type
  const tabs = isMerchant ? merchantTabs : regularTabs;
  
  // Debug: Log tabs
  useEffect(() => {
    console.log('🔍 MainApp - Tabs:', {
      isMerchant,
      tabsCount: tabs.length,
      tabs: tabs.map(t => t.label),
      user_is_merchant: (user as any)?.is_merchant,
    });
  }, [isMerchant, tabs, user]);
  
  // Hide tab bar on detail and modal-like screens.
  const hideTabBar = (
    location.pathname.includes('/product/') ||
    location.pathname.includes('/location/') ||
    location.pathname.includes('/notifications') ||
    location.pathname.includes('/settings') ||
    location.pathname.includes('/contributions') ||
    location.pathname.includes('/privacy-policy') ||
    location.pathname.includes('/terms-of-service') ||
    location.pathname.includes('/about') ||
    location.pathname.includes('/favorites') ||
    // Add page is only available to regular users; hide tab bar when explicitly on add route.
    (!isMerchant && location.pathname.includes('/add')) ||
    // If merchant is viewing another merchant's shop (not their own), hide tabs to avoid confusion.
    (isMerchant && location.pathname.startsWith('/app/merchant-shop/') && !location.pathname.startsWith(`/app/merchant-shop/${user?.id}`))
  );

  const handleTabClick = (path: string) => {
    console.log('🔘 Tab click handler:', { path, currentPath: location.pathname });
    
    // Special handling for merchant-shop tab
    if (path === 'merchant-shop' && user?.id) {
      navigate(`/app/merchant-shop/${user.id}`, { replace: false });
    } else {
      // Use absolute path for navigation
      navigate(`/app/${path}`, { replace: false });
    }
  };
  
  // Check if merchant-shop tab is active (match exact owner shop path)
  const isMerchantShopActive = isMerchant && location.pathname.startsWith(`/app/merchant-shop/${user?.id}`);

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">

      <main className={hideTabBar ? '' : 'pb-20'}>
        <Routes>
          <Route path="/" element={<Navigate to="/app/explore" replace />} />
          <Route path="explore" element={<ExploreScreen />} />
          <Route path="map" element={<MapScreen />} />
          {!isMerchant && <Route path="add" element={<AddPriceScreen />} />}
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="product/:id" element={<ProductDetailScreen />} />
          <Route path="location/:id" element={<LocationDetailScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="feedback" element={<FeedbackScreen />} />
          <Route path="contributions" element={<ContributionsScreen />} />
          <Route path="merchant-shop/:merchantId" element={<MerchantShopScreen />} />
          <Route path="privacy-policy" element={<PrivacyPolicyScreen />} />
          <Route path="terms-of-service" element={<TermsOfServiceScreen />} />
          <Route path="about" element={<AboutScreen />} />
          <Route path="favorites" element={<FavoritesScreen />} />
        </Routes>
      </main>

  {!hideTabBar && !isLoading && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-40 shadow-lg">
          <div className="flex items-center h-16">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              // Check if tab is active - special handling for merchant-shop
              const isActive = tab.path === 'merchant-shop' 
                ? isMerchantShopActive 
                : currentPath === tab.path;
              
              // Calculate width for each tab (equal distribution)
              const tabWidth = `${100 / tabs.length}%`;
              
              return (
                <button
                  key={tab.path}
                  onClick={() => {
                    console.log('🔘 Tab clicked:', tab.path, tab.label);
                    handleTabClick(tab.path);
                  }}
                  className={`flex flex-col items-center justify-center h-full transition-colors relative ${
                    isActive ? (isMerchant ? 'text-blue-600' : 'text-green-600') : 'text-gray-600'
                  }`}
                  style={{ 
                    width: tabWidth,
                    minWidth: tabWidth,
                    maxWidth: tabWidth,
                  }}
                  aria-label={tab.label}
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <Icon className={`w-5 h-5 flex-shrink-0 ${tab.path === 'add' && (isMerchant ? 'bg-blue-600' : 'bg-green-600')} ${tab.path === 'add' && 'text-white rounded-full p-1 w-8 h-8'}`} />
                    <span className="text-[10px] leading-tight font-medium whitespace-nowrap">{tab.label}</span>
                  </div>
                  {isActive && (
                    <div className={`absolute top-0 left-0 right-0 h-0.5 ${isMerchant ? 'bg-blue-600' : 'bg-green-600'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
