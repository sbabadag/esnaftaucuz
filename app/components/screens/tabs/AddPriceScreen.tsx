import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Camera, Image as ImageIcon, Check, MapPin, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { toast } from 'sonner';
import { productsAPI, locationsAPI, pricesAPI } from '../../../services/supabase-api';
import { useAuth } from '../../../contexts/AuthContext';
import { useGeolocation } from '../../../../src/hooks/useGeolocation';
import { forwardGeocode } from '../../../utils/geocoding';
import { supabase } from '../../../lib/supabase';

const steps = ['product', 'price', 'location', 'photo', 'confirm'];

interface Product {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  type: string;
}

export default function AddPriceScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getCurrentPosition } = useGeolocation();
  const isMerchant = (user as any)?.is_merchant === true;

  // Esnaf kontrolü - esnaf ise ürün sayfasına yönlendir
  useEffect(() => {
    if (isMerchant) {
      toast.info('Esnaf sadece ürün sayfasından ürün ekleyebilir', {
        duration: 3000,
      });
      navigate('/app/explore');
    }
  }, [isMerchant, navigate]);
  const [currentStep, setCurrentStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [allProductsIndex, setAllProductsIndex] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [searchLocationQuery, setSearchLocationQuery] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    price: '',
    unit: 'kg',
    locationId: '',
    locationName: '',
    photo: null as File | null,
    photoPreview: null as string | null,
    lat: null as number | null,
    lng: null as number | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const productsIndexCacheKey = `add-price-products-index:${user?.id || 'anon'}`;
  const locationsCacheKey = `add-price-locations-index:${user?.id || 'anon'}`;
  const withTimeout = async <T,>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
    ]);
  };

  const stepName = steps[currentStep];

  // Esnaf kontrolü - esnaf ise ürün sayfasına yönlendir
  useEffect(() => {
    if (isMerchant) {
      toast.info('Esnaf sadece ürün sayfasından ürün ekleyebilir', {
        duration: 3000,
      });
      navigate('/app/explore');
    }
  }, [isMerchant, navigate]);

  useEffect(() => {
    if (!isMerchant) {
      loadProducts();
      loadLocations();
    }
  }, [isMerchant]);

  const loadProducts = async () => {
    try {
      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (sbUrl && sbKey) {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(
          `${sbUrl}/rest/v1/products?select=id,name,category,image,is_active&order=name.asc&limit=2000`,
          {
            headers: {
              apikey: sbKey,
              Authorization: `Bearer ${sbKey}`,
            },
            signal: controller.signal,
          }
        );
        clearTimeout(tid);
        if (response.ok) {
          const rows = await response.json().catch(() => []);
          if (Array.isArray(rows) && rows.length > 0) {
            setAllProductsIndex(rows);
            setProducts(rows);
            try {
              localStorage.setItem(productsIndexCacheKey, JSON.stringify(rows));
            } catch {}
            return;
          }
        }
      }

      // Fallback to existing API path.
      const data = await productsAPI.getAll();
      setAllProductsIndex(data);
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(productsIndexCacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setAllProductsIndex(parsed);
        setProducts(parsed);
      }
    } catch {}
  }, [productsIndexCacheKey]);

  const loadLocations = async () => {
    try {
      // 1) Restore cached locations immediately.
      try {
        const raw = localStorage.getItem(locationsCacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLocations(parsed);
          }
        }
      } catch {}

      // 2) Primary: direct REST fetch (less likely to stall on auth/session edge cases).
      const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (sbUrl && sbKey) {
        const response = await withTimeout(
          fetch(
            `${sbUrl}/rest/v1/locations?select=id,name,type,coordinates&order=name.asc&limit=500`,
            {
              headers: {
                apikey: sbKey,
                Authorization: `Bearer ${sbKey}`,
              },
            }
          ),
          8000,
          'locations-rest-timeout'
        );
        if (response && response.ok) {
          const rows = await response.json().catch(() => []);
          if (Array.isArray(rows) && rows.length > 0) {
            setLocations(rows);
            try {
              localStorage.setItem(locationsCacheKey, JSON.stringify(rows));
            } catch {}
            return;
          }
        }
      }

      // 3) Secondary fallback: existing API method.
      const data = await Promise.race([
        locationsAPI.getAll(),
        new Promise<Location[]>((resolve) => setTimeout(() => resolve([]), 8000)),
      ]);
      if (Array.isArray(data) && data.length > 0) {
        setLocations(data);
        try {
          localStorage.setItem(locationsCacheKey, JSON.stringify(data));
        } catch {}
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const handleProductSearch = async (query: string) => {
    setSearchProductQuery(query);
    const q = query.trim();
    if (q) {
      const normalizeTR = (value: string) =>
        String(value || '')
          .toLowerCase()
          .replace(/ı/g, 'i')
          .replace(/İ/g, 'i')
          .replace(/ş/g, 's')
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c')
          .trim();
      const qn = normalizeTR(q);
      const score = (p: any) => {
        const n = normalizeTR(p?.name || '');
        const c = normalizeTR(p?.category || '');
        if (n === qn) return 100;
        if (n.startsWith(qn)) return 80;
        if (n.split(/\s+/).some((w) => w.startsWith(qn))) return 60;
        if (n.includes(qn)) return 40;
        if (c.includes(qn)) return 20;
        return -1;
      };

      const source = allProductsIndex.length > 0 ? allProductsIndex : products;
      const filtered = source
        .filter((p: any) => score(p) >= 0)
        .sort((a: any, b: any) => score(b) - score(a))
        .slice(0, 200);
      setProducts(filtered);
    } else {
      setProducts(allProductsIndex.length > 0 ? allProductsIndex : products);
    }
  };

  const handleLocationSearch = async (query: string) => {
    setSearchLocationQuery(query);
    if (query.trim()) {
      try {
        const results = await locationsAPI.getAll();
        const filtered = results.filter((loc: Location) =>
          loc.name.toLowerCase().includes(query.toLowerCase())
        );
        setLocations(filtered);
      } catch (error) {
        console.error('Location search error:', error);
      }
    } else {
      loadLocations();
    }
  };

  const handlePhotoSelect = (file: File | null) => {
    if (file) {
      console.log('📸 Photo selected:', {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      setFormData({
        ...formData,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
      console.log('✅ Photo added to form data');
    } else {
      console.warn('⚠️ No file selected');
    }
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      navigate('/login');
      return;
    }

    if (!formData.productId || !formData.price || !formData.locationId) {
      console.error('Form validation failed:', {
        productId: formData.productId,
        price: formData.price,
        locationId: formData.locationId,
      });
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      setIsSubmitting(true);

      // Never block submit on geolocation here.
      // Prefer selected-location coordinates; otherwise use safe default.
      const lat = formData.lat || 37.8667;
      const lng = formData.lng || 32.4833;
      console.log('📍 Submit coordinates:', { lat, lng, source: formData.lat && formData.lng ? 'selected-location' : 'default' });

      console.log('📤 Submitting price:', {
        product: formData.productId,
        price: formData.price,
        unit: formData.unit,
        location: formData.locationId,
        hasPhoto: !!formData.photo,
        photoName: formData.photo?.name,
        photoSize: formData.photo?.size,
        photoType: formData.photo?.type,
        lat,
        lng,
        hasCoordinates: !!(lat && lng),
        user: user?.id,
      });

      const result = await Promise.race([
        (async () => {
          const sessionRes = await Promise.race([
            supabase.auth.getSession(),
            new Promise<any>((resolve) => setTimeout(() => resolve(null), 1500)),
          ]);
          const accessToken = (sessionRes as any)?.data?.session?.access_token;
          return pricesAPI.create({
          product: formData.productId,
          price: parseFloat(formData.price),
          unit: formData.unit,
          location: formData.locationId,
          userId: user.id,
          accessToken,
          photo: formData.photo || undefined,
          lat,
          lng,
        });
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('price-submit-timeout')), 15000)
        ),
      ]) as any;

      console.log('✅ Price created successfully:', result.id || result._id);

      // Show warning if photo upload failed
      if ((result as any).photoUploadError) {
        toast.warning('Fiyat kaydedildi ancak fotoğraf yüklenemedi', {
          description: (result as any).photoUploadError,
          duration: 5000,
        });
      } else {
        toast.success('🎉 Teşekkürler!', {
          description: 'Paylaşımın yayına alındı. +10 katkı puanı kazandın',
          duration: 3000,
        });
      }
      
      // Small delay before navigation to ensure toast is visible
      setTimeout(() => {
        navigate('/app/explore?refresh=1');
      }, 500);
    } catch (error: any) {
      console.error('❌ Submit error:', error);
      console.error('📋 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      });
      
      let errorMessage = 'Fiyat paylaşılırken bir hata oluştu';
      
      if (error.message) {
        if (error.message.includes('price-submit-timeout')) {
          errorMessage = 'Sunucu gecikiyor. Islem zaman asimina ugradi, lutfen tekrar deneyin.';
        } else
        // Supabase specific errors
        if (error.message.includes('row-level security') || error.message.includes('RLS')) {
          errorMessage = 'Yetki hatası. Lütfen tekrar giriş yapın.';
        } else if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          errorMessage = 'Bu fiyat zaten mevcut.';
        } else if (error.message.includes('foreign key') || error.message.includes('constraint')) {
          errorMessage = 'Veri hatası. Lütfen tekrar deneyin.';
        } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
        } else if (error.message.includes('required') || error.message.includes('missing')) {
          errorMessage = 'Lütfen tüm gerekli alanları doldurun.';
        } else if (error.message.includes('Giriş yapmanız gerekiyor')) {
          errorMessage = 'Giriş yapmanız gerekiyor. Lütfen tekrar giriş yapın.';
        } else {
          // Use the error message directly if it's user-friendly
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, {
        duration: 5000,
        description: 'Lütfen tekrar deneyin veya destek ekibiyle iletişime geçin.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safety valve: if submit pipeline hangs unexpectedly, release button state.
  useEffect(() => {
    if (!isSubmitting) return;
    const timer = setTimeout(() => {
      console.warn('AddPrice submit exceeded safety threshold, resetting submit state.');
      setIsSubmitting(false);
      toast.warning('Islem beklenenden uzun surdu. Lutfen tekrar deneyin.');
    }, 20000);
    return () => clearTimeout(timer);
  }, [isSubmitting]);

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/app/explore');
    }
  };

  const createProduct = async (name: string) => {
    try {
      console.log('Creating product:', name);
      const product = await productsAPI.create(name);
      console.log('Product created:', product);
      setFormData({
        ...formData,
        productId: product.id || product._id, // Support both formats
        productName: product.name,
      });
      setCurrentStep(currentStep + 1);
      toast.success('Ürün oluşturuldu');
    } catch (error: any) {
      console.error('Create product error:', error);
      toast.error(error.message || 'Ürün oluşturulamadı');
    }
  };

  const createLocation = async (name: string, lat?: number, lng?: number) => {
    try {
      let finalLat = lat;
      let finalLng = lng;
      
      // If coordinates are not provided, try to geocode the address text
      if (!finalLat || !finalLng) {
        console.log('📍 Coordinates not provided, attempting forward geocoding for:', name);
        toast.info('Konum tespit ediliyor...', { duration: 2000 });
        
        try {
          const geocodeResult = await withTimeout(
            forwardGeocode(name),
            8000,
            'Konum tespiti zaman asimina ugradi'
          );
          
          if (geocodeResult.success && geocodeResult.lat && geocodeResult.lng) {
            finalLat = geocodeResult.lat;
            finalLng = geocodeResult.lng;
            console.log('✅ Forward geocoding successful:', { lat: finalLat, lng: finalLng, address: geocodeResult.address });
            
            // Update location name with the formatted address if available
            if (geocodeResult.address && geocodeResult.address !== name) {
              // Use the formatted address from Google Maps if it's different
              // But keep the user's input as the primary name
              console.log('📍 Formatted address from Google Maps:', geocodeResult.address);
            }
          } else {
            console.warn('⚠️ Forward geocoding failed:', geocodeResult.error);
            toast.warning('Konum tespit edilemedi, varsayılan konum kullanılıyor', {
              description: geocodeResult.error || 'Koordinatlar bulunamadı',
              duration: 3000,
            });
            // Use default coordinates (Konya center)
            finalLat = 37.8667;
            finalLng = 32.4833;
          }
        } catch (geocodeError: any) {
          console.error('❌ Forward geocoding error:', geocodeError);
          toast.warning('Konum tespit edilemedi, varsayılan konum kullanılıyor', {
            description: geocodeError.message || 'Geocoding hatası',
            duration: 3000,
          });
          // Use default coordinates (Konya center)
          finalLat = 37.8667;
          finalLng = 32.4833;
        }
      }
      
      console.log('📍 Creating location with coordinates:', { name, lat: finalLat, lng: finalLng });
      
      const location = await withTimeout(
        locationsAPI.create({
          name,
          type: 'diğer',
          lat: finalLat!,
          lng: finalLng!,
        }),
        10000,
        'Konum olusturma zaman asimina ugradi'
      );
      
      setFormData({
        ...formData,
        locationId: location.id || location._id, // Support both formats
        locationName: location.name,
        lat: finalLat || null,
        lng: finalLng || null,
      });
      
      toast.success('Konum oluşturuldu');
      setCurrentStep(currentStep + 1);
      return true;
    } catch (error: any) {
      console.error('❌ Create location error:', error);

      // Fallback: use an existing location so flow never gets stuck.
      try {
        const fallbackLocations = await Promise.race([
          locationsAPI.getAll(),
          new Promise<Location[]>((resolve) => setTimeout(() => resolve([]), 6000)),
        ]);
        const bestFallback =
          (fallbackLocations || []).find((loc: any) =>
            String(loc?.name || '').toLowerCase().includes('konum')
          ) || (fallbackLocations || [])[0];

        if (bestFallback?.id) {
          setFormData({
            ...formData,
            locationId: bestFallback.id,
            locationName: bestFallback.name,
            lat: finalLat || null,
            lng: finalLng || null,
          });
          toast.warning('Konum servisi yavas. Mevcut bir konum secildi.');
          setCurrentStep(currentStep + 1);
          return true;
        }
      } catch (fallbackError) {
        console.warn('Location fallback failed:', fallbackError);
      }

      toast.error(error.message || 'Konum oluşturulamadı');
      return false;
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      const position = await Promise.race([
        getCurrentPosition(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      // Never block on location-create network calls here.
      // Pick an existing location immediately and continue flow.
      let sourceLocations = locations;
      if (!sourceLocations || sourceLocations.length === 0) {
        try {
          // Retry loader once when current list is empty.
          await loadLocations();
          sourceLocations = locations;
          if (!sourceLocations || sourceLocations.length === 0) {
            const raw = localStorage.getItem(locationsCacheKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) sourceLocations = parsed;
            }
          }
        } catch {
          sourceLocations = [];
        }
      }

      const picked = (sourceLocations || [])[0];
      if (!picked?.id) {
        toast.error('Konum listesi yuklenemedi, lutfen tekrar deneyin.');
        return;
      }

      const lat = position?.latitude || 37.8667;
      const lng = position?.longitude || 32.4833;
      setFormData({
        ...formData,
        locationId: picked.id,
        locationName: picked.name,
        lat,
        lng,
      });
      setCurrentStep(currentStep + 1);
      if (position) {
        toast.success('Mevcut konum alindi');
      } else {
        toast.warning('Konum servisi yavas, kayitli konum ile devam edildi');
      }
    } catch (error: any) {
      console.error('Location error:', error);
      toast.warning('Konum hatasi, kayitli konum ile devam edin.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky bg-white border-b border-gray-200 p-4 z-10" style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full ${
                    index <= currentStep ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 pb-24" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
        {stepName === 'product' && (
          <div>
            <h2 className="text-2xl mb-2">Ürün seç</h2>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Ürün ara"
                className="pl-10"
                value={searchProductQuery}
                onChange={(e) => handleProductSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
              {products.map((product) => {
                const productId = product.id || (product as any)._id; // Support both formats
                return (
                  <Button
                    key={productId}
                    variant={formData.productId === productId ? 'default' : 'outline'}
                    className={formData.productId === productId ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        productId: productId,
                        productName: product.name,
                      });
                      setCurrentStep(currentStep + 1);
                    }}
                  >
                    {product.name}
                  </Button>
                );
              })}
            </div>
            {searchProductQuery && !products.find((p) => p.name.toLowerCase() === searchProductQuery.toLowerCase()) && (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => createProduct(searchProductQuery)}
              >
                "{searchProductQuery}" olarak ekle
              </Button>
            )}
          </div>
        )}

        {stepName === 'price' && (
          <div>
            <h2 className="text-2xl mb-4">Fiyat bilgisi</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="price">Fiyat (TL)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="text-2xl"
                />
              </div>
              <div>
                <Label>Birim</Label>
                <RadioGroup value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="kg" id="kg" />
                    <Label htmlFor="kg">kg</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="adet" id="adet" />
                    <Label htmlFor="adet">adet</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lt" id="lt" />
                    <Label htmlFor="lt">lt</Label>
                  </div>
                </RadioGroup>
              </div>
              <p className="text-sm text-gray-500">Lütfen gördüğün fiyatı aynen gir.</p>
            </div>
          </div>
        )}

        {stepName === 'location' && (
          <div>
            <h2 className="text-2xl mb-4">Nereden aldın?</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Yer ara"
                className="pl-10"
                value={searchLocationQuery}
                onChange={(e) => handleLocationSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {locations.map((location) => {
                const locationId = location.id || (location as any)._id; // Support both formats
                // Extract coordinates from location
                let lat: number | null = null;
                let lng: number | null = null;
                
                if ((location as any).coordinates) {
                  const coords = (location as any).coordinates;
                  if (typeof coords === 'string') {
                    // PostgreSQL POINT string format: (lng,lat)
                    const match = coords.match(/\(([^,]+),([^)]+)\)/);
                    if (match) {
                      lng = parseFloat(match[1]);
                      lat = parseFloat(match[2]);
                    }
                  } else if (typeof coords === 'object') {
                    if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
                      lat = coords.lat;
                      lng = coords.lng;
                    } else if (typeof coords.x === 'number' && typeof coords.y === 'number') {
                      lat = coords.y; // PostgreSQL POINT stores as (lng, lat)
                      lng = coords.x;
                    }
                  }
                }
                
                return (
                  <Button
                    key={locationId}
                    variant={formData.locationId === locationId ? 'default' : 'outline'}
                    className={`w-full justify-start ${formData.locationId === locationId ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    onClick={() => {
                      console.log('📍 Location selected:', {
                        id: locationId,
                        name: location.name,
                        lat,
                        lng,
                      });
                      setFormData({
                        ...formData,
                        locationId: locationId,
                        locationName: location.name,
                        lat: lat || formData.lat,
                        lng: lng || formData.lng,
                      });
                      setCurrentStep(currentStep + 1);
                    }}
                  >
                    {location.name}
                  </Button>
                );
              })}
            </div>
            {searchLocationQuery && !locations.find((l) => l.name.toLowerCase() === searchLocationQuery.toLowerCase()) && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => createLocation(searchLocationQuery)}
              >
                "{searchLocationQuery}" olarak ekle
              </Button>
            )}
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={handleUseCurrentLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Konum alınıyor...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  Mevcut Konum
                </>
              )}
            </Button>
          </div>
        )}

        {stepName === 'photo' && (
          <div>
            <h2 className="text-2xl mb-2">Fotoğraf ekle</h2>
            <p className="text-gray-500 mb-6">Etiket veya tezgâh fotoğrafı güveni artırır.</p>
            {formData.photoPreview && (
              <div className="mb-4">
                <img src={formData.photoPreview} alt="Preview" className="w-full rounded-lg" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.capture = 'environment';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handlePhotoSelect(file);
                  };
                  input.click();
                }}
              >
                <Camera className="w-8 h-8" />
                <span>Kamera</span>
              </Button>
              <Button
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handlePhotoSelect(file);
                  };
                  input.click();
                }}
              >
                <ImageIcon className="w-8 h-8" />
                <span>Galeri</span>
              </Button>
            </div>
          </div>
        )}

        {stepName === 'confirm' && (
          <div>
            <h2 className="text-2xl mb-2">Bilgileri kontrol et</h2>
            <p className="text-gray-500 mb-6">Yanlış fiyat girilmesi kullanıcıları yanıltır.</p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Ürün:</span>
                <span>{formData.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fiyat:</span>
                <span className="text-xl text-green-600">{formData.price} TL / {formData.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Yer:</span>
                <span>{formData.locationName}</span>
              </div>
              {formData.photoPreview && (
                <div className="mt-4">
                  <img src={formData.photoPreview} alt="Preview" className="w-full rounded-lg" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-[100] pb-safe" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <Button
          onClick={handleNext}
          disabled={
            isSubmitting ||
            (stepName === 'product' && !formData.productId) ||
            (stepName === 'price' && !formData.price) ||
            (stepName === 'location' && !formData.locationId)
          }
          className="w-full bg-green-600 hover:bg-green-700 py-6 text-white"
        >
          {isSubmitting ? (
            'Gönderiliyor...'
          ) : stepName === 'confirm' ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Fiyatı Paylaş
            </>
          ) : (
            'Devam'
          )}
        </Button>
      </div>
    </div>
  );
}
