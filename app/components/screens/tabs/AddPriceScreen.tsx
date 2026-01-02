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
  const [currentStep, setCurrentStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
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

  const stepName = steps[currentStep];

  useEffect(() => {
    loadProducts();
    loadLocations();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await productsAPI.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadLocations = async () => {
    try {
      const data = await locationsAPI.getAll();
      setLocations(data);
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const handleProductSearch = async (query: string) => {
    setSearchProductQuery(query);
    if (query.trim()) {
      try {
        const results = await productsAPI.getAll(query);
        setProducts(results);
      } catch (error) {
        console.error('Product search error:', error);
      }
    } else {
      loadProducts();
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
      setFormData({
        ...formData,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
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

      // Get user location if available
      let lat = formData.lat;
      let lng = formData.lng;
      if (!lat || !lng) {
        // Try to get from browser geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              lat = position.coords.latitude;
              lng = position.coords.longitude;
            },
            () => {
              console.log('Geolocation not available');
            }
          );
        }
      }

      console.log('📤 Submitting price:', {
        product: formData.productId,
        price: formData.price,
        unit: formData.unit,
        location: formData.locationId,
        hasPhoto: !!formData.photo,
        lat,
        lng,
        user: user?.id,
      });

      const result = await pricesAPI.create({
        product: formData.productId,
        price: parseFloat(formData.price),
        unit: formData.unit,
        location: formData.locationId,
        photo: formData.photo || undefined,
        lat: lat || undefined,
        lng: lng || undefined,
      });

      console.log('✅ Price created successfully:', result.id || result._id);

      toast.success('🎉 Teşekkürler!', {
        description: 'Paylaşımın yayına alındı. +10 katkı puanı kazandın',
        duration: 3000,
      });
      
      // Small delay before navigation to ensure toast is visible
      setTimeout(() => {
        navigate('/app/explore');
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
      const location = await locationsAPI.create({
        name,
        type: 'diğer',
        lat: lat || 37.8667,
        lng: lng || 32.4833,
      });
      setFormData({
        ...formData,
        locationId: location.id || location._id, // Support both formats
        locationName: location.name,
        lat: lat || null,
        lng: lng || null,
      });
      setCurrentStep(currentStep + 1);
    } catch (error) {
      toast.error('Konum oluşturulamadı');
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      const position = await getCurrentPosition();
      
      if (position) {
        const { latitude, longitude } = position;
        
        // Create location name from coordinates or use a default name
        const locationName = `Mevcut Konum (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        
        // Try to find existing location nearby (within 100m)
        // For now, create a new location
        await createLocation('Mevcut Konum', latitude, longitude);
        
        toast.success('Mevcut konum alındı');
      } else {
        toast.error('Konum alınamadı. Lütfen konum iznini kontrol edin.');
      }
    } catch (error: any) {
      console.error('Location error:', error);
      toast.error('Konum alınamadı: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setIsGettingLocation(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
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
      <div className="p-6 pb-24">
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
                return (
                  <Button
                    key={locationId}
                    variant={formData.locationId === locationId ? 'default' : 'outline'}
                    className={`w-full justify-start ${formData.locationId === locationId ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        locationId: locationId,
                        locationName: location.name,
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
