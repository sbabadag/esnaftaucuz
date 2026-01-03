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
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// Regular user tabs
const regularTabs = [
  { path: 'explore', label: 'Keşfet', icon: Compass },
  { path: 'map', label: 'Harita', icon: Map },
  { path: 'add', label: 'Ekle', icon: Plus },
  { path: 'profile', label: 'Profil', icon: User },
];

// Merchant tabs - replace "Profil" with "Dükkanım"
const merchantTabs = [
  { path: 'explore', label: 'Keşfet', icon: Compass },
  { path: 'map', label: 'Harita', icon: Map },
  { path: 'add', label: 'Ekle', icon: Plus },
  { path: 'merchant-shop', label: 'Dükkanım', icon: Store },
];

export default function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bannerVisible, setBannerVisible] = useState(true);
  
  // Check if user is merchant - use blue theme for merchants, green for regular users
  const isMerchant = (user as any)?.is_merchant === true;
  const themeColor = isMerchant ? 'blue' : 'green';
  const themeColorClass = isMerchant ? 'blue-600' : 'green-600';
  const themeGradientFrom = isMerchant ? 'from-blue-600' : 'from-green-600';
  const themeGradientTo = isMerchant ? 'to-blue-500' : 'to-emerald-600';
  
  // Check if banner was previously dismissed
  useEffect(() => {
    const bannerDismissed = localStorage.getItem('appBannerDismissed');
    if (bannerDismissed === 'true') {
      setBannerVisible(false);
    }
  }, []);
  
  // Get current path - handle both /app/explore and /app/explore/ cases
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentPath = pathParts[pathParts.length - 1] || 'explore';

  // Get tabs based on user type
  const tabs = isMerchant ? merchantTabs : regularTabs;
  
  // Hide tab bar on detail screens and add price screen
  const hideTabBar = location.pathname.includes('/product/') || 
                     location.pathname.includes('/location/') ||
                     location.pathname.includes('/notifications') ||
                     location.pathname.includes('/settings') ||
                     location.pathname.includes('/contributions') ||
                     location.pathname.includes('/add') ||
                     (isMerchant && location.pathname.includes('/merchant-shop/') && location.pathname !== `/app/merchant-shop/${user?.id}`);

  const handleTabClick = (path: string) => {
    // Special handling for merchant-shop tab
    if (path === 'merchant-shop' && user?.id) {
      navigate(`/app/merchant-shop/${user.id}`, { replace: false });
    } else {
      // Use absolute path for navigation
      navigate(`/app/${path}`, { replace: false });
    }
  };
  
  // Check if merchant-shop tab is active
  const isMerchantShopActive = isMerchant && location.pathname.includes('/merchant-shop/') && location.pathname === `/app/merchant-shop/${user?.id}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* App Banner */}
      {bannerVisible && (
        <div className={`bg-gradient-to-r ${themeGradientFrom} ${themeGradientTo} text-white px-4 py-3 flex items-center justify-between shadow-md z-30 relative`}>
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-white/20 rounded-full p-2">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-sm">esnaftaucuz</h2>
              <p className="text-xs text-white/90">Bugün en ucuzu nerede, tek bakışta</p>
            </div>
          </div>
          <button
            onClick={() => {
              setBannerVisible(false);
              localStorage.setItem('appBannerDismissed', 'true');
            }}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Banner'ı kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className={hideTabBar ? '' : 'pb-20'}>
        <Routes>
          <Route path="/" element={<Navigate to="/app/explore" replace />} />
          <Route path="explore" element={<ExploreScreen />} />
          <Route path="map" element={<MapScreen />} />
          <Route path="add" element={<AddPriceScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="product/:id" element={<ProductDetailScreen />} />
          <Route path="location/:id" element={<LocationDetailScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="contributions" element={<ContributionsScreen />} />
          <Route path="merchant-shop/:merchantId" element={<MerchantShopScreen />} />
        </Routes>
      </main>

      {!hideTabBar && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-40">
          <div className="flex justify-around items-center h-16">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              // Check if tab is active - special handling for merchant-shop
              const isActive = tab.path === 'merchant-shop' 
                ? isMerchantShopActive 
                : currentPath === tab.path;
              
              return (
                <button
                  key={tab.path}
                  onClick={() => handleTabClick(tab.path)}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                    isActive ? (isMerchant ? 'text-blue-600' : 'text-green-600') : 'text-gray-600'
                  }`}
                >
                  <Icon className={`w-6 h-6 mb-1 ${tab.path === 'add' && (isMerchant ? 'bg-blue-600' : 'bg-green-600')} ${tab.path === 'add' && 'text-white rounded-full p-1 w-8 h-8'}`} />
                  <span className="text-xs">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
