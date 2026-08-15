import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  Phone,
  MapPin,
  Clock,
  FileText,
  MessageCircle,
  Image as ImageIcon,
  Camera,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usersAPI, invalidateMerchantCaches } from '../../services/supabase-api';
import { resolveMerchantRoleFromProfile } from '../../lib/merchant-role';
import {
  emptyMerchantProfile,
  merchantProfileColumnPatch,
  merchantProfilePreferencesPatch,
  readMerchantProfileFromUser,
  type MerchantProfileFields,
} from '../../lib/merchant-profile';
import { pickImages } from '../../lib/native-image-picker';
import { safeGetSession } from '../../lib/supabase';
import { useGeolocation } from '../../../src/hooks/useGeolocation';
import { reverseGeocode } from '../../utils/geocoding';
import {
  geocodeMerchantShopAddress,
  syncMerchantShopCoordinates,
} from '../../lib/merchant-shop-coords';
import { v4 as uuidv4 } from 'uuid';
import { Capacitor } from '@capacitor/core';

export default function MerchantProfileScreen() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const isMerchant = resolveMerchantRoleFromProfile(user);
  const [form, setForm] = useState<MerchantProfileFields>(emptyMerchantProfile());
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const { getCurrentPosition } = useGeolocation();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Kullanıcı yerel olarak logo seçtiyse/kaldırdıysa true. Arka planda user nesnesi
  // değiştiğinde (token yenileme / profil senkronu) seçili logoyu sessizce sıfırlamayı önler.
  const hasLocalLogoChangeRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (hasLocalLogoChangeRef.current) {
      // Kaydedilmemiş logo değişikliği varken formu user'dan senkronlama —
      // aksi halde ilk kayıt denemesi eski logoyla gidiyordu.
      return;
    }
    const profile = readMerchantProfileFromUser(user);
    setForm(profile);
    setLogoPreview(profile.logoUrl);
    setLogoFile(null);
  }, [user]);

  useEffect(() => {
    if (user && !isMerchant) {
      toast.error('Bu sayfa yalnızca esnaf hesapları içindir');
      navigate('/app/settings', { replace: true });
    }
  }, [user, isMerchant, navigate]);

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  const setField = <K extends keyof MerchantProfileFields>(key: K, value: MerchantProfileFields[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const applyLocalLogoFile = (file: File, previewUrl?: string) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Sadece resim dosyası seçin');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo en fazla 5 MB olabilir');
      return;
    }
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }
    hasLocalLogoChangeRef.current = true;
    setLogoFile(file);
    setLogoPreview(previewUrl || URL.createObjectURL(file));
  };

  const handlePickLogoNative = async (source: 'camera' | 'gallery') => {
    try {
      setIsUploadingLogo(true);
      const picked = await pickImages({ source, multiple: false, quality: 85 });
      if (!picked.length) return;
      applyLocalLogoFile(picked[0].file, picked[0].previewUrl);
    } catch (error: any) {
      const msg = String(error?.message || error || '');
      if (!/cancel/i.test(msg)) {
        toast.error(msg || 'Logo seçilemedi');
      }
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const clearLogo = () => {
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }
    hasLocalLogoChangeRef.current = true;
    setLogoFile(null);
    setLogoPreview('');
    setField('logoUrl', '');
  };

  const handleUseCurrentLocation = async () => {
    if (isLocating || isSaving) return;
    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      if (!position) {
        toast.error('Konum alınamadı. Konum iznini kontrol edin.');
        return;
      }
      const geo = await reverseGeocode(position.latitude, position.longitude);
      if (!geo.success || !geo.address) {
        toast.error(geo.error || 'Adres bulunamadı. Adresi elle girebilirsiniz.');
        return;
      }
      setField('address', geo.address);
      if (geo.city) setField('city', geo.city);
      if (geo.district) setField('district', geo.district);
      toast.success('Adres konumdan alındı — istersen düzenleyebilirsin');
    } catch (error: any) {
      console.error('Use current location failed:', error);
      toast.error(error?.message || 'Adres alınamadı');
    } finally {
      setIsLocating(false);
    }
  };

  const uploadLogoToStorage = async (
    file: File,
    userId: string,
    options?: { token?: string; allowRetry?: boolean }
  ): Promise<string> => {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!sbUrl || !sbKey) throw new Error('Depolama ayarları eksik');

    // Prefer cached JWT — avoid waiting on hung getSession during save.
    let token =
      options?.token ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null) ||
      '';
    if (!token) {
      const { accessToken } = await safeGetSession();
      token = accessToken || '';
    }
    if (!token) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || '';
          if (!(key.startsWith('sb-') && key.endsWith('-auth-token'))) continue;
          const parsed = JSON.parse(localStorage.getItem(key) || '{}');
          if (parsed?.access_token) {
            token = parsed.access_token;
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (!token) throw new Error('Oturum bulunamadı — tekrar giriş yapın');

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    // Path must start with auth.uid() — price-photos RLS uses foldername[1] = auth.uid().
    const objectPath = `${userId}/shop-logo-${uuidv4()}.${ext}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 30000);

    try {
      const resp = await fetch(`${sbUrl}/storage/v1/object/price-photos/${objectPath}`, {
        method: 'POST',
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'false',
        },
        body: file,
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        console.error('Logo upload failed:', resp.status, body);
        if ((resp.status === 401 || resp.status === 403) && options?.allowRetry !== false) {
          // Önbellekteki token eskimiş olabilir — taze oturumla bir kez daha dene.
          try {
            const fresh = await safeGetSession();
            if (fresh.accessToken && fresh.accessToken !== token) {
              return uploadLogoToStorage(file, userId, {
                token: fresh.accessToken,
                allowRetry: false,
              });
            }
          } catch {
            /* retry kurulamazsa aşağıdaki hataya düş */
          }
        }
        if (resp.status === 403 || /row-level security|access denied|unauthorized/i.test(body)) {
          throw new Error(
            'Logo yükleme izni yok (403). Oturumu yenileyip tekrar deneyin; sorun sürerse Storage politikasını kontrol edin.'
          );
        }
        throw new Error(`Logo yüklenemedi: ${body.substring(0, 160) || resp.status}`);
      }
      return `${sbUrl}/storage/v1/object/public/price-photos/${objectPath}`;
    } catch (err: any) {
      clearTimeout(tid);
      if (err?.name === 'AbortError') {
        throw new Error('Logo yükleme zaman aşımına uğradı');
      }
      throw err;
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('Giriş yapmanız gerekiyor');
      return;
    }
    const shopName = form.shopName.trim();
    if (!shopName) {
      toast.error('Dükkan adı zorunludur');
      return;
    }
    if (shopName.length < 2) {
      toast.error('Dükkan adı en az 2 karakter olmalı');
      return;
    }

    try {
      setIsSaving(true);

      let logoUrl = form.logoUrl.trim();
      if (logoFile) {
        toast.info('Logo yükleniyor...');
        logoUrl = await uploadLogoToStorage(logoFile, user.id);
      }

      const nextForm: MerchantProfileFields = {
        ...form,
        shopName,
        logoUrl,
      };

      const columns = merchantProfileColumnPatch(nextForm);

      // Geocode shop address so the map pin sits on Peri Sokak (not last GPS).
      let shopCoords: { lat: number; lng: number } | null = null;
      const geo = await geocodeMerchantShopAddress({
        address: form.address,
        district: form.district,
        city: form.city,
      });
      if (geo?.coords) shopCoords = geo.coords;

      const updated = await usersAPI.update(
        user.id,
        {
          ...columns,
          location: {
            city: form.city.trim() || undefined,
            district: form.district.trim() || undefined,
            ...(shopCoords
              ? { coordinates: { lat: shopCoords.lat, lng: shopCoords.lng } }
              : {}),
          },
          preferences: merchantProfilePreferencesPatch(nextForm) as any,
        },
        {
          existingPreferences: (user as any)?.preferences || {},
          existingLocation: (user as any)?.location || {},
        }
      );

      const mergedLocal = readMerchantProfileFromUser(updated || { ...user, ...columns });
      setForm(mergedLocal);
      setLogoPreview(mergedLocal.logoUrl);
      setLogoFile(null);
      // Kayıt başarılı — refreshUser sonrası gelen profil artık formu senkronlayabilir.
      hasLocalLogoChangeRef.current = false;

      // Optimistic local cache so UI updates without waiting for refreshUser.
      try {
        const cached = {
          ...user,
          ...(updated || {}),
          ...columns,
          name: shopName,
          location: {
            ...((user as any)?.location || {}),
            city: form.city.trim() || null,
            district: form.district.trim() || null,
            ...(shopCoords
              ? { coordinates: { lat: shopCoords.lat, lng: shopCoords.lng } }
              : {}),
          },
          preferences: {
            ...((user as any)?.preferences || {}),
            ...merchantProfilePreferencesPatch(nextForm),
          },
        };
        localStorage.setItem('user', JSON.stringify(cached));
      } catch {
        /* ignore */
      }

      toast.success('Esnaf bilgileri kaydedildi');
      // Background: refresh session + push coords to products/prices/map feed.
      void refreshUser();
      if (shopCoords) {
        void syncMerchantShopCoordinates({
          merchantId: user.id,
          coords: shopCoords,
          address: geo?.formattedAddress || form.address,
          city: form.city,
          district: form.district,
          locationName: shopName,
        }).then(() => {
          invalidateMerchantCaches();
        });
      }
    } catch (error: any) {
      console.error('Merchant profile save error:', error);
      toast.error(error?.message || 'Bilgiler kaydedilemedi');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Button onClick={() => navigate('/login')}>Giriş yap</Button>
      </div>
    );
  }

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div
        className="flex-shrink-0 bg-blue-600 text-white border-b border-blue-700"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2 px-3 pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-500"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Esnaf Bilgileri</h1>
            <p className="text-xs text-blue-100">Tüm alanlar veritabanına kaydedilir</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-blue-700">
            <Store className="w-4 h-4" />
            <h2 className="font-semibold text-sm">Dükkan kimliği</h2>
          </div>

          <div className="space-y-2">
            <Label>Firma logosu</Label>
            <div className="flex items-start gap-3">
              <div className="relative w-24 h-24 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Firma logosu" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                )}
                {logoPreview && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5"
                    aria-label="Logoyu kaldır"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs text-gray-500">
                  Keşfet ve dükkan sayfasında görünür. JPG/PNG, en fazla 5 MB.
                </p>
                {isNative ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingLogo || isSaving}
                      onClick={() => handlePickLogoNative('gallery')}
                    >
                      <ImageIcon className="w-4 h-4 mr-1" />
                      Galeri
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingLogo || isSaving}
                      onClick={() => handlePickLogoNative('camera')}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      Kamera
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) applyLocalLogoFile(file);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingLogo || isSaving}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="w-4 h-4 mr-1" />
                      Logo seç
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shopName">Dükkan adı *</Label>
            <Input
              id="shopName"
              value={form.shopName}
              onChange={(e) => setField('shopName', e.target.value)}
              placeholder="Örn: Mahalle Manavı"
              maxLength={80}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Kısa açıklama</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Ne satıyorsunuz? Örn: Taze sebze-meyve, günlük ekmek..."
              rows={3}
              maxLength={400}
            />
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-blue-700">
            <Phone className="w-4 h-4" />
            <h2 className="font-semibold text-sm">İletişim</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="05xx xxx xx xx"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </Label>
            <Input
              id="whatsapp"
              type="tel"
              value={form.whatsapp}
              onChange={(e) => setField('whatsapp', e.target.value)}
              placeholder="Boş bırakırsanız telefon kullanılır"
              inputMode="tel"
            />
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-blue-700">
            <MapPin className="w-4 h-4" />
            <h2 className="font-semibold text-sm">Adres</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="address">Açık adres</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLocating || isSaving}
                onClick={handleUseCurrentLocation}
                className="text-xs h-7 px-2 flex-shrink-0"
              >
                <MapPin className="w-3.5 h-3.5 mr-1" />
                {isLocating ? 'Konum alınıyor...' : 'Mevcut konumdan al'}
              </Button>
            </div>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="Mahalle, sokak, no..."
              rows={2}
              maxLength={240}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">İl</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="Konya"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">İlçe</Label>
              <Input
                id="district"
                value={form.district}
                onChange={(e) => setField('district', e.target.value)}
                placeholder="Selçuklu"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-blue-700">
            <Clock className="w-4 h-4" />
            <h2 className="font-semibold text-sm">Çalışma saatleri</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openingHours">Saatler</Label>
            <Input
              id="openingHours"
              value={form.openingHours}
              onChange={(e) => setField('openingHours', e.target.value)}
              placeholder="Pzt–Cmt 09:00–19:00, Paz kapalı"
              maxLength={120}
            />
          </div>
          <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-md p-3">
            <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              Logo, telefon, adres ve diğer alanlar <strong>users</strong> tablosunda saklanır.
              E-posta ({user.email}) giriş hesabıdır; buradan değiştirilemez.
            </p>
          </div>
        </section>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-20"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700"
          onClick={handleSave}
          disabled={isSaving || isUploadingLogo}
        >
          {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>
    </div>
  );
}
