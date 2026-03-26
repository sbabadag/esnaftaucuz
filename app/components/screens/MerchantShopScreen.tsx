import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Camera, Image as ImageIcon, X, MapPin, Navigation, CheckCircle2, XCircle, Search, Eye } from 'lucide-react';
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
import { supabase, safeGetSession } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Capacitor } from '@capacitor/core';

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
  image?: string;
}

export default function MerchantShopScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { merchantId } = useParams<{ merchantId: string }>();
  const { user } = useAuth();
  const { getCurrentPosition } = useGeolocation();
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MerchantProduct | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState({
    productId: '',
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
  const [isLoadingAvailableProducts, setIsLoadingAvailableProducts] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const isOwnShopById = merchantId === user?.id;
  const isMerchantOnboardingPending = (() => {
    try {
      return !!user?.id && localStorage.getItem('merchant-subscription-onboarding-user') === user.id;
    } catch {
      return false;
    }
  })();
  const isOwnShop = isOwnShopById && !isMerchantOnboardingPending;
  const isNativePlatform = Capacitor.isNativePlatform();
  const headerTopOffsetPx = isNativePlatform ? 14 : 0;
  const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
    ]);

  const normalizeForSearch = (value: string) =>
    (value || '')
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizedQuery = normalizeForSearch(productSearchQuery);
  const filteredProducts = availableProducts
    .filter((p) => {
      if (!normalizedQuery) return true;
      const normalizedName = normalizeForSearch(p.name || '');
      const normalizedCategory = normalizeForSearch(p.category || '');
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedCategory.includes(normalizedQuery)
      );
    })
    .slice(0, 40);

  useEffect(() => {
    if (merchantId) {
      loadMerchantProducts();
    } else {
      setIsLoading(false);
    }
  }, [merchantId]);

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

  useEffect(() => {
    if (!isOwnShop) return;
    if (searchParams.get('openAdd') !== '1') return;
    setEditingProduct(null);
    setProductSearchQuery('');
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
    if (merchantId) {
      navigate(`/app/merchant-shop/${merchantId}`, { replace: true });
    }
  }, [isOwnShop, merchantId, navigate, searchParams]);

  const loadMerchantProducts = async () => {
    let isCompleted = false;
    const hardTimeout = window.setTimeout(() => {
      if (isCompleted) return;
      setProducts([]);
      setIsLoading(false);
      toast.error('Dükkan verileri alınamadı (zaman aşımı).');
    }, 12000);

    try {
      setIsLoading(true);
      const rows = await withTimeout(
        merchantProductsAPI.getByMerchant(merchantId!),
        10000,
        'merchant products'
      );
      if (isCompleted) return;
      setProducts(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      if (isCompleted) return;
      console.error('Failed to load merchant products:', error);
      
      setProducts([]);
      toast.error('Ürünler yüklenirken bir hata oluştu');
    } finally {
      isCompleted = true;
      window.clearTimeout(hardTimeout);
      setIsLoading(false);
    }
  };

  const loadAvailableProducts = async () => {
    setIsLoadingAvailableProducts(true);
    try {
      let data: any[] = [];

      // Direct REST fetch (fastest, bypasses cachedQuery)
      try {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        if (sbUrl && sbKey) {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 8000);
          const resp = await fetch(
            `${sbUrl}/rest/v1/products?select=id,name,category,image&is_active=eq.true&order=name.asc&limit=500`,
            { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` }, signal: controller.signal },
          );
          clearTimeout(tid);
          if (resp.ok) {
            const rows = await resp.json();
            if (Array.isArray(rows)) data = rows;
          }
        }
      } catch (e) {
        console.warn('Direct REST product fetch failed:', e);
      }

      // Fallback: Supabase client with timeout
      if (data.length === 0) {
        try {
          const { data: rows } = await withTimeout(
            supabase.from('products').select('id,name,category,image').eq('is_active', true).order('name', { ascending: true }).limit(500),
            8000,
            'Ürün listesi zaman aşımı',
          );
          if (Array.isArray(rows)) data = rows;
        } catch (e) {
          console.warn('Supabase client product fetch failed:', e);
        }
      }

      // Fallback: localStorage cache
      if (data.length === 0) {
        for (const key of [`products-search-index:${user?.id || 'anon'}`, 'products-search-index:anon']) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) { data = parsed; break; }
          } catch { /* ignore */ }
        }
      }

      setAvailableProducts(data);
      if (data.length === 0) {
        toast.error('Ürün listesi boş veya yüklenemedi');
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Ürün listesi yüklenemedi');
    } finally {
      setIsLoadingAvailableProducts(false);
    }
  };

  const loadUserVerifications = async () => {
    if (!user) return;
    
    try {
      const productIds = (products || []).map((p) => p.id).filter(Boolean);
      if (productIds.length === 0) {
        setUserVerifications({});
        return;
      }

      const { data, error } = await withTimeout(
        supabase
          .from('merchant_product_verifications')
          .select('merchant_product_id, is_verified')
          .eq('user_id', user.id)
          .in('merchant_product_id', productIds),
        8000,
        'merchant verification'
      );
      if (error) throw error;

      const verifications: Record<string, { is_verified: boolean }> = {};
      (data || []).forEach((row: any) => {
        if (row?.merchant_product_id) {
          verifications[row.merchant_product_id] = { is_verified: row.is_verified === true };
        }
      });
      
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
      toast.info('Konum alınıyor...');
      const position = await getCurrentPosition();
      
      if (position) {
        const { latitude, longitude } = position;
        setFormData((prev) => ({
          ...prev,
          coordinates: { lat: latitude, lng: longitude },
        }));

        const geo = await reverseGeocode(latitude, longitude);
        if (geo.success && geo.address) {
          setFormData((prev) => ({
            ...prev,
            locationName: geo.address!,
          }));
          toast.success(`Konum: ${geo.address}`);
        } else {
          setFormData((prev) => ({
            ...prev,
            locationName: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          }));
          toast.success('Konum alındı');
        }
      } else {
        toast.error('Konum alınamadı. Konum izni verildiğinden emin olun.');
      }
    } catch (error: any) {
      console.error('Location error:', error);
      toast.error(error?.message || 'Konum alınamadı');
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

  const uploadImages = async (images: File[]): Promise<string[]> => {
    if (!user) throw new Error('User not authenticated');
    
    const uploadedUrls: string[] = [];
    
    for (const image of images) {
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
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('price-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Failed to upload image:', error);
      }
    }
    
    return uploadedUrls;
  };

  const isSubscriptionCheckTimeoutError = (error: unknown) => {
    const msg = String((error as any)?.message || error || '').toLocaleLowerCase('tr');
    return (
      msg.includes('abonelik') &&
      (msg.includes('zaman aşım') || msg.includes('zaman asim') || msg.includes('timeout') || msg.includes('time out'))
    );
  };

  const saveMerchantProductViaRest = async (imageUrls: string[]) => {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!sbUrl || !sbKey || !user) {
      throw new Error(`REST ayarlar eksik: url=${!!sbUrl} key=${!!sbKey} user=${!!user}`);
    }

    const { accessToken: sessionToken } = await safeGetSession();
    const accessToken = sessionToken || localStorage.getItem('authToken');
    if (!accessToken) {
      throw new Error('Oturum token bulunamadı - lütfen tekrar giriş yapın');
    }

    const headers: Record<string, string> = {
      apikey: sbKey,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    const payload: any = {
      price: parseFloat(formData.price),
      unit: formData.unit,
      images: imageUrls.length > 0 ? imageUrls : (editingProduct?.images || []),
      location_id: formData.locationId || null,
      updated_at: new Date().toISOString(),
    };
    if (!editingProduct) {
      payload.merchant_id = user.id;
      payload.product_id = formData.productId;
    }
    if (formData.coordinates) {
      payload.coordinates = `(${formData.coordinates.lng},${formData.coordinates.lat})`;
    }

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 20000);
    const url = editingProduct
      ? `${sbUrl}/rest/v1/merchant_products?id=eq.${editingProduct.id}`
      : `${sbUrl}/rest/v1/merchant_products?on_conflict=merchant_id,product_id`;
    const method = editingProduct ? 'PATCH' : 'POST';
    const prefer = editingProduct ? 'return=representation' : 'resolution=merge-duplicates,return=representation';

    const resp = await fetch(url, {
      method,
      headers: { ...headers, Prefer: prefer },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`REST ${resp.status}: ${body.substring(0, 200) || 'Kayıt başarısız'}`);
    }
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

    try {
      setIsSubmitting(true);
      console.log('🔄 Starting product submit...', { editingProduct: !!editingProduct });

      // Ensure session is fresh to avoid auth redirects
      try {
        const { accessToken } = await safeGetSession();
        if (!accessToken) {
          await supabase.auth.refreshSession();
        }
      } catch (sessionErr) {
        console.warn('⚠️ Session refresh before submit:', sessionErr);
      }

      // Upload images with timeout
      let imageUrls: string[] = [];
      if (formData.images.length > 0) {
        console.log('📤 Uploading images...', formData.images.length);
        try {
          const uploadPromise = uploadImages(formData.images);
          const timeoutPromise = new Promise<string[]>((_, reject) => 
            setTimeout(() => reject(new Error('Resim yükleme zaman aşımına uğradı')), 60000)
          );
          imageUrls = await Promise.race([uploadPromise, timeoutPromise]);
          console.log('✅ Images uploaded:', imageUrls.length);
        } catch (uploadError: any) {
          console.error('❌ Image upload error:', uploadError);
          toast.error(uploadError.message || 'Resim yükleme başarısız');
          // Continue without images if upload fails
        }
      }

      // Save product — try direct REST first (fastest, most reliable on mobile),
      // then fall back to merchantProductsAPI which includes subscription check.
      console.log('💾 Saving product...');
      toast.info('Ürün kaydediliyor...');
      let saved = false;
      let lastError: any = null;

      // Attempt 1: Direct REST (bypasses subscription check + Supabase client)
      try {
        await saveMerchantProductViaRest(imageUrls);
        saved = true;
        console.log('✅ Product saved via direct REST');
      } catch (restErr: any) {
        lastError = restErr;
        console.warn('⚠️ Direct REST save failed:', restErr?.message);
        // Silent fallback to attempt 2
      }

      // Attempt 2: merchantProductsAPI (has subscription check + Supabase fallback)
      if (!saved) {
        try {
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
            setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı')), 30000)
          );

          await Promise.race([savePromise, timeoutPromise]);
          saved = true;
          console.log('✅ Product saved via merchantProductsAPI');
        } catch (apiErr: any) {
          lastError = apiErr;
          console.error('❌ merchantProductsAPI save failed:', apiErr?.message);
        }
      }

      if (!saved) {
        throw lastError || new Error('Ürün kaydedilemedi');
      }

      toast.success(editingProduct ? 'Ürün güncellendi' : 'Ürün eklendi');

      // Reset form
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
      setProductSearchQuery('');
      setEditingProduct(null);
      
      // Reload products first (with error handling)
      try {
        await loadMerchantProducts();
      } catch (reloadError) {
        console.error('⚠️ Failed to reload products:', reloadError);
        // Don't show error to user - product was saved successfully
      }
      
      // Close dialog after reload
      setIsDialogOpen(false);
      
      // Ensure we stay on merchant-shop page (prevent any unwanted navigation)
      // Use replace: true to prevent back navigation issues
      if (merchantId && location.pathname !== `/app/merchant-shop/${merchantId}`) {
        console.log('🔄 Ensuring we stay on merchant-shop page');
        navigate(`/app/merchant-shop/${merchantId}`, { replace: true });
      }
    } catch (error: any) {
      console.error('❌ Submit error:', error);
      const errorMessage = error?.message || 'Bir hata oluştu';
      toast.error('Ürün kaydedilemedi. Lütfen tekrar deneyin.', { duration: 5000 });
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
      console.log('✅ Submit process completed');
    }
  };

  const handleEdit = (product: MerchantProduct) => {
    setEditingProduct(product);
    setProductSearchQuery(product.product?.name || '');
    setFormData({
      productId: product.product.id,
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

  const handleInspectProduct = async (merchantProduct: MerchantProduct) => {
    const productId = merchantProduct?.product?.id;
    if (!productId || !merchantId) return;

    await merchantProductsAPI.trackClick({
      merchant_product_id: merchantProduct.id,
      merchant_id: merchantId,
      product_id: productId,
      viewer_user_id: user?.id,
    });

    navigate(`/app/product/${productId}`);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50" style={{ top: `calc(env(safe-area-inset-top, 0px) + ${headerTopOffsetPx}px)` }}>
      {/* Header - sits in flex column, never scrolls */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
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
          {isOwnShop && (
            <Dialog 
              open={isDialogOpen} 
              onOpenChange={(open) => {
                if (open) {
                  setIsDialogOpen(true);
                } else if (!isSubmitting) {
                  setIsDialogOpen(false);
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
                  setProductSearchQuery('');
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => {
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
                  setProductSearchQuery('');
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ürün Ekle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {/* Product Selection */}
                  <div>
                    <Label>Ürün</Label>
                    <div className="mt-1 space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          placeholder={editingProduct ? 'Ürün adı' : 'Ürün ara (örn: domates)'}
                          className="pl-9"
                          disabled={!!editingProduct}
                        />
                      </div>

                      <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200 p-2">
                        {isLoadingAvailableProducts ? (
                          <div className="text-sm text-gray-500 p-2">Ürün listesi yükleniyor...</div>
                        ) : filteredProducts.length === 0 ? (
                          <div className="text-sm text-gray-500 p-2">Ürün bulunamadı</div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {filteredProducts.map((product) => {
                              const isSelected = formData.productId === product.id;
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  disabled={!!editingProduct}
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, productId: product.id }));
                                    setProductSearchQuery(product.name || '');
                                  }}
                                  className={`text-left rounded-md border p-2 transition ${
                                    isSelected
                                      ? 'border-green-600 bg-green-50'
                                      : 'border-gray-200 bg-white hover:border-green-400'
                                  } ${editingProduct ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                  <div className="w-full h-16 rounded mb-2 bg-gray-100 overflow-hidden flex items-center justify-center">
                                    {product.image ? (
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    ) : (
                                      <ImageIcon className="w-5 h-5 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="text-xs font-medium text-gray-900 truncate">{product.name}</div>
                                  <div className="text-[11px] text-gray-500 truncate">{product.category}</div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

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
          )}
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">

      {isOwnShopById && isMerchantOnboardingPending && (
        <div className="mx-4 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Abonelik baslatilana kadar dukkani sadece goruntuleyebilirsiniz. Urun ekleme, duzenleme ve silme kapatildi.
        </div>
      )}

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

      {/* Products List */}
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 pb-20">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isOwnShop ? 'Henüz ürün eklenmemiş' : 'Bu dükkanda henüz ürün yok'}
          </div>
        ) : (
          products.map((product) => {
            const productName = product.product?.name || 'Ürün';
            const productCategory = product.product?.category || 'Diğer';
            const productPrice = typeof product.price === 'number'
              ? product.price
              : Number(product.price) || 0;
            const productImages = Array.isArray(product.images) ? product.images : [];
            return (
            <div
              key={product.id}
              className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 overflow-hidden"
            >
              <div className="flex gap-2 sm:gap-3">
                {/* Images - Fixed width container */}
                <div className="flex-shrink-0 w-20 sm:w-24">
                  {productImages.length > 0 ? (
                    <div className="flex flex-col gap-1.5 sm:gap-2">
                      {productImages.slice(0, 2).map((img, idx) => (
                        <div key={idx} className="relative w-full aspect-square overflow-hidden rounded border">
                          <img
                            src={img}
                            alt={`${productName} ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ))}
                      {productImages.length > 2 && (
                        <div className="w-full aspect-square bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-500">
                          +{productImages.length - 2}
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
                  <h3 className="font-semibold text-sm sm:text-base truncate">{productName}</h3>
                  <p className="text-xs text-gray-500 mb-1.5 truncate">{productCategory}</p>
                  <div className="flex items-baseline gap-1.5 mb-1.5">
                    <span className="text-lg sm:text-xl font-bold text-green-600">
                      {productPrice.toFixed(2)} ₺
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
                  {!isOwnShopById && user && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInspectProduct(product)}
                        className="w-full mb-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ürünü İncele
                      </Button>
                      {userVerifications[product.id]?.is_verified ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerify(product.id, false)}
                          className="w-full border-red-600 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Onayı Kaldır
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerify(product.id, true)}
                          className="w-full border-green-600 text-green-600 hover:bg-green-50"
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
                        className="flex-1 text-xs sm:text-sm"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        <span>Düzenle</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        className="flex-1 text-xs sm:text-sm"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        <span>Sil</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
      </div>{/* end scrollable content */}
    </div>
  );
}

