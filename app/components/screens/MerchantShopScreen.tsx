import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Camera, Image as ImageIcon, X, MapPin, Navigation, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from 'sonner';
import { merchantProductsAPI, productsAPI, locationsAPI } from '../../services/supabase-api';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../../src/hooks/useGeolocation';
import { forwardGeocode } from '../../utils/geocoding';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

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

  const isOwnShop = merchantId === user?.id;

  useEffect(() => {
    if (merchantId) {
      loadMerchantProducts();
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

  const loadAvailableProducts = async () => {
    try {
      const data = await productsAPI.getAll();
      setAvailableProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
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
        setFormData({
          ...formData,
          coordinates: { lat: latitude, lng: longitude },
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

      // Upload images with timeout
      let imageUrls: string[] = [];
      if (formData.images.length > 0) {
        console.log('📤 Uploading images...', formData.images.length);
        try {
          const uploadPromise = uploadImages(formData.images);
          const timeoutPromise = new Promise<string[]>((_, reject) => 
            setTimeout(() => reject(new Error('Resim yükleme zaman aşımına uğradı')), 30000)
          );
          imageUrls = await Promise.race([uploadPromise, timeoutPromise]);
          console.log('✅ Images uploaded:', imageUrls.length);
        } catch (uploadError: any) {
          console.error('❌ Image upload error:', uploadError);
          toast.error(uploadError.message || 'Resim yükleme başarısız');
          // Continue without images if upload fails
        }
      }

      // Create or update product with timeout
      console.log('💾 Saving product...');
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
      
      await Promise.race([savePromise, timeoutPromise]);
      console.log('✅ Product saved successfully');

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
      const errorMessage = error.message || 'Bir hata oluştu';
      toast.error(errorMessage);
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
      console.log('✅ Submit process completed');
    }
  };

  const handleEdit = (product: MerchantProduct) => {
    setEditingProduct(product);
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

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 relative">
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
                    <select
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                      className="w-full mt-1 p-2 border rounded-md"
                      disabled={!!editingProduct}
                    >
                      <option value="">Ürün seçin</option>
                      {availableProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
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
                          <img
                            src={img}
                            alt={`${product.product.name} ${idx + 1}`}
                            className="w-full h-full object-cover"
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
          ))
        )}
      </div>
    </div>
  );
}

