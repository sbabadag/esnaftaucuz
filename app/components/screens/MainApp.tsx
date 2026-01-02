import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Map, Plus, User, ShoppingBag, X } from 'lucide-react';
import ExploreScreen from './tabs/ExploreScreen';
import MapScreen from './tabs/MapScreen';
import AddPriceScreen from './tabs/AddPriceScreen';
import ProfileScreen from './tabs/ProfileScreen';
import ProductDetailScreen from './details/ProductDetailScreen';
import LocationDetailScreen from './details/LocationDetailScreen';
import NotificationsScreen from './NotificationsScreen';
import SettingsScreen from './SettingsScreen';
import { useState, useEffect } from 'react';

const tabs = [
  { path: 'explore', label: 'Keşfet', icon: Compass },
  { path: 'map', label: 'Harita', icon: Map },
  { path: 'add', label: 'Ekle', icon: Plus },
  { path: 'profile', label: 'Profil', icon: User },
];

export default function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [bannerVisible, setBannerVisible] = useState(true);
  
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

  // Hide tab bar on detail screens and add price screen
  const hideTabBar = location.pathname.includes('/product/') || 
                     location.pathname.includes('/location/') ||
                     location.pathname.includes('/notifications') ||
                     location.pathname.includes('/settings') ||
                     location.pathname.includes('/add');

  const handleTabClick = (path: string) => {
    // Use absolute path for navigation
    navigate(`/app/${path}`, { replace: false });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* App Banner */}
      {bannerVisible && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 flex items-center justify-between shadow-md z-50 relative">
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
        </Routes>
      </main>

      {!hideTabBar && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-50">
          <div className="flex justify-around items-center h-16">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentPath === tab.path;
              
              return (
                <button
                  key={tab.path}
                  onClick={() => handleTabClick(tab.path)}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                    isActive ? 'text-green-600' : 'text-gray-600'
                  }`}
                >
                  <Icon className={`w-6 h-6 mb-1 ${tab.path === 'add' && 'bg-green-600 text-white rounded-full p-1 w-8 h-8'}`} />
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
