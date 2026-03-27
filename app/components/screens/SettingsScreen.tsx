import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Bell, Lock, Globe, Info, ChevronRight, Search, Trash2, Settings, FileText, Truck } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { useAuth } from '../../contexts/AuthContext';
import { usersAPI } from '../../services/supabase-api';
import { toast } from 'sonner';
import { useGeolocation } from '../../../src/hooks/useGeolocation';
import { isNative } from '../../../src/utils/capacitor';
import { Geolocation } from '@capacitor/geolocation';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { reverseGeocode } from '../../utils/geocoding';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase, safeGetSession } from '../../lib/supabase';

const settingsItems = [
  { icon: Bell, label: 'Bildirimler', path: null },
  { icon: Lock, label: 'Gizlilik Politikası', path: '/app/privacy-policy' },
  { icon: FileText, label: 'Kullanım Koşulları', path: '/app/terms-of-service' },
  { icon: FileText, label: 'Mesafeli Satış Sözleşmesi', path: '/app/distance-sales-agreement' },
  { icon: Truck, label: 'Teslimat ve İade Şartları', path: '/app/delivery-return-policy' },
  { icon: Globe, label: 'Dil', path: null },
  { icon: Info, label: 'Hakkında', path: '/app/about' },
];

// Predefined radius values (km)
const RADIUS_OPTIONS = [1, 5, 10, 15, 20, 50, 100, 1000];

