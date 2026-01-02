import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Bell, Lock, Globe, Info, ChevronRight, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { useAuth } from '../../contexts/AuthContext';
import { usersAPI } from '../../services/supabase-api';
import { toast } from 'sonner';

const settingsItems = [
  { icon: MapPin, label: 'Konum ayarları' },
  { icon: Bell, label: 'Bildirimler' },
  { icon: Lock, label: 'Gizlilik' },
  { icon: Globe, label: 'Dil' },
  { icon: Info, label: 'Hakkında' },
];

// Predefined radius values (km)
const RADIUS_OPTIONS = [1, 5, 10, 15, 20, 50, 100, 1000];

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [searchRadius, setSearchRadius] = useState<number>(15);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load user's search radius preference
    if (user) {
      const radius = (user as any).search_radius || 
                    (user as any).preferences?.searchRadius || 
                    15; // Default: 15 km
      // Snap to nearest valid value
      const nearestRadius = RADIUS_OPTIONS.reduce((prev, curr) => 
        Math.abs(curr - radius) < Math.abs(prev - radius) ? curr : prev
      );
      setSearchRadius(nearestRadius);
    }
  }, [user]);

  // Find the index of current radius in options for slider
  const getRadiusIndex = (radius: number) => {
    return RADIUS_OPTIONS.indexOf(radius);
  };

  // Get radius from slider index
  const getRadiusFromIndex = (index: number) => {
    return RADIUS_OPTIONS[Math.max(0, Math.min(RADIUS_OPTIONS.length - 1, index))];
  };

  const handleSaveSearchRadius = async () => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return;
    }

    // Validate radius is in allowed values and within database constraint (1-1000)
    if (!RADIUS_OPTIONS.includes(searchRadius)) {
      toast.error('Geçersiz arama genişliği değeri');
      return;
    }
    
    // Double-check constraint: 1 <= searchRadius <= 1000
    if (typeof searchRadius !== 'number' || searchRadius < 1 || searchRadius > 1000) {
      console.error('❌ Invalid searchRadius value:', searchRadius);
      toast.error('Arama genişliği 1-1000 km arasında olmalıdır');
      return;
    }

    try {
      setIsSaving(true);
      console.log('💾 Saving search radius:', searchRadius);
      await usersAPI.update(user.id, {
        preferences: {
          searchRadius: searchRadius,
        },
      });
      
      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }
      
      toast.success('Arama genişliği kaydedildi');
    } catch (error: any) {
      console.error('❌ Save search radius error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      
      // Show more specific error message
      let errorMessage = 'Ayar kaydedilirken bir hata oluştu';
      if (error.message) {
        if (error.message.includes('row-level security') || error.message.includes('RLS')) {
          errorMessage = 'Yetki hatası. Lütfen tekrar giriş yapın.';
        } else if (error.message.includes('permission') || error.message.includes('denied')) {
          errorMessage = 'Bu işlem için yetkiniz yok. Lütfen tekrar giriş yapın.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, {
        description: error.details || error.hint || 'Lütfen tekrar deneyin.',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const index = value[0];
    const newRadius = getRadiusFromIndex(index);
    setSearchRadius(newRadius);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">Ayarlar</h1>
        </div>
      </div>

      {/* Search Radius Setting */}
      <div className="p-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Arama Genişliği</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="searchRadius" className="text-sm text-gray-600">
                  Yakındaki fiyatları getirirken kullanılacak arama yarıçapı
                </Label>
                <span className="text-lg font-semibold text-green-600">{searchRadius} km</span>
              </div>
              
              <div className="px-2 py-4">
                <Slider
                  value={[getRadiusIndex(searchRadius)]}
                  onValueChange={handleSliderChange}
                  min={0}
                  max={RADIUS_OPTIONS.length - 1}
                  step={1}
                  className="w-full"
                />
              </div>
              
              {/* Show all options as markers */}
              <div className="flex justify-between mt-2 px-2">
                {RADIUS_OPTIONS.map((radius) => (
                  <button
                    key={radius}
                    onClick={() => setSearchRadius(radius)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      searchRadius === radius
                        ? 'bg-green-600 text-white font-semibold'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {radius}
                  </button>
                ))}
              </div>
              
              <p className="text-xs text-gray-500 mt-3">
                Bu ayar, yakındaki en ucuz fiyatları getirirken kullanılır. Varsayılan: 15 km.
              </p>
            </div>
            <Button
              onClick={handleSaveSearchRadius}
              disabled={isSaving}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="p-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Bildirimler</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifications" className="text-sm text-gray-600">
                Bildirimleri etkinleştir
              </Label>
              <input
                type="checkbox"
                id="notifications"
                checked={(user as any)?.preferences?.notifications !== false}
                onChange={async (e) => {
                  if (!user) return;
                  try {
                    await usersAPI.update(user.id, {
                      preferences: {
                        ...(user as any).preferences,
                        notifications: e.target.checked,
                      },
                    });
                    if (refreshUser) await refreshUser();
                    toast.success('Bildirim ayarı kaydedildi');
                  } catch (error: any) {
                    console.error('Save notification setting error:', error);
                    toast.error('Ayar kaydedilemedi');
                  }
                }}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings List */}
      <div className="p-4 space-y-2">
        {settingsItems.filter(item => item.label !== 'Bildirimler').map((item) => (
          <button
            key={item.label}
            className="w-full bg-white rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-gray-600" />
              <span>{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
