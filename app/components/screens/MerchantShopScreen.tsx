import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Camera, Image as ImageIcon, X, MapPin, Navigation, CheckCircle2, XCircle, Search, Eye, Phone, Clock, Settings2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from 'sonner';
import { merchantProductsAPI, productsAPI, ensureMerchantSubscriptionActive, syncMerchantProductToPriceFeed, invalidateMerchantCaches } from '../../services/supabase-api';
import { useAuth } from '../../contexts/AuthContext';
import { forwardGeocode } from '../../utils/geocoding';
import { resolveCatalogProduct } from '../../lib/product-name';
import { readMerchantProfileFromUser, type MerchantProfileFields } from '../../lib/merchant-profile';
import ShopReviewsSection from '../ShopReviewsSection';
import { supabase, safeGetSession } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Capacitor } from '@capacitor/core';
import { pickImages } from '../../lib/native-image-picker';

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
  const [userVerifications, setUserVerifications] = useState<Record<string, { is_verified: boolean }>>({});
  const [isLoadingAvailableProducts, setIsLoadingAvailableProducts] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  /** null = sunucu araması yok; dizi = ilike sonucu (web’de 500 limitini aşmak için) */
  const [serverSearchResults, setServerSearchResults] = useState<Product[] | null>(null);
  const [isServerSearching, setIsServerSearching] = useState(false);
  const serverSearchSeq = useRef(0);
  const [shopProfile, setShopProfile] = useState<MerchantProfileFields | null>(null);

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

  const filteredProducts = useMemo(() => {
    return availableProducts.filter((p) => {
      if (!normalizedQuery) return true;
      const normalizedName = normalizeForSearch(p.name || '');
      const normalizedCategory = normalizeForSearch(p.category || '');
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedCategory.includes(normalizedQuery)
      );
    });
  }, [availableProducts, normalizedQuery]);

  /** 2+ karakter: sunucu ilike; yoksa yerel filtre (daha geniş liste) */
  const productsForList = useMemo(() => {
    const qTrim = productSearchQuery.trim();
    if (editingProduct) {
      const ep = editingProduct.product;
      if (ep?.id) {
        return [{ id: ep.id, name: ep.name, category: ep.category, image: ep.image }];
      }
      const one = availableProducts.find((p) => p.id === formData.productId);
      return one ? [one] : [];
    }
    if (qTrim.length >= 2) {
      if (isServerSearching) return [];
      if (serverSearchResults !== null) {
        const byId = new Map(serverSearchResults.map((p) => [p.id, p]));
        if (formData.productId && !byId.has(formData.productId)) {
          const sel = availableProducts.find((p) => p.id === formData.productId);
          if (sel) byId.set(sel.id, sel);
        }
        return Array.from(byId.values());
      }
    }
    return filteredProducts.slice(0, 150);
  }, [
    editingProduct,
    productSearchQuery,
    serverSearchResults,
    isServerSearching,
    filteredProducts,
    availableProducts,
    formData.productId,
  ]);

  // Sunucu tarafı ürün araması (tüm katalogda; limit=500 yalnızca ilk sayfayı getiriyordu)
  useEffect(() => {
    if (!isDialogOpen || editingProduct) {
      setServerSearchResults(null);
      setIsServerSearching(false);
      return;
    }
    const q = productSearchQuery.trim();
    if (q.length < 2) {
      setServerSearchResults(null);
      setIsServerSearching(false);
      return;
    }
    const safe = q.replace(/[%_\\]/g, ' ').replace(/[,()]/g, ' ').trim();
    if (safe.length < 2) {
      setServerSearchResults([]);
      setIsServerSearching(false);
      return;
    }

    const seq = ++serverSearchSeq.current;
    setIsServerSearching(true);
    setServerSearchResults(null);
    const t = window.setTimeout(async () => {
      try {
        const searchPromise = supabase
          .from('products')
          .select('id,name,category,image')
          .eq('is_active', true)
          .or(`name.ilike.%${safe}%,category.ilike.%${safe}%`)
          .order('name', { ascending: true })
          .limit(120);
        const { data, error } = await withTimeout(searchPromise, 8000, 'product-search');

        if (serverSearchSeq.current !== seq) return;
        if (error) throw error;
        setServerSearchResults(Array.isArray(data) ? (data as Product[]) : []);
      } catch (e) {
        console.warn('Server product search failed:', e);
        if (serverSearchSeq.current !== seq) return;
        // Fail open: typed name can still be saved as a new catalog product.
        setServerSearchResults([]);
      } finally {
        if (serverSearchSeq.current === seq) setIsServerSearching(false);
      }
    }, 320);
    return () => {
      clearTimeout(t);
      // Debounced timeout may never run; don't leave Ekle disabled.
      if (serverSearchSeq.current === seq) {
        setIsServerSearching(false);
      }
    };
  }, [productSearchQuery, isDialogOpen, editingProduct]);

  useEffect(() => {
    if (merchantId) {
      loadMerchantProducts();
      loadShopProfile();
    } else {
      setIsLoading(false);
    }
  }, [merchantId]);

  const loadShopProfile = async () => {
    if (!merchantId) return;
    try {
      if (isOwnShopById && user) {
        setShopProfile(readMerchantProfileFromUser(user));
      }
      const { data, error } = await supabase
        .from('users')
        .select('name, avatar, shop_logo, shop_phone, shop_whatsapp, shop_address, shop_description, shop_opening_hours, location, preferences')
        .eq('id', merchantId)
        .maybeSingle();
      if (error) {
        // Fallback if migration 046 not applied yet
        const legacy = await supabase
          .from('users')
          .select('name, avatar, location, preferences')
          .eq('id', merchantId)
          .maybeSingle();
        if (legacy.error) throw legacy.error;
        if (legacy.data) setShopProfile(readMerchantProfileFromUser(legacy.data));
        return;
      }
      if (data) setShopProfile(readMerchantProfileFromUser(data));
    } catch (e) {
      console.warn('Shop profile load failed:', e);
    }
  };

  useEffect(() => {
    if (isOwnShopById && user) {
      setShopProfile(readMerchantProfileFromUser(user));
    }
  }, [isOwnShopById, user]);

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

      // Sayfalı REST: tek istekte limit=500 yalnızca ilk alfabetik ürünleri getiriyordu (web’de eksik arama).
      const fetchPaged = async (): Promise<any[]> => {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        if (!sbUrl || !sbKey) return [];
        const pageSize = 1000;
        const maxRows = 8000;
        const merged: any[] = [];
        for (let offset = 0; offset < maxRows; offset += pageSize) {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 12000);
          try {
            const resp = await fetch(
              `${sbUrl}/rest/v1/products?select=id,name,category,image&is_active=eq.true&order=name.asc&limit=${pageSize}&offset=${offset}`,
              { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` }, signal: controller.signal },
            );
            clearTimeout(tid);
            if (!resp.ok) break;
            const rows = await resp.json();
            if (!Array.isArray(rows) || rows.length === 0) break;
            merged.push(...rows);
            if (rows.length < pageSize) break;
          } catch {
            clearTimeout(tid);
            break;
          }
        }
        return merged;
      };

      try {
        data = await fetchPaged();
      } catch (e) {
        console.warn('Paged REST product fetch failed:', e);
      }

      // Fallback: Supabase client (tek sayfa limit, yine de yedek)
      if (data.length === 0) {
        try {
          const { data: rows } = await withTimeout(
            supabase.from('products').select('id,name,category,image').eq('is_active', true).order('name', { ascending: true }).limit(2000),
            12000,
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

  const handleImageSelect = async (files: FileList | null) => {
    if (!files) return;

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      newFiles.push(file);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        newPreviews.push(dataUrl);
      } catch {
        newPreviews.push(URL.createObjectURL(file));
      }
    }

    setFormData((current) => ({
      ...current,
      images: newFiles.length ? [...current.images, ...newFiles] : current.images,
      imagePreviews: [...current.imagePreviews, ...newPreviews],
    }));
  };

  const handleNativeImagePick = async (source: 'camera' | 'gallery') => {
    try {
      const picked = await pickImages({
        source,
        multiple: source === 'gallery',
      });
      if (!picked.length) return;
      setFormData((current) => ({
        ...current,
        images: [...current.images, ...picked.map((p) => p.file)],
        imagePreviews: [...current.imagePreviews, ...picked.map((p) => p.previewUrl)],
      }));
      toast.success(picked.length > 1 ? `${picked.length} fotoğraf eklendi` : 'Fotoğraf eklendi');
    } catch (error: any) {
      console.error('Image pick error:', error);
      toast.error(error?.message || 'Fotoğraf seçilemedi');
    }
  };

  const removeImage = (index: number) => {
    const preview = formData.imagePreviews[index];
    const isRemote = typeof preview === 'string' && /^https?:\/\//i.test(preview);
    const newPreviews = formData.imagePreviews.filter((_, i) => i !== index);
    let newImages = formData.images;
    if (!isRemote && !(typeof preview === 'string' && preview.startsWith('data:'))) {
      // legacy blob: mapping by non-remote index
      let fileIdx = 0;
      for (let i = 0; i < index; i++) {
        const p = formData.imagePreviews[i];
        if (!(typeof p === 'string' && /^https?:\/\//i.test(p))) fileIdx += 1;
      }
      newImages = formData.images.filter((_, i) => i !== fileIdx);
      if (typeof preview === 'string' && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    } else if (!isRemote) {
      // data: preview — still drop matching file by non-remote index
      let fileIdx = 0;
      for (let i = 0; i < index; i++) {
        const p = formData.imagePreviews[i];
        if (!(typeof p === 'string' && /^https?:\/\//i.test(p))) fileIdx += 1;
      }
      newImages = formData.images.filter((_, i) => i !== fileIdx);
    }
    setFormData({
      ...formData,
      images: newImages,
      imagePreviews: newPreviews,
    });
  };

  const parseCoordinates = (coords: any): { lat: number; lng: number } | null => {
    if (!coords) return null;

    if (typeof coords === 'string') {
      const match = coords.match(/\(([^,]+),([^)]+)\)/);
      if (match) {
        return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
      }
    } else if (typeof coords === 'object') {
      if (coords.lat != null && coords.lng != null) {
        return { lat: Number(coords.lat), lng: Number(coords.lng) };
      }
      if (coords.x != null && coords.y != null) {
        return { lat: Number(coords.y), lng: Number(coords.x) };
      }
    }

    return null;
  };

  const buildShopAddressText = (): string => {
    const parts = [shopProfile?.address, shopProfile?.district, shopProfile?.city]
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    return parts.join(', ');
  };

  /** Use dükkan adresi — GPS/son ürün koordinatına göre değil, adrese göre pinle. */
  const resolveShopLocationForSave = async (): Promise<{
    locationId: string | null;
    coords: { lat: number; lng: number } | null;
  }> => {
    const existingLocationId =
      editingProduct?.location?.id ||
      products.find((p) => p.location?.id)?.location?.id ||
      null;

    const shopAddress = buildShopAddressText();
    const locationName =
      shopProfile?.shopName?.trim() ||
      user?.name?.trim() ||
      'Esnaf Dükkanı';

    // Prefer geocoded shop address so the map pin sits on Peri Sokak (etc.), not last GPS.
    let coords: { lat: number; lng: number } | null = null;
    if (shopAddress.length > 3) {
      try {
        const geocoded = await withTimeout(
          forwardGeocode(shopAddress),
          6000,
          'Dükkan adresi geocode zaman aşımı'
        );
        if (geocoded?.success && geocoded.coordinates) {
          coords = geocoded.coordinates;
        }
      } catch (geoErr) {
        console.warn('⚠️ Shop address geocode skipped:', geoErr);
      }
    }

    if (!coords) {
      coords =
        parseCoordinates(editingProduct?.coordinates || editingProduct?.location?.coordinates) ||
        (() => {
          for (const product of products) {
            const found = parseCoordinates(product.coordinates || product.location?.coordinates);
            if (found) return found;
          }
          return null;
        })() ||
        parseCoordinates(user?.location?.coordinates) ||
        null;
    }

    if (existingLocationId) {
      // Keep the same location row but refresh coordinates/address when we have better data.
      if (coords) {
        try {
          const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
          let token = resolveAuthTokenFast();
          if (!token) {
            const { accessToken } = await safeGetSession();
            token = accessToken || '';
          }
          if (sbUrl && sbKey && token) {
            await fetch(`${sbUrl}/rest/v1/locations?id=eq.${encodeURIComponent(existingLocationId)}`, {
              method: 'PATCH',
              headers: {
                apikey: sbKey,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                name: locationName,
                address: shopAddress || locationName,
                coordinates: `(${coords.lng},${coords.lat})`,
                city: shopProfile?.city || null,
                district: shopProfile?.district || null,
              }),
            });
          }
        } catch (patchErr) {
          console.warn('⚠️ Shop location coord refresh failed:', patchErr);
        }
      }
      return { locationId: existingLocationId, coords };
    }

    if (coords) {
      try {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        let token = resolveAuthTokenFast();
        if (!token) {
          const { accessToken } = await safeGetSession();
          token = accessToken || '';
        }
        if (sbUrl && sbKey && token) {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 8000);
          const resp = await fetch(`${sbUrl}/rest/v1/locations?select=id`, {
            method: 'POST',
            headers: {
              apikey: sbKey,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              name: locationName,
              type: 'market',
              address: shopAddress || locationName,
              coordinates: `(${coords.lng},${coords.lat})`,
              city: shopProfile?.city || null,
              district: shopProfile?.district || null,
            }),
            signal: controller.signal,
          });
          clearTimeout(tid);
          if (resp.ok) {
            const rows = await resp.json().catch(() => []);
            const id = Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : null;
            return { locationId: id, coords };
          }
          const body = await resp.text().catch(() => '');
          console.warn('⚠️ Shop location REST create failed:', resp.status, body.slice(0, 160));
        }
      } catch (locationCreateError) {
        console.warn('⚠️ Failed to create shop location:', locationCreateError);
      }
    }

    // Still return coords so syncMerchantProductToPriceFeed can create location itself.
    return { locationId: null, coords };
  };

  const normalizeImageList = (images: unknown): string[] => {
    const toPublicUrl = (u: string): string | null => {
      const value = u.trim();
      if (!value) return null;
      // Never persist Capacitor/local preview URLs — they only work on the picking device.
      if (
        /^blob:/i.test(value) ||
        /^data:/i.test(value) ||
        /^capacitor:/i.test(value) ||
        /^content:/i.test(value) ||
        /localhost|_capacitor_file_|127\.0\.0\.1/i.test(value)
      ) {
        return null;
      }
      if (/^https?:\/\//i.test(value)) return value;
      const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
      if (!sbUrl) return null;
      if (value.startsWith('/storage/')) return `${sbUrl}${value}`;
      if (value.includes('price-photos/')) {
        const path = value.replace(/^.*price-photos\//, '');
        return `${sbUrl}/storage/v1/object/public/price-photos/${path}`;
      }
      return null;
    };

    const dedupe = (urls: string[]) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const url of urls) {
        if (seen.has(url)) continue;
        seen.add(url);
        out.push(url);
      }
      return out;
    };

    if (Array.isArray(images)) {
      return dedupe(
        images
          .map((u) => (typeof u === 'string' ? toPublicUrl(u) : null))
          .filter((u): u is string => !!u)
      );
    }
    if (typeof images === 'string' && images.trim()) {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) return normalizeImageList(parsed);
      } catch {
        const single = toPublicUrl(images);
        if (single) return [single];
      }
    }
    return [];
  };

  const resolveAuthTokenFast = (): string => {
    try {
      const direct = localStorage.getItem('authToken');
      if (direct && direct.includes('.')) return direct;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (!(key.startsWith('sb-') && key.endsWith('-auth-token'))) continue;
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        if (parsed?.access_token && String(parsed.access_token).includes('.')) {
          return String(parsed.access_token);
        }
      }
    } catch {
      /* ignore */
    }
    return '';
  };

  const uploadImages = async (images: File[]): Promise<string[]> => {
    if (!user) throw new Error('User not authenticated');
    const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!sbUrl || !sbKey) throw new Error('Depolama ayarları eksik');

    let token = resolveAuthTokenFast();
    if (!token) {
      const { accessToken } = await safeGetSession();
      token = accessToken || '';
    }
    if (!token) throw new Error('Oturum bulunamadı — tekrar giriş yapın');

    // Sequential uploads — parallel POSTs often drop 2nd/3rd files on Android WebView.
    const batch = images.slice(0, 6);
    const uploaded: string[] = [];

    for (let i = 0; i < batch.length; i++) {
      const image = batch[i];
      if (!image) continue;

      const fileExt = (image.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 25000);

      try {
        let body: Blob;
        if (image instanceof Blob && image.size > 0) {
          body = image;
        } else {
          const buf = await (image as File).arrayBuffer();
          if (!buf.byteLength) {
            console.error(`Image upload skipped (empty): #${i + 1}`, image.name);
            clearTimeout(tid);
            continue;
          }
          body = new Blob([buf], { type: image.type || 'image/jpeg' });
        }

        console.log(`📤 Uploading image ${i + 1}/${batch.length}`, {
          name: image.name,
          size: body.size,
          type: body.type || image.type,
        });

        const resp = await fetch(`${sbUrl}/storage/v1/object/price-photos/${fileName}`, {
          method: 'POST',
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': body.type || image.type || 'image/jpeg',
            'x-upsert': 'true',
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(tid);

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => '');
          console.error(`Image upload REST error (#${i + 1}):`, resp.status, errBody.slice(0, 160));
          continue;
        }

        uploaded.push(`${sbUrl}/storage/v1/object/public/price-photos/${fileName}`);
      } catch (error) {
        clearTimeout(tid);
        console.error(`Failed to upload image #${i + 1}:`, error);
      }
    }

    return uploaded;
  };

  const isSubscriptionCheckTimeoutError = (error: unknown) => {
    const msg = String((error as any)?.message || error || '').toLocaleLowerCase('tr');
    return (
      msg.includes('abonelik') &&
      (msg.includes('zaman aşım') || msg.includes('zaman asim') || msg.includes('timeout') || msg.includes('time out'))
    );
  };

  const saveMerchantProductViaRest = async (
    imageUrls: string[],
    resolvedPrice: number,
    resolvedLocationId: string | null,
    resolvedProductId: string,
    resolvedCoords?: { lat: number; lng: number } | null
  ) => {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!sbUrl || !sbKey || !user) {
      throw new Error(`REST ayarlar eksik: url=${!!sbUrl} key=${!!sbKey} user=${!!user}`);
    }

    let accessToken = resolveAuthTokenFast();
    if (!accessToken) {
      const { accessToken: sessionToken } = await safeGetSession();
      accessToken = sessionToken || localStorage.getItem('authToken') || '';
    }
    if (!accessToken) {
      throw new Error('Oturum token bulunamadı - lütfen tekrar giriş yapın');
    }

    const headers: Record<string, string> = {
      apikey: sbKey,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    const coords = resolvedCoords || formData.coordinates;
    const fallbackImages = normalizeImageList(editingProduct?.images);
    const payload: any = {
      price: resolvedPrice,
      unit: formData.unit,
      // Always send a string[] so PostgREST stores jsonb correctly (not a raw string).
      images: imageUrls.length > 0 ? imageUrls : fallbackImages,
      location_id: resolvedLocationId,
      updated_at: new Date().toISOString(),
    };
    if (!editingProduct) {
      payload.merchant_id = user.id;
      payload.product_id = resolvedProductId;
    }
    if (coords) {
      payload.coordinates = `(${coords.lng},${coords.lat})`;
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

    invalidateMerchantCaches();
  };

  const handleSubmit = async () => {
    if (!user || !isOwnShop) {
      toast.error('Yetkiniz yok');
      return;
    }

    const typedProductName = productSearchQuery.trim();
    if ((!editingProduct && !formData.productId && !typedProductName) || !formData.price) {
      toast.error('Lütfen ürün ve fiyat bilgilerini girin');
      return;
    }

    const priceRaw = String(formData.price).replace(',', '.').trim();
    const priceNum = parseFloat(priceRaw);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('Geçerli bir fiyat girin');
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

      // Typed name may not be in catalog yet — match existing or create in products library.
      let resolvedProductId = formData.productId;
      if (!editingProduct) {
        const catalogProducts = Array.from(
          new Map(
            [...availableProducts, ...(serverSearchResults || [])].map((product) => [product.id, product])
          ).values()
        );
        const resolvedProduct = await resolveCatalogProduct({
          productId: formData.productId,
          productName: typedProductName,
          products: catalogProducts,
          defaultUnit: formData.unit,
          createProduct: productsAPI.create,
        });
        resolvedProductId = resolvedProduct.id;

        if (resolvedProduct.created) {
          const catalogProduct = {
            id: resolvedProduct.id,
            name: resolvedProduct.name,
            category: 'Diğer',
          };
          setAvailableProducts((current) => [catalogProduct, ...current]);
          setServerSearchResults((current) =>
            current
              ? [catalogProduct, ...current.filter((product) => product.id !== catalogProduct.id)]
              : current
          );
          setFormData((current) => ({ ...current, productId: resolvedProduct.id }));
          toast.success(`"${resolvedProduct.name}" ürün kataloğuna eklendi`);
        }
      }

      // Upload newly picked Files first; keep only real remote URLs from existing previews.
      // Capacitor preview URLs must never be saved.
      const existingRemoteUrls = normalizeImageList(formData.imagePreviews);
      let uploadedUrls: string[] = [];
      if (formData.images.length > 0) {
        console.log('📤 Uploading images...', formData.images.length, formData.images.map((f) => ({ name: f.name, size: f.size, type: f.type })));
        toast.info(`${formData.images.length} resim yükleniyor...`);
        try {
          uploadedUrls = await withTimeout(
            uploadImages(formData.images),
            Math.max(30000, formData.images.length * 20000),
            'Resim yükleme zaman asimi'
          );
          console.log('✅ Images uploaded:', uploadedUrls);
          if (uploadedUrls.length === 0) {
            toast.error('Resimler yüklenemedi. Lütfen tekrar deneyin.');
            setIsSubmitting(false);
            return;
          }
          if (uploadedUrls.length < formData.images.length) {
            toast.warning(
              `${uploadedUrls.length}/${formData.images.length} resim yüklendi. Eksik olanları tekrar ekleyebilirsiniz.`
            );
          }
        } catch (uploadError: any) {
          console.error('❌ Image upload error:', uploadError);
          toast.error(uploadError?.message || 'Resim yükleme başarısız');
          setIsSubmitting(false);
          return;
        }
      }
      // Prefer freshly uploaded public URLs; then keep prior remote URLs (deduped).
      const imageUrls = normalizeImageList([...uploadedUrls, ...existingRemoteUrls]);
      if (formData.images.length > 0 && imageUrls.length === 0) {
        toast.error('Resim URL oluşturulamadı. Lütfen tekrar deneyin.');
        setIsSubmitting(false);
        return;
      }

      // Dükkan adresini kullan — ürün formunda konum sormuyoruz.
      const shopLocation = await resolveShopLocationForSave();
      const resolvedLocationId = shopLocation.locationId;
      const resolvedCoords = shopLocation.coords;

      if (!resolvedLocationId && !resolvedCoords && !editingProduct) {
        // Adres doğrulanmasa bile sync fallback koordinatla akışa yazar.
        console.warn('⚠️ Shop address not geocoded; feed sync will use approximate location');
      }

      // Save product — subscription check with short timeout, then REST then API.
      console.log('💾 Saving product...');
      toast.info('Ürün kaydediliyor...');
      let saved = false;
      let lastError: any = null;

      try {
        await withTimeout(
          ensureMerchantSubscriptionActive(user.id),
          6000,
          'Abonelik kontrolu zaman asimi'
        );
      } catch (subErr: any) {
        if (isSubscriptionCheckTimeoutError(subErr)) {
          console.warn('⚠️ Subscription check timed out, continuing save attempt');
        } else {
          throw subErr;
        }
      }

      // Attempt 1: Direct REST (after subscription gate)
      try {
        await withTimeout(
          saveMerchantProductViaRest(
            imageUrls,
            priceNum,
            resolvedLocationId,
            resolvedProductId,
            resolvedCoords
          ),
          12000,
          'Urun kayit zaman asimi'
        );
        saved = true;
        console.log('✅ Product saved via direct REST');
      } catch (restErr: any) {
        lastError = restErr;
        console.warn('⚠️ Direct REST save failed:', restErr?.message);
      }

      // Attempt 2: merchantProductsAPI (has subscription check + Supabase fallback)
      if (!saved) {
        try {
          const savePromise = editingProduct
            ? merchantProductsAPI.update(editingProduct.id, {
                price: priceNum,
                unit: formData.unit,
                images: imageUrls.length > 0 ? imageUrls : normalizeImageList(editingProduct.images),
                location_id: resolvedLocationId || undefined,
                coordinates: resolvedCoords || undefined,
              })
            : merchantProductsAPI.create({
                merchant_id: user.id,
                product_id: resolvedProductId,
                price: priceNum,
                unit: formData.unit,
                images: imageUrls,
                location_id: resolvedLocationId || undefined,
                coordinates: resolvedCoords || undefined,
              });

          await withTimeout(savePromise, 12000, 'Urun kayit zaman asimi');
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

      // Mirror into Keşfet "son girilen" (prices table) — must succeed for feed visibility.
      const photoUrls =
        (Array.isArray(imageUrls) && imageUrls.length > 0
          ? imageUrls
          : editingProduct?.images
            ? normalizeImageList(editingProduct.images)
            : []) || [];
      const photoUrl = photoUrls[0] || null;
      const shopAddressText = buildShopAddressText();
      try {
        const syncResult = await withTimeout(
          syncMerchantProductToPriceFeed({
            merchantId: user.id,
            productId: resolvedProductId,
            price: priceNum,
            unit: formData.unit,
            locationId: resolvedLocationId,
            coordinates: resolvedCoords || null,
            photoUrl,
            photoUrls,
            locationName: shopProfile?.shopName || user.name || 'Esnaf Dükkanı',
            locationAddress: shopAddressText || null,
            city: shopProfile?.city || null,
            district: shopProfile?.district || null,
          }),
          15000,
          'Fiyat akışı senkron zaman aşımı'
        );
        if (!syncResult?.synced) {
          const reason = syncResult?.reason || 'unknown';
          console.warn('⚠️ Feed sync failed:', reason);
          toast.warning('Ürün kaydedildi ama Keşfet akışına yansımadı. Biraz sonra tekrar deneyin.');
        }
      } catch (syncErr: any) {
        console.warn('⚠️ Feed sync error:', syncErr);
        toast.warning('Ürün kaydedildi ama Keşfet akışına yansımadı.');
      }

      invalidateMerchantCaches();
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
      setIsDialogOpen(false);

      // Reload in background — don't block success UX
      void loadMerchantProducts();
      
      if (merchantId && location.pathname !== `/app/merchant-shop/${merchantId}`) {
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
    const existingImages = normalizeImageList(product.images);
    setFormData({
      productId: product.product.id,
      price: product.price.toString(),
      unit: product.unit,
      images: [],
      imagePreviews: existingImages,
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
        <div className="flex items-center justify-between p-4 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex items-center gap-2">
              {shopProfile?.logoUrl ? (
                <img
                  src={shopProfile.logoUrl}
                  alt=""
                  className="w-9 h-9 rounded-md object-cover border border-gray-200 shrink-0"
                />
              ) : null}
              <div className="min-w-0">
                <h1 className="text-xl font-bold truncate">
                  {shopProfile?.shopName || (isOwnShop ? user?.name : null) || 'Esnaf Dükkanı'}
                </h1>
                {(shopProfile?.city || shopProfile?.district) && (
                  <p className="text-xs text-gray-500 truncate">
                    {[shopProfile.district, shopProfile.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwnShop && (
              <Button
                variant="outline"
                size="icon"
                title="Esnaf bilgileri"
                onClick={() => navigate('/app/merchant-profile')}
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            )}
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
                          onChange={(e) => {
                            const nextName = e.target.value;
                            setProductSearchQuery(nextName);
                            if (!editingProduct && formData.productId) {
                              const selected = availableProducts.find(
                                (product) => product.id === formData.productId
                              );
                              if (
                                !selected ||
                                normalizeForSearch(selected.name) !== normalizeForSearch(nextName)
                              ) {
                                setFormData((current) => ({ ...current, productId: '' }));
                              }
                            }
                          }}
                          placeholder={editingProduct ? 'Ürün adı' : 'Ürün ara (örn: domates)'}
                          className="pl-9"
                          disabled={!!editingProduct}
                        />
                      </div>

                      <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200 p-2">
                        {isLoadingAvailableProducts || (productSearchQuery.trim().length >= 2 && isServerSearching) ? (
                          <div className="text-sm text-gray-500 p-2">Ürün listesi yükleniyor...</div>
                        ) : productsForList.length === 0 ? (
                          <div className="text-sm text-gray-500 p-2">
                            {productSearchQuery.trim().length >= 2
                              ? 'Aramanıza uygun ürün bulunamadı. Kaydedince yeni ürün olarak eklenecek.'
                              : 'Ürün bulunamadı'}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {productsForList.map((product) => {
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
                      {!editingProduct &&
                        productSearchQuery.trim() &&
                        !productsForList.some(
                          (product) =>
                            normalizeForSearch(product.name) === normalizeForSearch(productSearchQuery)
                        ) && (
                          <p className="text-sm text-green-700">
                            Bu isim katalogda yok. Kaydettiğinizde yeni ürün olarak eklenecek ve sonraki
                            aramalarda görünecek.
                          </p>
                        )}
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
                              className="w-20 h-20 object-cover rounded border bg-gray-50"
                              referrerPolicy="no-referrer"
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
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-24 flex-col gap-1"
                          onClick={() => handleNativeImagePick('camera')}
                        >
                          <Camera className="w-6 h-6 text-gray-500" />
                          <span className="text-xs text-gray-600">Kamera</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-24 flex-col gap-1"
                          onClick={() => handleNativeImagePick('gallery')}
                        >
                          <ImageIcon className="w-6 h-6 text-gray-500" />
                          <span className="text-xs text-gray-600">Galeri</span>
                        </Button>
                      </div>
                      {!Capacitor.isNativePlatform() && (
                        <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-600">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleImageSelect(e.target.files)}
                            className="hidden"
                          />
                          <div className="text-center">
                            <ImageIcon className="w-6 h-6 mx-auto text-gray-400" />
                            <span className="text-xs text-gray-600 mt-1 block">Dosyadan ekle</span>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSubmit}
                      disabled={
                        isSubmitting ||
                        !String(formData.price || '').trim() ||
                        (!editingProduct &&
                          !formData.productId &&
                          !productSearchQuery.trim())
                      }
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
        {shopProfile &&
          (shopProfile.description ||
            shopProfile.address ||
            shopProfile.phone ||
            shopProfile.openingHours) && (
          <div className="px-4 pb-3 space-y-1.5 text-sm text-gray-600">
            {shopProfile.description && (
              <p className="text-gray-700">{shopProfile.description}</p>
            )}
            {shopProfile.address && (
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                <span>
                  {shopProfile.address}
                  {(shopProfile.district || shopProfile.city) &&
                    ` · ${[shopProfile.district, shopProfile.city].filter(Boolean).join(', ')}`}
                </span>
              </p>
            )}
            {shopProfile.phone && (
              <a
                href={`tel:${shopProfile.phone.replace(/\s+/g, '')}`}
                className="flex items-center gap-1.5 text-blue-700"
              >
                <Phone className="w-3.5 h-3.5" />
                {shopProfile.phone}
              </a>
            )}
            {shopProfile.openingHours && (
              <p className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {shopProfile.openingHours}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">

      {/* ⭐ Dükkan değerlendirmeleri (yıldız + yorum) */}
      <ShopReviewsSection
        merchantId={merchantId || ''}
        userId={user?.id || null}
        isOwnShop={!!isOwnShopById}
      />

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
            const productImages = normalizeImageList(product.images);
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
                      {productImages.slice(0, 4).map((img, idx) => (
                        <div key={idx} className="relative w-full aspect-square overflow-hidden rounded border">
                          <img
                            src={img}
                            alt={`${productName} ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                      {productImages.length > 4 && (
                        <div className="w-full aspect-square bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-500">
                          +{productImages.length - 4}
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