const resolveMerchantRole = (profile: any): boolean => {
  const explicit = profile?.is_merchant === true;
  const status = String(profile?.merchant_subscription_status || '').toLowerCase();
  const hasActiveSubscription = status === 'active' || status === 'past_due';
  const hasMerchantPlan = String(profile?.merchant_subscription_plan || '').trim().length > 0;
  return explicit || hasActiveSubscription || hasMerchantPlan;
};

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const isGuest = (user as any)?.is_guest === true;
  const { getCurrentPosition } = useGeolocation();
  const isMerchant = resolveMerchantRole(user);
  const [searchRadius, setSearchRadius] = useState<number>(15);
  const [isSaving, setIsSaving] = useState(false);
  const { themeOption, setThemeOption } = useTheme();
  const { t } = useLanguage();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'checking'>('checking');
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [isRunningPushTest, setIsRunningPushTest] = useState(false);
  const [pushTestResult, setPushTestResult] = useState<string>('');
  // Insecure dev server only (http://). Do NOT use startsWith('http') — that matches https:// and shows this banner in production Capacitor (https://localhost).
  const isDevWebview =
    typeof window !== 'undefined' &&
    typeof window.location !== 'undefined' &&
    window.location.protocol === 'http:';

  const normalizePermissionStatus = (permissions: any): 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' => {
    const locationStatus = String(permissions?.location || '').toLowerCase();
    const coarseStatus = String(permissions?.coarseLocation || '').toLowerCase();
    if (locationStatus === 'granted' || coarseStatus === 'granted') return 'granted';
    if (locationStatus === 'prompt-with-rationale' || coarseStatus === 'prompt-with-rationale') return 'prompt-with-rationale';
    if (locationStatus === 'denied' && (coarseStatus === 'denied' || !coarseStatus)) return 'denied';
    return 'prompt';
  };

  const getPositionWithFallback = async () => {
    if (isNative()) {
      try {
        const high = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 10000,
        });
        return { latitude: high.coords.latitude, longitude: high.coords.longitude };
      } catch {
        const low = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 60000,
        });
        return { latitude: low.coords.latitude, longitude: low.coords.longitude };
      }
    }
    const webPos = await getCurrentPosition();
    if (!webPos) throw new Error('Konum bulunamadi');
    return webPos;
  };

  const getLocationFriendlyError = (error: any) => {
    const raw = String(error?.message || error || '').toLowerCase();
    if (raw.includes('denied') || raw.includes('permission')) {
      return 'Konum izni reddedildi. Ayarlardan izin verebilirsiniz.';
    }
    if (raw.includes('timeout')) {
      return 'Konum servisi zaman aşımına uğradı. Açık alanda tekrar deneyin.';
    }
    if (raw.includes('disabled') || raw.includes('services') || raw.includes('provider')) {
      return 'Konum servisleri kullanılamıyor. GPS ve cihaz konum servisinin açık olduğundan emin olun.';
    }
    return 'Konum alınamadı. GPS açık olduğundan emin olun ve tekrar deneyin.';
  };

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

  // Check location permission status and load address
  useEffect(() => {
    const checkLocationPermission = async () => {
      if (isNative()) {
        try {
          const permissions = await Geolocation.checkPermissions();
          const status = normalizePermissionStatus(permissions);
          setLocationPermissionStatus(status);
          
          // If permission is granted, try to get current address
          if (status === 'granted') {
            loadCurrentAddress();
          }
        } catch (error) {
          console.error('Error checking location permission:', error);
          setLocationPermissionStatus('prompt');
        }
      } else {
        // Web - check if geolocation is available
        if (navigator.geolocation) {
          setLocationPermissionStatus('prompt');
        } else {
          setLocationPermissionStatus('denied');
        }
      }
    };
    checkLocationPermission();
  }, []);

  // Load current address from geolocation
  const loadCurrentAddress = async () => {
    try {
      setIsLoadingAddress(true);
      const position = await getPositionWithFallback();
      if (position) {
        const { latitude, longitude } = position;
        const result = await reverseGeocode(latitude, longitude);
        if (result.success && result.address) {
          setCurrentAddress(result.address);
        } else {
          setCurrentAddress('Adres alınamadı');
        }
      }
    } catch (error) {
      console.error('Error loading address:', error);
      setCurrentAddress('Konum alınamadı');
    } finally {
      setIsLoadingAddress(false);
    }
  };

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
    if (isGuest) {
      toast.error('Misafir hesabı bazı ayarları değiştiremez. Lütfen kaydolun veya giriş yapın.');
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

  const runPushConnectivityTest = async () => {
    if (!user?.id) {
      toast.error('Önce giriş yapmanız gerekiyor');
      return;
    }

    setIsRunningPushTest(true);
    setPushTestResult('');
    const startedAt = Date.now();
    const lines: string[] = [];
    const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
    const sbAnon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

    const withTimeout = async <T,>(promise: Promise<T>, ms: number, name: string): Promise<T> => {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${name} timeout after ${ms}ms`)), ms),
        ),
      ]);
    };

    try {
      lines.push(`Platform: ${isNative() ? 'native' : 'web'}`);
      lines.push(`Online: ${typeof navigator !== 'undefined' ? String(navigator.onLine) : 'unknown'}`);
      lines.push(`Supabase URL: ${sbUrl ? 'ok' : 'missing'}`);
      lines.push(`Supabase Anon Key: ${sbAnon ? 'ok' : 'missing'}`);

      let accessToken = '';
      try {
        const { accessToken: safeToken } = await safeGetSession();
        accessToken = safeToken;
        lines.push(`Session token: ${accessToken ? `ok (${accessToken.length} chars)` : 'missing'}`);
      } catch (sessionError: any) {
        lines.push(`Session token: timeout/error (${String(sessionError?.message || sessionError)})`);
      }

      if (!accessToken) {
        try {
          const direct = localStorage.getItem('authToken') || '';
          if (direct) {
            accessToken = direct;
            lines.push(`Local authToken: ok (${direct.length} chars)`);
          } else {
            lines.push('Local authToken: missing');
          }
        } catch {
          lines.push('Local authToken: read-error');
        }
      }

      if (sbUrl && sbAnon) {
        const restUrl = `${sbUrl}/rest/v1/users?select=id&id=eq.${encodeURIComponent(String(user.id))}&limit=1`;
        const restResponse = await withTimeout(
          fetch(restUrl, {
            method: 'GET',
            headers: {
              apikey: sbAnon,
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
          }),
          15000,
          'REST /users',
        );
        lines.push(`REST /users status: ${restResponse.status}`);

        const fnResponse = await withTimeout(
          fetch(`${sbUrl}/functions/v1/register-push-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: sbAnon,
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            // Invalid body on purpose: only reachability/status test.
            body: JSON.stringify({}),
          }),
          15000,
          'Function register-push-token',
        );
        lines.push(`Function register-push-token status: ${fnResponse.status}`);
      }

      if (isNative()) {
        const tokenResult = await withTimeout(FirebaseMessaging.getToken(), 15000, 'FirebaseMessaging.getToken');
        const fcmToken = String(tokenResult?.token || '');
        lines.push(`FCM token: ${fcmToken ? `ok (${fcmToken.length} chars)` : 'empty'}`);
      }

      lines.push(`Elapsed: ${Date.now() - startedAt}ms`);
      const report = lines.join('\n');
      setPushTestResult(report);
      toast.success('Push bağlantı testi tamamlandı');
      console.log('Push connectivity test report:\n' + report);
    } catch (error: any) {
      lines.push(`Error: ${String(error?.message || error || 'unknown')}`);
      lines.push(`Elapsed: ${Date.now() - startedAt}ms`);
      const report = lines.join('\n');
      setPushTestResult(report);
      toast.error('Push bağlantı testi başarısız', {
        description: String(error?.message || error || 'Bilinmeyen hata'),
      });
      console.error('Push connectivity test failed:', error);
    } finally {
      setIsRunningPushTest(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className={`sticky border-b p-4 z-50 ${isMerchant ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
        style={{
          top: 0,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(56px + env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className={`p-2 -ml-2 rounded-full ${isMerchant ? 'hover:bg-blue-700' : 'hover:bg-gray-100'}`}
            aria-label="Geri"
          >
            <ArrowLeft className={`w-5 h-5 ${isMerchant ? 'text-white' : ''}`} />
          </button>
          <h1 className={`text-xl ${isMerchant ? 'text-white' : ''}`}>Ayarlar</h1>
        </div>
      </div>
      {/* Scrollable content under the header (limit flow under Ayarlar band) */}
      <div
        className="overflow-y-auto"
        style={{
          // leave space for sticky header (status + header height)
          paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))',
          maxHeight: 'calc(100vh - (56px + env(safe-area-inset-top, 0px)))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Dev indicator - shows current webview URL when connected to a dev server (http) to help debug livereload */}
        {(import.meta.env.DEV || isDevWebview) && (
          <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-xs text-gray-700 mb-3 mx-4 rounded">
            <div className="font-medium">Dev mode</div>
            <div className="break-all">URL: {typeof window !== 'undefined' ? window.location.origin : 'n/a'}</div>
            <div className="mt-2">
              <button
                onClick={() => {
                  try {
                    // Try to reload the webview by navigating to origin
                    window.location.href = window.location.origin;
                  } catch {}
                }}
                className="text-sm text-yellow-700 underline"
              >
                Reload webview
              </button>
            </div>
          </div>
        )}
        {/* Location Permission Setting */}
        <div className="px-4 pt-2" style={{ paddingTop: 'calc(0px + env(safe-area-inset-top, 0px))', scrollSnapAlign: 'start' }}>
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Konum İzni</h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Sana en yakın ve güncel fiyatları gösterebilmek için konumuna ihtiyacımız var.
              </p>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-700">Durum:</span>
                <span className={`text-sm font-semibold ${
                  locationPermissionStatus === 'granted' ? 'text-green-600' :
                  locationPermissionStatus === 'denied' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {locationPermissionStatus === 'granted' ? 'İzin Verildi' :
                   locationPermissionStatus === 'denied' ? 'İzin Reddedildi' :
                   locationPermissionStatus === 'checking' ? 'Kontrol Ediliyor...' :
                   'İzin Bekleniyor'}
                </span>
              </div>
              {locationPermissionStatus === 'granted' && (
                <div className="mb-3">
                  <span className="text-sm text-gray-700 block mb-1">Mevcut Konum:</span>
                  {isLoadingAddress ? (
                    <span className="text-sm text-gray-500">Adres yükleniyor...</span>
                  ) : currentAddress ? (
                    <span className="text-sm text-gray-900 font-medium">{currentAddress}</span>
                  ) : (
                    <span className="text-sm text-gray-500">Adres alınamadı</span>
                  )}
                </div>
              )}
            </div>
            <Button
              onClick={async () => {
                setIsRequestingLocation(true);
                try {
                  if (isNative()) {
                    const permissions = await Geolocation.checkPermissions();
                    const currentStatus = normalizePermissionStatus(permissions);
                    if (currentStatus === 'granted') {
                      // Already granted, try to get position
                      try {
                        await getPositionWithFallback();
                        toast.success('Konum izni zaten verilmiş');
                        setLocationPermissionStatus('granted');
                        await loadCurrentAddress();
                      } catch (error) {
                        toast.warning(getLocationFriendlyError(error));
                        setLocationPermissionStatus('granted');
                      }
                    } else {
                      // Request permission
                      const requestResult = await Geolocation.requestPermissions();
                      const requestedStatus = normalizePermissionStatus(requestResult);
                      if (requestedStatus === 'granted') {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        try {
                          await getPositionWithFallback();
                          toast.success('Konum izni verildi');
                          setLocationPermissionStatus('granted');
                          await loadCurrentAddress();
                        } catch (error) {
                          toast.warning(getLocationFriendlyError(error));
                          setLocationPermissionStatus('granted');
                        }
                      } else if (requestedStatus === 'denied') {
                        toast.error('Konum izni reddedildi. Ayarlardan izin verebilirsiniz.');
                        setLocationPermissionStatus('denied');
                      } else {
                        toast.info('Konum izni bekleniyor. Lütfen izin penceresinden onaylayın.');
                        setLocationPermissionStatus(requestedStatus);
                      }
                    }
                  } else {
                    // Web
                    try {
                      const position = await getPositionWithFallback();
                      if (position) {
                        toast.success('Konum izni verildi');
                        setLocationPermissionStatus('granted');
                        await loadCurrentAddress();
                      }
                    } catch (error: any) {
                      toast.error('Konum izni reddedildi');
                      setLocationPermissionStatus('denied');
                    }
                  }
                } catch (error: any) {
                  console.error('Location permission error:', error);
                  const message = String(error?.message || '').toLowerCase();
                  if (message.includes('denied') || message.includes('permission')) {
                    toast.error('Konum izni reddedildi. Ayarlardan izin verebilirsiniz.');
                    setLocationPermissionStatus('denied');
                  } else {
                    toast.warning(getLocationFriendlyError(error));
                    setLocationPermissionStatus('prompt');
                  }
                } finally {
                  setIsRequestingLocation(false);
                }
              }}
              disabled={isRequestingLocation || locationPermissionStatus === 'checking'}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isRequestingLocation ? 'İzin isteniyor...' : 
               locationPermissionStatus === 'granted' ? 'Konum İzni Güncelle' :
               'Konum İzni Ver'}
            </Button>
            {locationPermissionStatus === 'denied' && (
              <p className="text-xs text-gray-500">
                İzni ayarlardan manuel olarak verebilirsiniz: Ayarlar → Uygulamalar → esnaftaucuz → İzinler → Konum
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search Radius Setting */}
      <div className="p-4" style={{ scrollSnapAlign: 'start' }}>
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
            {isGuest ? (
              <div className="text-sm text-gray-600">
                Misafir hesabı arama genişliğini kaydedemez. Tam hesap için giriş yapın.
                <div className="mt-2">
                  <Button onClick={() => navigate('/login')} className="w-full">Giriş / Kayıt Ol</Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleSaveSearchRadius}
                disabled={isSaving}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="p-4" style={{ scrollSnapAlign: 'start' }}>
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
                  if (isGuest) {
                    toast.error('Misafir hesabı bildirim ayarlarını değiştiremez.');
                    return;
                  }
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
            <div className="pt-2 border-t border-gray-100">
              <Button
                onClick={runPushConnectivityTest}
                disabled={isRunningPushTest}
                className="w-full bg-gray-900 hover:bg-black text-white"
              >
                {isRunningPushTest ? 'Push testi çalışıyor...' : 'Push Bağlantı Testi Çalıştır'}
              </Button>
              {pushTestResult && (
                <pre className="mt-3 bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap break-words">
{pushTestResult}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Theme Setting */}
      <div className="p-4" style={{ scrollSnapAlign: 'start' }}>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">{t('THEME')}</h2>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="radio" name="theme" checked={themeOption === 'light'} onChange={() => setThemeOption('light')} />
              <span className="ml-2">{t('LIGHT')}</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="radio" name="theme" checked={themeOption === 'dark'} onChange={() => setThemeOption('dark')} />
              <span className="ml-2">{t('DARK')}</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="radio" name="theme" checked={themeOption === 'system'} onChange={() => setThemeOption('system')} />
              <span className="ml-2">{t('SYSTEM')}</span>
            </label>
            <div>
              <Button onClick={() => { toast.success(t('THEME_SAVED')); }} className="mt-2">{t('SAVE')}</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings List */}
      <div className="p-4 space-y-2" style={{ scrollSnapAlign: 'start' }}>
        {settingsItems.filter(item => item.label !== 'Bildirimler').map((item) => (
          <button
            key={item.label}
            onClick={() => {
              if (item.path) {
                navigate(item.path);
              }
            }}
            className="w-full bg-white rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-gray-600" />
              <span>{item.label}</span>
            </div>
            {item.path && <ChevronRight className="w-5 h-5 text-gray-400" />}
          </button>
        ))}
      </div>

      {/* Delete Account Section - only for full users */}
      {!isGuest && (
        <div className="p-4" style={{ scrollSnapAlign: 'start' }}>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-3 mb-3">
              <Trash2 className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-900">Hesabı Sil</h2>
            </div>
            <p className="text-sm text-red-700 mb-4">
              Hesabınızı silmek, tüm verilerinizin kalıcı olarak silinmesine neden olur. Bu işlem geri alınamaz.
            </p>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Hesabı Sil
            </Button>
          </div>
        </div>
      )}
      {isGuest && (
        <div className="p-4">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h3 className="text-sm font-semibold">Misafir hesabı sınırlamaları</h3>
            <p className="text-xs text-gray-600 mt-2">
              Misafir hesaplar bazı ayarları değiştiremez veya hesap silemez. Tam hesap için lütfen kayıt olun veya giriş yapın.
            </p>
            <div className="mt-3">
              <Button onClick={() => navigate('/login')}>Giriş / Kayıt Ol</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Hesabı Sil</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Hesabınız ve tüm verileriniz kalıcı olarak silinecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Onaylamak için <strong>"SİL"</strong> yazın:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="SİL"
              className="uppercase"
            />
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-semibold mb-2">Silinecek veriler:</p>
              <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                <li>Tüm fiyat paylaşımlarınız</li>
                <li>Favorileriniz</li>
                <li>Bildirimleriniz</li>
                <li>Profil bilgileriniz</li>
                {resolveMerchantRole(user) && (
                  <li>Esnaf dükkanınız ve ürünleriniz</li>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={isDeleting}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteConfirmText.toUpperCase() !== 'SİL') {
                  toast.error('Onay metni "SİL" olmalıdır');
                  return;
                }

                if (!user) {
                  toast.error('Kullanıcı bilgisi bulunamadı');
                  return;
                }

                try {
                  setIsDeleting(true);
                  await usersAPI.deleteAccount(user.id);
                  toast.success('Hesabınız başarıyla silindi');
                  
                  // Logout and redirect
                  await logout();
                  navigate('/login', { replace: true });
                } catch (error: any) {
                  console.error('Delete account error:', error);
                  toast.error(error.message || 'Hesap silinirken bir hata oluştu');
                } finally {
                  setIsDeleting(false);
                  setIsDeleteDialogOpen(false);
                  setDeleteConfirmText('');
                }
              }}
              disabled={isDeleting || deleteConfirmText.toUpperCase() !== 'SİL'}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Siliniyor...' : 'Hesabı Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
