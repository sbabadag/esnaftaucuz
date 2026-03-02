import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Camera, Image as ImageIcon, X, MapPin, Navigation, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from 'sonner';
import { merchantProductsAPI, productsAPI, locationsAPI } from '../../services/supabase-api';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../../src/hooks/useGeolocation';
import { forwardGeocode, reverseGeocode } from '../../utils/geocoding';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// Image component that reserves space and shows a placeholder until loaded
function ProductImage({ src, alt }: { src: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="w-full h-full relative bg-gray-100 overflow-hidden">
      {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
      <img
        src={src}
        alt={alt || ''}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

interface MerchantProduct {
  id: string;
  product: {
    id: string;
    name: string;
    category: string;
    image?: string;
  };
  price: number;
  unit: string;
  images: string[];
  location?: {
    id: string;
    name: string;
    coordinates?: any;
  };
  coordinates?: any;
  verification_count: number;
  unverification_count: number;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
}

export default function MerchantShopScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { merchantId } = useParams<{ merchantId: string }>();
  const { user } = useAuth();
  const { getCurrentPosition } = useGeolocation();
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MerchantProduct | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableQuery, setAvailableQuery] = useState<string>('');
  const searchTimeoutRef = useRef<number | null>(null);
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    price: '',
    unit: 'kg',
    images: [] as File[],
    imagePreviews: [] as string[],
    locationId: '',
    locationName: '',
    coordinates: null as { lat: number; lng: number } | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [userVerifications, setUserVerifications] = useState<Record<string, { is_verified: boolean }>>({});
  const [saveProgress, setSaveProgress] = useState<number>(0);
  const [saveStage, setSaveStage] = useState<string>('');
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(true);
  const [subscriptionPeriodEnd, setSubscriptionPeriodEnd] = useState<string | null>(null);
  const [subscriptionFeeTl, setSubscriptionFeeTl] = useState(1000);

  const isOwnShop = merchantId === user?.id;
  const isMerchant = (user as any)?.is_merchant === true;
  const primaryBg = isMerchant ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700';
  const outlinePrimary = isMerchant ? 'border-blue-600 text-blue-600 hover:bg-blue-50' : 'border-green-600 text-green-600 hover:bg-green-50';

  useEffect(() => {
    if (merchantId) {
      loadMerchantProducts();
    }
  }, [merchantId]);

  useEffect(() => {
    if (isOwnShop && isMerchant && user?.id) {
      checkMerchantSubscription();
    }
  }, [isOwnShop, isMerchant, user?.id]);

  useEffect(() => {
    if (user && products.length > 0) {
      loadUserVerifications();
    }
  }, [user, products]);

  useEffect(() => {
    if (isDialogOpen && isOwnShop) {
      loadAvailableProducts();
    }
  }, [isDialogOpen, isOwnShop]);

  const loadMerchantProducts = async () => {
    try {
      setIsLoading(true);
      const data = await merchantProductsAPI.getByMerchant(merchantId!);
      setProducts(data || []);
    } catch (error: any) {
      console.error('Failed to load merchant products:', error);
      toast.error('Ürünler yüklenirken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const checkMerchantSubscription = async () => {
    if (!user?.id) return;
    try {
      setIsCheckingSubscription(true);
      const [{ data: isActive, error: rpcError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.rpc('has_active_merchant_subscription', { p_user_id: user.id }),
        supabase
          .from('users')
          .select('merchant_subscription_current_period_end, merchant_subscription_fee_tl')
          .eq('id', user.id)
          .single(),
      ]);

      if (rpcError) {
        console.error('Subscription RPC check failed:', rpcError);
        setHasActiveSubscription(false);
      } else {
        setHasActiveSubscription(!!isActive);
      }

      if (!profileError && profile) {
        setSubscriptionPeriodEnd(profile.merchant_subscription_current_period_end || null);
        setSubscriptionFeeTl(profile.merchant_subscription_fee_tl || 1000);
      }
    } catch (error) {
      console.error('Subscription check failed:', error);
      setHasActiveSubscription(false);
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  const loadAvailableProducts = async (search?: string) => {
    try {
      const data = await productsAPI.getAll(search || undefined);
      setAvailableProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Debounced search for available products in dialog
  useEffect(() => {
    // If empty query, load all
    if (!availableQuery) {
      loadAvailableProducts();
      return;
    }

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      loadAvailableProducts(availableQuery);
      searchTimeoutRef.current = null;
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [availableQuery]);

  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  const createNewProduct = async (name: string) => {
    if (!name || isCreatingProduct) return;
    try {
      setIsCreatingProduct(true);
      const created = await productsAPI.create(name);
      // Prepend to available list and select it
      setAvailableProducts((prev) => [created, ...prev]);
      setFormData((f) => ({ ...f, productId: created.id, productName: created.name }));
      toast.success('Yeni ürün oluşturuldu ve seçildi');
    } catch (error: any) {
      console.error('Create product error:', error);
      toast.error(error.message || 'Ürün oluşturulamadı');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const loadUserVerifications = async () => {
    if (!user) return;
    
    try {
      const verifications: Record<string, { is_verified: boolean }> = {};
      
      for (const product of products) {
        const verification = await merchantProductsAPI.getUserVerification(product.id, user.id);
        if (verification) {
          verifications[product.id] = { is_verified: verification.is_verified };
        }
      }
      
      setUserVerifications(verifications);
    } catch (error) {
      console.error('Failed to load user verifications:', error);
    }
  };

  const handleVerify = async (productId: string, isVerified: boolean) => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return;
    }

    try {
      await merchantProductsAPI.verify(productId, user.id, isVerified);
      
      // Update local state
      setUserVerifications({
        ...userVerifications,
        [productId]: { is_verified: isVerified },
      });
      
      // Reload products to get updated counts
      loadMerchantProducts();
      
      toast.success(isVerified ? 'Ürün onaylandı' : 'Ürün onaysız olarak işaretlendi');
    } catch (error: any) {
      console.error('Verify error:', error);
      toast.error(error.message || 'Onaylama işlemi başarısız');
    }
  };

  const handleImageSelect = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        newFiles.push(file);
        newPreviews.push(URL.createObjectURL(file));
      }
    });
    
    setFormData({
      ...formData,
      images: [...formData.images, ...newFiles],
      imagePreviews: [...formData.imagePreviews, ...newPreviews],
    });
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    const newPreviews = formData.imagePreviews.filter((_, i) => i !== index);
    
    // Revoke object URL to prevent memory leak
    URL.revokeObjectURL(formData.imagePreviews[index]);
    
    setFormData({
      ...formData,
      images: newImages,
      imagePreviews: newPreviews,
    });
  };

  const handleGetLocation = async () => {
    try {
      setIsGettingLocation(true);
      const position = await getCurrentPosition();
      
      if (position) {
        const { latitude, longitude } = position;
        // Try to resolve a human-readable address for the coordinates
        let address = '';
        try {
          const result = await reverseGeocode(latitude, longitude);
          if (result.success && result.address) {
            address = result.address;
          } else {
            console.warn('Reverse geocode did not return an address:', result.error);
          }
        } catch (rgError) {
          console.error('Reverse geocode error:', rgError);
        }

        setFormData({
          ...formData,
          coordinates: { lat: latitude, lng: longitude },
          locationName: address || `Mevcut Konum (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
        });
        toast.success('Konum alındı');
      }
    } catch (error) {
      console.error('Location error:', error);
      toast.error('Konum alınamadı');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleLocationTextChange = async (text: string) => {
    setFormData({ ...formData, locationName: text });
    
    if (text.trim().length > 5) {
      try {
        const result = await forwardGeocode(text);
        if (result.success && result.coordinates) {
          setFormData({
            ...formData,
            locationName: text,
            coordinates: result.coordinates,
          });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    }
  };

  const uploadImages = async (images: File[], onProgress?: (completed: number, total: number, fileName?: string) => void): Promise<string[]> => {
    if (!user) throw new Error('User not authenticated');

    let completed = 0;
    const total = images.length;

    const uploadPromises = images.map((image) =>
      (async () => {
        try {
          const fileExt = image.name.split('.').pop() || 'jpg';
          const fileName = `merchant-products/${user.id}/${uuidv4()}.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('price-photos')
            .upload(fileName, image, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('Image upload error:', uploadError);
            return null;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('price-photos')
            .getPublicUrl(uploadData.path);

          // Fallback: if publicUrl is missing or malformed, construct one manually
          if (publicUrl && typeof publicUrl === 'string' && publicUrl.includes('http')) {
            return publicUrl;
          }

          try {
            const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
            if (base) {
              const manual = `${base}/storage/v1/object/public/price-photos/${encodeURIComponent(uploadData.path)}`;
              console.warn('Using manual public URL fallback for uploaded image:', manual);
              return manual;
            }
          } catch (e) {
            console.error('Failed to construct manual public URL fallback:', e);
          }

          return publicUrl;
        } catch (error) {
          console.error('Failed to upload image:', error);
          return null;
        } finally {
          completed += 1;
          if (onProgress) onProgress(completed, total, image.name);
        }
      })()
    );

    const results = await Promise.allSettled(uploadPromises);
    const uploadedUrls: string[] = results
      .filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value)
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!user || !isOwnShop) {
      toast.error('Yetkiniz yok');
      return;
    }

    if (!formData.productId || !formData.price) {
      toast.error('Lütfen ürün ve fiyat bilgilerini girin');
      return;
    }

    if (!hasActiveSubscription) {
      toast.error(`Esnaf aboneliğiniz aktif değil. Dükkan yönetimi için ${subscriptionFeeTl} TL/ay abonelik gereklidir.`);
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('🔄 Starting product submit...', { editingProduct: !!editingProduct });

      // Upload images with timeout
      let imageUrls: string[] = [];
      if (formData.images.length > 0) {
        console.log('📤 Uploading images (parallel)...', formData.images.length);
        try {
          setSaveStage('Fotoğraflar yükleniyor...');
          setSaveProgress(5);
          // Run parallel uploads but still enforce an overall timeout
          const uploadPromise = uploadImages(formData.images, (completed, total, fileName) => {
            // Map image upload progress to 5%..75% range
            const percent = 5 + Math.round((completed / total) * 70);
            setSaveProgress(percent);
            // Show count and current filename
            const safeName = fileName ? ` - ${fileName}` : '';
            setSaveStage(`${completed}/${total} fotoğraf yüklendi${safeName}`);
          });
          const timeoutPromise = new Promise<string[]>((_, reject) =>
            setTimeout(() => reject(new Error('Resim yükleme zaman aşımına uğradı')), 30000)
          );
          imageUrls = await Promise.race([uploadPromise, timeoutPromise]);
          console.log('✅ Images uploaded:', imageUrls.length);
          setSaveProgress(80);
        } catch (uploadError: any) {
          console.error('❌ Image upload error:', uploadError);
          toast.error(uploadError.message || 'Resim yükleme başarısız');
          // Continue without images if upload fails
          setSaveProgress(30);
        }
      }

      // Create or update product with timeout
      console.log('💾 Saving product...');
      setSaveStage('Ürün kaydediliyor...');
      setSaveProgress(85);
      const savePromise = editingProduct
        ? merchantProductsAPI.update(editingProduct.id, {
            price: parseFloat(formData.price),
            unit: formData.unit,
            images: imageUrls.length > 0 ? imageUrls : editingProduct.images,
            location_id: formData.locationId || undefined,
            coordinates: formData.coordinates || undefined,
          })
        : merchantProductsAPI.create({
            merchant_id: user.id,
            product_id: formData.productId,
            price: parseFloat(formData.price),
            unit: formData.unit,
            images: imageUrls,
            location_id: formData.locationId || undefined,
            coordinates: formData.coordinates || undefined,
          });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı')), 20000)
      );
      
      const savedResult: any = await Promise.race([savePromise, timeoutPromise]);
      console.log('✅ Product saved successfully:', savedResult);
      setSaveProgress(95);
      setSaveStage('Tamamlanıyor...');

      toast.success(editingProduct ? 'Ürün güncellendi' : 'Ürün eklendi');

      // Optimistically update local products list instead of reloading everything
      setProducts((prev) => {
        // Ensure savedResult contains images; if not, use the uploaded imageUrls as fallback
        const newItem = {
          ...savedResult,
          images: (savedResult?.images && savedResult.images.length > 0) ? savedResult.images : imageUrls,
        };
        // If editing, replace existing item; otherwise prepend
        if (editingProduct) {
          return prev.map((p) => (p.id === editingProduct.id ? newItem : p));
        }
        return [newItem, ...prev];
      });

      // Reset form and close dialog immediately for snappier UX
      setFormData({
        productId: '',
        price: '',
        unit: 'kg',
        images: [],
        imagePreviews: [],
        locationId: '',
        locationName: '',
        coordinates: null,
      });
      setEditingProduct(null);
      setIsDialogOpen(false);
      
      // Ensure we stay on merchant-shop page (prevent any unwanted navigation)
      // Use replace: true to prevent back navigation issues
      if (merchantId && location.pathname !== `/app/merchant-shop/${merchantId}`) {
        console.log('🔄 Ensuring we stay on merchant-shop page');
        navigate(`/app/merchant-shop/${merchantId}`, { replace: true });
      }
    } catch (error: any) {
      console.error('❌ Submit error:', error);
      const errorMessage = error.message || 'Bir hata oluştu';
      toast.error(errorMessage);
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
      console.log('✅ Submit process completed');
    }
  };

  const handleEdit = (product: MerchantProduct) => {
    if (!hasActiveSubscription) {
      toast.error(`Esnaf aboneliğiniz aktif değil. Dükkan yönetimi için ${subscriptionFeeTl} TL/ay abonelik gereklidir.`);
      return;
    }

    setEditingProduct(product);
    setFormData({
      productId: product.product.id,
      productName: product.product.name,
      price: product.price.toString(),
      unit: product.unit,
      images: [],
      imagePreviews: product.images || [],
      locationId: product.location?.id || '',
      locationName: product.location?.name || '',
      coordinates: product.coordinates ? parseCoordinates(product.coordinates) : null,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (productId: string) => {
    if (!hasActiveSubscription) {
      toast.error(`Esnaf aboneliğiniz aktif değil. Dükkan yönetimi için ${subscriptionFeeTl} TL/ay abonelik gereklidir.`);
      return;
    }

    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;

    try {
      await merchantProductsAPI.delete(productId);
      toast.success('Ürün silindi');
      loadMerchantProducts();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Silme işlemi başarısız');
    }
  };

  const parseCoordinates = (coords: any): { lat: number; lng: number } | null => {
    if (!coords) return null;
    
    if (typeof coords === 'string') {
      const match = coords.match(/\(([^,]+),([^)]+)\)/);
      if (match) {
        return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
      }
    } else if (typeof coords === 'object') {
      if (coords.lat && coords.lng) {
        return { lat: coords.lat, lng: coords.lng };
      } else if (coords.x && coords.y) {
        return { lat: coords.y, lng: coords.x };
      }
    }
    
    return null;
  };

  const getShopCoordinates = (): { lat: number; lng: number } | null => {
    if (products.length === 0) return null;
    
    // Get coordinates from first product with coordinates
    for (const product of products) {
      const coords = parseCoordinates(product.coordinates || product.location?.coordinates);
      if (coords) return coords;
    }
    
    return null;
  };

  const handleNavigateToShop = () => {
    const coords = getShopCoordinates();
    if (coords) {
      navigate(`/app/map?lat=${coords.lat}&lng=${coords.lng}&focus=true`);
    } else {
      toast.error('Dükkan konumu bulunamadı');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Full-screen blocking progress modal during save */}
      {isSubmitting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="status"
          aria-live="polite"
        >
          <div className="bg-white rounded-lg p-6 w-80 max-w-[90%] flex flex-col items-center shadow-lg">
            <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-3">
              <div
                className="h-2 bg-green-600 transition-all"
                style={{ width: `${saveProgress}%` }}
              />
            </div>
            <div className="text-sm text-gray-700 text-center">
              {saveStage || `${saveProgress}%`}
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div
        className="bg-white border-b border-gray-200 fixed left-0 right-0 z-50"
        style={{
          top: 0,
          // Make header occupy a fixed height including the safe area to avoid layout calculations drifting
          height: 'calc(env(safe-area-inset-top, 0px) + 56px)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="flex items-center justify-between px-4" style={{ height: '56px' }}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Esnaf Dükkanı</h1>
          </div>
          {/* If this is the owner's shop, show Add button and dialog to create products */}
          {isOwnShop && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (!hasActiveSubscription) {
                    toast.error(`Esnaf aboneliğiniz aktif değil. ${subscriptionFeeTl} TL/ay abonelik ile devam edebilirsiniz.`);
                    return;
                  }
                  setEditingProduct(null);
                  setFormData({
                    productId: '',
                    price: '',
                    unit: 'kg',
                    images: [],
                    imagePreviews: [],
                    locationId: '',
                    locationName: '',
                    coordinates: null,
                  });
                  setIsDialogOpen(true);
                }}
                aria-label="Yeni Ürün Ekle"
                className={`${primaryBg} text-white rounded-full p-2 shadow-sm inline-flex items-center justify-center`}
                disabled={!hasActiveSubscription || isCheckingSubscription}
              >
                <Plus className="w-5 h-5" />
              </Button>

              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  // Only allow closing if not submitting
                  if (!open && !isSubmitting) {
                    setIsDialogOpen(false);
                    setEditingProduct(null);
                    // Reset form when dialog closes
                    setFormData({
                      productId: '',
                      price: '',
                      unit: 'kg',
                      images: [],
                      imagePreviews: [],
                      locationId: '',
                      locationName: '',
                      coordinates: null,
                    });
                  } else if (open && isOwnShop) {
                    // Ensure available products are loaded when opening
                    loadAvailableProducts();
                  }
                }}
              >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
                    </DialogTitle>
                  </DialogHeader>
                  {/* (Progress modal is shown as a blocking overlay when saving) */}
                  <div className="space-y-4 mt-4">
                    {/* Product search for dialog */}
                    <div>
                      <Input
                        placeholder="Ürün ara"
                        value={formData.productId ? formData.productName : availableQuery}
                        onChange={(e) => {
                          if (formData.productId) {
                            // if a product is already selected, typing should clear selection and start a new search
                            setFormData({ ...formData, productId: '', productName: '' });
                            setAvailableQuery(e.target.value);
                          } else {
                            setAvailableQuery(e.target.value);
                          }
                        }}
                        className="mb-2"
                        readOnly={!!editingProduct}
                      />

                      {/* Dynamic suggestions list */}
                      {availableQuery && (
                        <div className="mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded shadow-sm">
                          {availableProducts && availableProducts.length > 0 ? (
                            availableProducts.slice(0, 8).map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setFormData({ ...formData, productId: p.id, productName: p.name });
                                  setAvailableQuery('');
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3"
                              >
                                <div className="w-8 h-8 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                                  {/* small thumbnail if available */}
                                  { (p as any).image ? <img src={(p as any).image} alt={p.name} className="w-full h-full object-cover" /> : null }
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{p.name}</div>
                                  <div className="text-xs text-gray-500">{p.category}</div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">Benzer ürün bulunamadı</div>
                          )}

                          {/* Create new product quick action */}
                          <div className="border-t border-gray-100 px-3 py-2">
                            <button
                              onClick={() => createNewProduct(availableQuery)}
                              disabled={isCreatingProduct}
                              className="w-full text-left text-sm text-green-600 hover:bg-green-50 px-2 py-2 rounded"
                            >
                              {isCreatingProduct ? 'Oluşturuluyor...' : ` "${availableQuery}" olarak yeni ürün oluştur`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Product is selected via the dynamic search suggestions above */}

                    {/* Price */}
                    <div>
                      <Label>Fiyat</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>

                    {/* Unit */}
                    <div>
                      <Label>Birim</Label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full mt-1 p-2 border rounded-md"
                      >
                        <option value="kg">kg</option>
                        <option value="adet">adet</option>
                        <option value="lt">lt</option>
                        <option value="paket">paket</option>
                      </select>
                    </div>

                    {/* Images */}
                    <div>
                      <Label>Resimler (Birden fazla seçebilirsiniz)</Label>
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2 flex-wrap">
                          {formData.imagePreviews.map((preview, index) => (
                            <div key={index} className="relative">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-20 h-20 object-cover rounded border"
                              />
                              <button
                                onClick={() => removeImage(index)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 z-10"
                                type="button"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-600">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleImageSelect(e.target.files)}
                            className="hidden"
                          />
                          <div className="text-center">
                            <ImageIcon className="w-8 h-8 mx-auto text-gray-400" />
                            <span className="text-sm text-gray-600 mt-2 block">
                              Resim Ekle
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <Label>Konum (Opsiyonel)</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={formData.locationName}
                          onChange={(e) => handleLocationTextChange(e.target.value)}
                          placeholder="Adres veya konum adı"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGetLocation}
                          disabled={isGettingLocation}
                        >
                          <MapPin className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1"
                      >
                        {isSubmitting ? 'Kaydediliyor...' : editingProduct ? 'Güncelle' : 'Ekle'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsDialogOpen(false);
                          setEditingProduct(null);
                        }}
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Button */}
      {!isOwnShop && getShopCoordinates() && (
        <div className="p-4 bg-white border-b border-gray-200">
          <Button
            onClick={handleNavigateToShop}
            className="w-full"
            variant="outline"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Dükkana Git
          </Button>
        </div>
      )}

      {isOwnShop && isMerchant && (
        <div className={`mx-3 sm:mx-4 mt-2 rounded-lg border px-4 py-3 text-sm ${hasActiveSubscription ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {isCheckingSubscription ? (
            <span>Abonelik durumu kontrol ediliyor...</span>
          ) : hasActiveSubscription ? (
            <span>
              Abonelik aktif ({subscriptionFeeTl} TL/ay)
              {subscriptionPeriodEnd ? ` - Bitiş: ${new Date(subscriptionPeriodEnd).toLocaleDateString('tr-TR')}` : ''}
            </span>
          ) : (
            <span>Abonelik pasif. Dükkan yönetimi için {subscriptionFeeTl} TL/ay abonelik gereklidir.</span>
          )}
        </div>
      )}

      {/* Products List */}
      <div
        className="p-3 sm:p-4 space-y-3 sm:space-y-4"
        style={{
          // Match content offset to the header height exactly and add a small gap so first card is clearly below the band
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px + 28px)',
          // Ensure content reaches down to bottom navigation bar
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
          // Let the page height be flexible but reserve space for header
          minHeight: 'calc(100vh - (env(safe-area-inset-top, 0px) + 56px))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          zIndex: 0,
        }}
      >
        {isLoading ? (
          // Render skeleton cards to reserve layout space and avoid content jump
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 overflow-hidden">
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex-shrink-0 w-20 sm:w-24">
                    <div className="w-full aspect-square bg-gray-200 rounded border animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-1/4 mb-4 animate-pulse" />
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-3 animate-pulse" />
                    <div className="flex gap-2 mt-3">
                      <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />
                      <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isOwnShop ? 'Henüz ürün eklenmemiş' : 'Bu dükkanda henüz ürün yok'}
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 overflow-hidden"
            >
              <div className="flex gap-2 sm:gap-3">
                {/* Images - Fixed width container */}
                <div className="flex-shrink-0 w-20 sm:w-24">
                      {product.images && product.images.length > 0 ? (
                    <div className="flex flex-col gap-1.5 sm:gap-2">
                      {product.images.slice(0, 2).map((img, idx) => (
                        <div key={idx} className="relative w-full aspect-square overflow-hidden rounded border">
                          <ProductImage
                            src={img}
                            alt={`${product.product.name} ${idx + 1}`}
                          />
                        </div>
                      ))}
                      {product.images.length > 2 && (
                        <div className="w-full aspect-square bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-500">
                          +{product.images.length - 2}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded border flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <h3 className="font-semibold text-sm sm:text-base truncate">{product.product.name}</h3>
                  <p className="text-xs text-gray-500 mb-1.5 truncate">{product.product.category}</p>
                  <div className="flex items-baseline gap-1.5 mb-1.5">
                    <span className="text-lg sm:text-xl font-bold text-green-600">
                      {product.price.toFixed(2)} ₺
                    </span>
                    <span className="text-xs text-gray-500">/ {product.unit}</span>
                  </div>

                  {/* Verification Counts */}
                  <div className="flex gap-2 sm:gap-3 text-xs mb-2">
                    <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{product.verification_count}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-600 flex-shrink-0">
                      <XCircle className="w-3 h-3" />
                      <span>{product.unverification_count}</span>
                    </div>
                  </div>

                  {/* Verify Button (only for non-owners) */}
                  {!isOwnShop && user && (
                    <div className="mt-3">
                      {userVerifications[product.id]?.is_verified ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerify(product.id, false)}
                          className={`w-full border-red-600 text-red-600 hover:bg-red-50`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Onayı Kaldır
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerify(product.id, true)}
                          className={`w-full ${outlinePrimary}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Onayla
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {isOwnShop && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(product)}
                        className={`flex-1 text-xs sm:text-sm ${outlinePrimary}`}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        <span>Düzenle</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        className={`flex-1 text-xs sm:text-sm ${outlinePrimary}`}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        <span>Sil</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

