import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Navigation } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../ui/sheet';
import { Button } from '../../ui/button';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { merchantProductsAPI, pricesAPI } from '../../../services/supabase-api';
import { useGeolocation } from '../../../../src/hooks/useGeolocation';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';
import { searchNearbyPlaces } from '../../../utils/places';
import { isWeb } from '../../../../src/utils/capacitor';
import { normalizePriceCoordinates, parseLatLng } from '../../../lib/price-coordinates';
import { geocodeMerchantShopAddress } from '../../../lib/merchant-shop-coords';
import { calculateDistanceKm } from '../../../lib/shopping-list';

/** Cached once — recreating L.icon on every React render was costly. */
const userLocationIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Cache marker icons to prevent recreation (performance optimization)
const priceIconCache = new Map<string, L.DivIcon>();
const businessIconCache = new Map<string, L.DivIcon>();

const escapeHtmlAttr = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');

/** One pin per shared consumer location — shows how many reports. */
const createLocationClusterIcon = (count: number) => {
  const label = count > 99 ? '99+' : String(Math.max(1, count));
  if (priceIconCache.has(`loc:${label}`)) {
    return priceIconCache.get(`loc:${label}`)!;
  }

  const icon = L.divIcon({
    className: 'custom-location-marker',
    html: `
      <div style="
        background: #16a34a;
        color: white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 13px;
        border: 2px solid white;
        cursor: pointer;
        will-change: transform;
      ">${label}</div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });

  priceIconCache.set(`loc:${label}`, icon);
  return icon;
};

/** Circular shop pin using merchant logo (fallback: initial). */
const createShopLogoIcon = (logoUrl: string | null | undefined, title: string) => {
  const safeUrl =
    logoUrl && /^https?:\/\//i.test(String(logoUrl).trim()) ? String(logoUrl).trim() : null;
  const initial = (title || 'E').trim().charAt(0).toUpperCase() || 'E';
  const cacheKey = `shop-logo:${safeUrl || ''}:${initial}`;
  if (businessIconCache.has(cacheKey)) {
    return businessIconCache.get(cacheKey)!;
  }

  const inner = safeUrl
    ? `<img src="${escapeHtmlAttr(safeUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" referrerpolicy="no-referrer" />`
    : `<span style="font-size:18px;font-weight:700;color:#1d4ed8;line-height:1">${escapeHtmlAttr(initial)}</span>`;

  const icon = L.divIcon({
    className: 'custom-shop-logo-marker',
    html: `
      <div style="
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid #2563eb;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        will-change: transform;
      ">${inner}</div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });

  businessIconCache.set(cacheKey, icon);
  return icon;
};

type MapPin = {
  id: string;
  lat: number;
  lng: number;
  kind: 'shop' | 'location';
  title: string;
  subtitle?: string;
  label: string;
  items: any[];
  logoUrl?: string | null;
  merchantId?: string;
};

const consumerLocationKey = (price: any): string => {
  const locId = price.location_id || price.location?.id;
  if (locId) return `loc:${locId}`;
  const lat = Number(price.lat);
  const lng = Number(price.lng);
  // ~100m grid — same spot shares one pin
  return `geo:${lat.toFixed(3)},${lng.toFixed(3)}`;
};

// Custom marker icon for Google Places businesses (cached, single instance)
const createBusinessIcon = () => {
  const cacheKey = 'business-icon';
  if (businessIconCache.has(cacheKey)) {
    return businessIconCache.get(cacheKey)!;
  }

  const icon = L.divIcon({
    className: 'custom-business-marker',
    html: `
      <div style="
        background: #3b82f6;
        color: white;
        border-radius: 8px;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
        border: 2px solid white;
        cursor: pointer;
        will-change: transform;
      ">
        🏪
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });

  businessIconCache.set(cacheKey, icon);
  return icon;
};

// Component to center map on user location
function MapCenter({
  center,
  zoom,
  suspend,
}: {
  center: [number, number];
  zoom?: number;
  /** When true (shop fit active), don't snap away from shop pins. */
  suspend?: boolean;
}) {
  const map = useMap();
  const prevCenterRef = useRef<[number, number] | null>(null);
  const prevZoomRef = useRef<number | undefined>(undefined);
  
  useEffect(() => {
    try {
      if (suspend) return;
      // Validate center coordinates
      if (!center || !Array.isArray(center) || center.length !== 2) {
        console.error('❌ Invalid center coordinates:', center);
        return;
      }
      
      const [lat, lng] = center;
      
      // Validate lat/lng are valid numbers
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        console.error('❌ Invalid lat/lng values:', { lat, lng });
        return;
      }
      
      // Validate lat/lng are within valid ranges
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.error('❌ Coordinates out of range:', { lat, lng });
        return;
      }
      
      // Check if center or zoom actually changed
      const centerChanged = !prevCenterRef.current || 
        prevCenterRef.current[0] !== lat || 
        prevCenterRef.current[1] !== lng;
      const zoomChanged = zoom !== undefined && zoom !== prevZoomRef.current;
      
      if (centerChanged || zoomChanged) {
        console.log('🗺️ MapCenter updating:', { 
          lat, 
          lng, 
          zoom, 
          currentZoom: map.getZoom(),
          centerChanged,
          zoomChanged,
        });
        
        try {
          // Instant recenter — animated pans feel laggy on Android WebView
          const animateOptions = { animate: false };
          
          if (zoom !== undefined && zoom >= 0 && zoom <= 20) {
            map.setView([lat, lng], zoom, animateOptions);
            prevZoomRef.current = zoom;
          } else {
            const currentZoom = map.getZoom();
            if (currentZoom >= 0 && currentZoom <= 20) {
              map.setView([lat, lng], currentZoom, animateOptions);
            } else {
              map.setView([lat, lng], 13, animateOptions);
            }
          }
          
          prevCenterRef.current = [lat, lng];
        } catch (setViewError: any) {
          console.error('❌ Error setting map view:', setViewError);
        }
      }
    } catch (error: any) {
      console.error('❌ MapCenter error:', error);
    }
  }, [center, zoom, map, suspend]);
  return null;
}

/** Pull nearby esnaf shop pins into view (Meram etc. were off-screen at zoom 15). */
function FitMapToShopPins({
  shopPins,
  userLocation,
  onFitted,
}: {
  shopPins: MapPin[];
  userLocation: [number, number] | null;
  onFitted?: () => void;
}) {
  const map = useMap();
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!shopPins.length) return;
    const key = `${shopPins.length}:${userLocation?.[0] ?? ''},${userLocation?.[1] ?? ''}:${shopPins.map((p) => p.id).join(',')}`;
    if (lastKeyRef.current === key) return;

    try {
      const origin = userLocation
        ? { lat: userLocation[0], lng: userLocation[1] }
        : null;
      const nearby = origin
        ? shopPins.filter(
            (s) => calculateDistanceKm(origin, { lat: s.lat, lng: s.lng }) <= 30
          )
        : shopPins;
      const usePins = nearby.length > 0 ? nearby : shopPins;
      const bounds = L.latLngBounds(usePins.map((p) => [p.lat, p.lng] as [number, number]));
      if (userLocation) bounds.extend(userLocation);
      map.fitBounds(bounds, {
        padding: [56, 56],
        maxZoom: 15,
        animate: false,
      });
      lastKeyRef.current = key;
      onFitted?.();
      console.log('🗺️ Fitted map to shop pins:', usePins.map((p) => p.title));
    } catch (err) {
      console.warn('FitMapToShopPins failed:', err);
    }
  }, [shopPins, userLocation, map, onFitted]);

  return null;
}

// Component to handle auto-opening popups (LIMITED for performance, disabled on web)
function AutoOpenPopups({ 
  prices, 
  markerRefs, 
  mapRef 
}: { 
  prices: Price[]; 
  markerRefs: React.MutableRefObject<Record<string, any>>;
  mapRef: React.MutableRefObject<L.Map | null>;
}) {
  const map = useMap();
  const isWebPlatform = isWeb();
  
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current = map;
    }
  }, [map, mapRef]);

  useEffect(() => {
    // DISABLED: Auto-open popups cause ANR on mobile
    // Users can manually click markers to see popups
    // This significantly improves performance and prevents ANR
    return;
  }, [prices, markerRefs, isWebPlatform]);

  return null;
}

interface Price {
  id?: string;
  _id?: string;
  product: {
    id?: string;
    _id?: string;
    name: string;
    category: string;
    defaultUnit?: string;
    default_unit?: string;
    image?: string;
  };
  price: number;
  unit: string;
  location: {
    id?: string;
    _id?: string;
    name: string;
    type: string;
    city: string;
    district: string;
    coordinates?: { lat: number; lng: number; x?: number; y?: number };
  };
  isVerified?: boolean;
  is_verified?: boolean;
  photo?: string;
  createdAt?: string;
  created_at?: string;
  user?: {
    name: string;
    avatar?: string;
  };
  lat?: number;
  lng?: number;
}

interface Business {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now?: boolean;
  };
}

export default function MapScreen() {
  const navigate = useNavigate();
  const { getCurrentPosition } = useGeolocation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [productPhotos, setProductPhotos] = useState<Price[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false);
  const [showBusinesses, setShowBusinesses] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.8667, 32.4833]); // Default: Konya
  const [mapZoom, setMapZoom] = useState(13);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [shopsFitted, setShopsFitted] = useState(false);
  const markerRefs = useRef<Record<string, any>>({});
  const mapRef = useRef<L.Map | null>(null);
  const hasFocusFromURL = useRef(false); // Track if we have focus coordinates from URL
  const focusedLocationRef = useRef<[number, number] | null>(null); // Store focused location coordinates
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const sheetOpenRef = useRef(false);

  // Alt panel (sheet) açıklık durumunu ref'e yansıt — backButton listener'ı her render'da yeniden kurulmasın.
  useEffect(() => {
    sheetOpenRef.current = !!(selectedPin || selectedPrice);
  }, [selectedPin, selectedPrice]);

  // Android: harita kaydırırken ekran kenarından gelen back-gesture'ı WebView geçmişini
  // geri alıp kullanıcıyı ana sayfaya (explore) fırlatıyordu. Harita açıkken back'i yakala:
  // açık panel varsa paneli kapat; yoksa uygulamayı minimize etmeyi dene (API < 34'te yut).
  useEffect(() => {
    try {
      if (Capacitor.getPlatform() !== 'android') return;
    } catch {
      return;
    }
    let handle: { remove: () => void } | null = null;
    CapacitorApp.addListener('backButton', () => {
      if (sheetOpenRef.current) {
        setSelectedPin(null);
        setSelectedPrice(null);
        return;
      }
      try {
        CapacitorApp.minimizeApp();
      } catch {
        // minimizeApp desteklenmiyorsa hiçbir şey yapma — haritada kal.
      }
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => {
        /* listener kurulamadıysa varsayılan davranışa dokunma */
      });
    return () => {
      try {
        handle?.remove();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // State for filtering by product ID
  const [filterProductId, setFilterProductId] = useState<string | null>(null);

  const isNativePlatform =
    typeof window !== 'undefined' &&
    !!(window as any).Capacitor?.isNativePlatform &&
    (window as any).Capacitor.isNativePlatform();
  const mapBottomChrome = isNativePlatform
    ? 'calc(5.25rem + env(safe-area-inset-bottom, 0px) + 10px)'
    : 'calc(5rem + env(safe-area-inset-bottom, 0px))';
  const mapTopChrome = 'calc(64px + env(safe-area-inset-top, 0px))';

  const visibleMapPins = useMemo(() => {
    const isWebPlatform = isWeb();
    const maxMarkers = isWebPlatform ? 200 : 50;
    const shopPins = mapPins.filter((p) => p.kind === 'shop');
    const locationPins = mapPins.filter((p) => p.kind === 'location');
    const remaining = Math.max(0, maxMarkers - shopPins.length);
    return [...shopPins, ...locationPins.slice(0, remaining)];
  }, [mapPins]);

  const shopPinsOnly = useMemo(
    () => mapPins.filter((p) => p.kind === 'shop'),
    [mapPins]
  );

  // Check for focus location and product filter from URL params FIRST (before loading prices/location)
  useEffect(() => {
    const focusLat = searchParams.get('lat');
    const focusLng = searchParams.get('lng');
    const shouldFocus = searchParams.get('focus') === 'true';
    const productId = searchParams.get('productId');
    
    // Set product filter if productId is provided
    if (productId) {
      console.log('🔍 Filtering by product ID:', productId);
      setFilterProductId(productId);
    } else {
      setFilterProductId(null);
    }
    
    if (shouldFocus && focusLat && focusLng) {
      const lat = parseFloat(focusLat);
      const lng = parseFloat(focusLng);
      
      // Validate coordinates are within valid ranges
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        console.log('📍 Focusing on location from URL:', { lat, lng, rawLat: focusLat, rawLng: focusLng, productId });
        // Leaflet uses [lat, lng] format
        const focusCoords: [number, number] = [lat, lng];
        hasFocusFromURL.current = true; // Mark that we have focus from URL
        focusedLocationRef.current = focusCoords; // Store focused location
        setMapCenter(focusCoords);
        setMapZoom(19); // Maximum zoom for closest view of product address
        // Clear URL params after focusing (with a delay to ensure map updates)
        setTimeout(() => {
          // Keep productId in URL if it exists, but remove focus params
          const newUrl = productId 
            ? `/app/map?productId=${productId}`
            : '/app/map';
          window.history.replaceState({}, '', newUrl);
          // Keep focus flag active for longer (10 seconds) to prevent user location from overriding
          // This ensures geolocation API has time to complete without interfering
          setTimeout(() => {
            hasFocusFromURL.current = false;
            // Keep focused location for additional 5 seconds as backup
            setTimeout(() => {
              focusedLocationRef.current = null;
            }, 5000);
          }, 10000); // 10 seconds total
        }, 500);
      } else {
        console.error('❌ Invalid coordinates from URL:', { focusLat, focusLng, parsedLat: lat, parsedLng: lng });
        hasFocusFromURL.current = false;
        setMapError('Geçersiz koordinatlar');
      }
    } else {
      hasFocusFromURL.current = false; // No focus from URL
    }
  }, [searchParams]);

  // Load user location and prices AFTER URL params are checked
  useEffect(() => {
    // Small delay to ensure URL params are processed first
    const timer = setTimeout(() => {
      loadUserLocation();
      loadPrices();
    }, 100);
    return () => clearTimeout(timer);
  }, [filterProductId]); // Reload when product filter changes

  // Load nearby businesses when user location is available (but not when filtering by product)
  useEffect(() => {
    if (userLocation && !filterProductId) {
      loadNearbyBusinesses(userLocation[0], userLocation[1]);
    } else if (filterProductId) {
      // Hide businesses when filtering by product
      setBusinesses([]);
    }
  }, [userLocation, filterProductId]);


  const loadUserLocation = async () => {
    try {
      const position = await getCurrentPosition();
      if (position) {
        setLocationDenied(false);
        const lat = position.latitude;
        const lng = position.longitude;
        
        // Validate coordinates
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
          console.error('❌ Invalid position coordinates:', { lat, lng });
          return;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.error('❌ Position coordinates out of range:', { lat, lng });
          return;
        }
        
        const location: [number, number] = [lat, lng];
        setUserLocation(location);
        // Only update map center if we don't have focus from URL or focused location
        // Check both the flag and the stored focused location to prevent override
        if (!hasFocusFromURL.current && !focusedLocationRef.current) {
          setMapCenter(location);
          setMapZoom(15);
        } else {
          console.log('📍 Skipping map center update - focus from URL is active:', {
            hasFocusFromURL: hasFocusFromURL.current,
            focusedLocation: focusedLocationRef.current,
            userLocation: location
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to get user location:', error);
      const msg = String(error?.message || error || '');
      if (/permission|denied|izin/i.test(msg)) {
        setLocationDenied(true);
      }
    }
  };

  const loadPrices = async () => {
    try {
      setIsLoading(true);
      setMapError(null); // Clear any previous errors
      // Load prices to find cheapest per product (platform-specific limits)
      const isWebPlatform = isWeb();
      
      // If filtering by product ID, only load prices for that product
      const requestParams: any = {
        limit: isWebPlatform ? 500 : 100, // Reduced from 200 to 100 for mobile to prevent ANR
        sort: 'cheapest', // Sort by cheapest first
      };
      
      if (filterProductId) {
        requestParams.product = filterProductId;
        console.log('🔍 Loading prices for product:', filterProductId);
      }

      const [data, merchantShops] = await Promise.all([
        pricesAPI.getAll(requestParams),
        filterProductId
          ? Promise.resolve([])
          : merchantProductsAPI.getAllMerchantShops(100).catch((err) => {
              console.warn('⚠️ Merchant shops for map failed:', err);
              return [];
            }),
      ]);
      
      if (!Array.isArray(data)) {
        console.error('Invalid data format:', data);
        toast.error('Fiyat verileri beklenmeyen formatta');
        setMapError('Fiyat verileri yüklenemedi');
        setIsLoading(false);
        return;
      }
      
      // Prefer API-normalized lat/lng; also parse POINT strings defensively.
      const pricesWithCoords = data
        .map((price: any) => normalizePriceCoordinates(price))
        .filter((price: any) => {
          if (price.lat != null && price.lng != null) {
            const lat = parseFloat(String(price.lat));
            const lng = parseFloat(String(price.lng));
            return !isNaN(lat) && !isNaN(lng);
          }
          return !!parseLatLng(price.coordinates) || !!parseLatLng(price.location?.coordinates);
        });
      
      console.log(`📍 Found ${pricesWithCoords.length} prices with coordinates out of ${data.length} total`);
      console.log(`🏪 Merchant shops for map: ${Array.isArray(merchantShops) ? merchantShops.length : 0}`);

      // Seed shop pins from merchant shops; prefer geocoded shop address over stale GPS.
      const shopPinMap = new Map<string, MapPin>();
      if (Array.isArray(merchantShops)) {
        const shopEntries = await Promise.all(
          merchantShops.map(async (shop: any) => {
            const merchantId = String(shop?.id || shop?.merchant_id || '');
            if (!merchantId) return null;
            let coords = parseLatLng(shop.coordinates);
            // Only geocode when coords are missing — map-open geocode for every shop was laggy.
            if (!coords) {
              const addressText = String(shop.shop_address || '').trim();
              if (addressText.length > 3) {
                try {
                  const geo = await Promise.race([
                    geocodeMerchantShopAddress({ address: addressText }),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
                  ]);
                  if (geo?.coords) coords = geo.coords;
                } catch (geoErr) {
                  console.warn('Shop address geocode for map skipped:', geoErr);
                }
              }
            }
            if (!coords) return null;
            return {
              merchantId,
              pin: {
                id: `shop-${merchantId}`,
                merchantId,
                lat: coords.lat,
                lng: coords.lng,
                kind: 'shop' as const,
                title: shop.name || 'Esnaf Dükkanı',
                subtitle: shop.shop_address || '',
                label: String(shop.productCount || ''),
                logoUrl: shop.logoUrl || shop.avatar || null,
                items: [] as any[],
              },
            };
          })
        );
        for (const entry of shopEntries) {
          if (!entry) continue;
          shopPinMap.set(entry.merchantId, entry.pin);
        }
      }

      // Merchant products → one pin per shop (same address).
      // Consumer prices → one pin per shared location (not one pin per product).
      const shopBuckets = new Map<string, any[]>();
      const locationBuckets = new Map<string, any[]>();

      const isMerchantPrice = (price: any) => {
        const u = price.user || {};
        if (u.is_merchant === true || u.is_merchant === 'true' || u.is_merchant === 1) return true;
        // Merchant feed sync creates locations with type=market at the shop address.
        const locType = String(price.location?.type || '').toLowerCase();
        if (locType === 'market') return true;
        if (u.shop_name || u.shop_address) return true;
        return false;
      };

      pricesWithCoords.forEach((price: any) => {
        try {
          const currentPrice = parseFloat(String(price.price));
          if (isNaN(currentPrice)) return;

          if (isMerchantPrice(price)) {
            const shopKey = String(price.user_id || price.user?.id || price.location_id || '');
            if (!shopKey) return;
            const list = shopBuckets.get(shopKey) || [];
            // Keep cheapest row per product inside the same shop
            const productId = price.product?.id || price.product?._id || price.product_id || '';
            const existingIdx = list.findIndex(
              (p: any) => (p.product?.id || p.product?._id || p.product_id) === productId
            );
            if (existingIdx >= 0) {
              const existing = parseFloat(String(list[existingIdx].price));
              if (!isNaN(existing) && currentPrice < existing) {
                list[existingIdx] = price;
              }
            } else {
              list.push(price);
            }
            shopBuckets.set(shopKey, list);
            return;
          }

          const locKey = consumerLocationKey(price);
          const list = locationBuckets.get(locKey) || [];
          const productId = price.product?.id || price.product?._id || price.product_id || '';
          const existingIdx = productId
            ? list.findIndex(
                (p: any) => (p.product?.id || p.product?._id || p.product_id) === productId
              )
            : -1;
          if (existingIdx >= 0) {
            const existing = parseFloat(String(list[existingIdx].price));
            if (!isNaN(existing) && currentPrice < existing) {
              list[existingIdx] = price;
            }
          } else {
            list.push(price);
          }
          locationBuckets.set(locKey, list);
        } catch (e) {
          console.error('Error processing price:', e, price);
        }
      });

      shopBuckets.forEach((items, shopKey) => {
        if (!items.length) return;
        // Prefer shared location coords so all products sit on the same shop pin.
        const anchor = items[0];
        let lat = Number(anchor.lat);
        let lng = Number(anchor.lng);
        const fromLoc = parseLatLng(anchor.location?.coordinates);
        if (fromLoc) {
          lat = fromLoc.lat;
          lng = fromLoc.lng;
        }
        if (isNaN(lat) || isNaN(lng)) return;

        const shopName =
          anchor.user?.shop_name ||
          anchor.location?.name ||
          anchor.user?.name ||
          'Esnaf Dükkanı';
        const logoUrl =
          anchor.user?.shop_logo ||
          anchor.user?.avatar ||
          null;
        const sortedItems = items.sort((a: any, b: any) => Number(a.price) - Number(b.price));
        const existing = shopPinMap.get(shopKey);
        if (existing) {
          existing.items = sortedItems;
          existing.label = String(sortedItems.length);
          if (!existing.logoUrl && logoUrl) existing.logoUrl = logoUrl;
          if (!existing.subtitle) {
            existing.subtitle =
              anchor.location?.address || anchor.user?.shop_address || anchor.location?.city || '';
          }
          if (existing.title === 'Esnaf Dükkanı' && shopName) existing.title = shopName;
          // Prefer precise price/location coords when available
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            existing.lat = lat;
            existing.lng = lng;
          }
        } else {
          shopPinMap.set(shopKey, {
            id: `shop-${shopKey}`,
            merchantId: String(anchor.user_id || anchor.user?.id || shopKey),
            lat,
            lng,
            kind: 'shop',
            title: shopName,
            subtitle: anchor.location?.address || anchor.user?.shop_address || anchor.location?.city || '',
            label: `${sortedItems.length}`,
            logoUrl,
            items: sortedItems,
          });
        }
      });

      const pins: MapPin[] = Array.from(shopPinMap.values());

      const locationLists = Array.from(locationBuckets.entries());
      locationLists.forEach(([locKey, items]) => {
        if (!items.length) return;
        const anchor = items[0];
        const lat = Number(anchor.lat);
        const lng = Number(anchor.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        const sorted = items.sort((a: any, b: any) => Number(a.price) - Number(b.price));
        pins.push({
          id: `location-${locKey}`,
          lat,
          lng,
          kind: 'location',
          title: anchor.location?.name || 'Paylaşılan konum',
          subtitle:
            anchor.location?.address ||
            [anchor.location?.district, anchor.location?.city].filter(Boolean).join(', ') ||
            '',
          label: String(sorted.length),
          items: sorted,
        });
      });

      // Flat prices for sheets: all shop items + location items
      const flatPrices: Price[] = [
        ...Array.from(shopBuckets.values()).flat(),
        ...Array.from(locationBuckets.values()).flat(),
      ] as Price[];

      setPrices(flatPrices);
      setMapPins(pins);
      
      // If we have pins, center map on them (only if no user location and no focus from URL)
      if (pins.length > 0 && !userLocation && !hasFocusFromURL.current && !focusedLocationRef.current) {
        const firstShop = pins.find((p) => p.kind === 'shop') || pins[0];
        console.log('📍 Centering map on first pin:', { lat: firstShop.lat, lng: firstShop.lng, kind: firstShop.kind, title: firstShop.title });
        setMapCenter([firstShop.lat, firstShop.lng]);
      } else if (hasFocusFromURL.current || focusedLocationRef.current) {
        console.log('📍 Skipping map center update from loadPrices - focus from URL is active');
      }
      
      if (pins.length === 0) {
        console.warn('⚠️ No map pins found');
        if (!locationDenied) {
          toast.info('Haritada gösterilecek konumlu fiyat yok. Esnaf ürünleri dükkan adresinde pinlenir.', {
            duration: 4000,
          });
        }
      } else {
        console.log(`✅ Map pins ready: ${pins.length} (${pins.filter((p) => p.kind === 'shop').length} shops, ${pins.filter((p) => p.kind === 'location').length} locations)`);
      }
    } catch (error: any) {
      console.error('Failed to load prices:', error);
      const errorMessage = error.message || 'Fiyatlar yüklenirken bir hata oluştu';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',');
  };

  const loadProductPhotos = async (productId: string) => {
    if (!productId) return;
    
    try {
      setIsLoadingPhotos(true);
      const data = await pricesAPI.getAll({
        product: productId,
        limit: 100,
      });
      
      if (Array.isArray(data)) {
        // Filter prices that have photos
        const pricesWithPhotos = data.filter((price: any) => price.photo);
        setProductPhotos(pricesWithPhotos);
        console.log(`✅ Loaded ${pricesWithPhotos.length} photos for product ${productId}`);
      }
    } catch (error: any) {
      console.error('Failed to load product photos:', error);
      toast.error('Fotoğraflar yüklenirken bir hata oluştu');
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const loadNearbyBusinesses = async (latitude: number, longitude: number) => {
    try {
      setIsLoadingBusinesses(true);
      
      // Get user's search radius preference (default: 15 km)
      const searchRadiusKm = (user as any)?.search_radius || 
                            (user as any)?.preferences?.searchRadius || 
                            15;
      const searchRadiusMeters = searchRadiusKm * 1000;
      const isWebPlatform = isWeb();
      
      const result = await searchNearbyPlaces(
        latitude,
        longitude,
        Math.min(searchRadiusMeters, isWebPlatform ? 5000 : 3000),
        // Legacy Places Nearby Search: only the first type is used (must be a valid Table A type).
        ['store', 'supermarket', 'grocery_or_supermarket', 'bakery', 'pharmacy']
      );
      
      if (result.success && result.places) {
        // Platform-specific limits for performance
        const maxBusinesses = isWebPlatform ? 50 : 20;
        const limitedBusinesses = result.places.slice(0, maxBusinesses);
        setBusinesses(limitedBusinesses);
        console.log(`✅ Loaded ${limitedBusinesses.length} nearby businesses (platform: ${isWebPlatform ? 'web' : 'mobile'})`);
      } else if (result.error && !/API key|REQUEST_DENIED|yüklenemiyor|not activated/i.test(result.error)) {
        console.warn('⚠️ Failed to load businesses:', result.error);
      }
    } catch (error: any) {
      console.error('Failed to load nearby businesses:', error);
    } finally {
      setIsLoadingBusinesses(false);
    }
  };

  const handleCenterOnUser = async () => {
    try {
      const position = await getCurrentPosition();
      if (position) {
        setLocationDenied(false);
        const location: [number, number] = [position.latitude, position.longitude];
        setUserLocation(location);
        // Clear URL focus and focused location when user manually centers
        hasFocusFromURL.current = false;
        focusedLocationRef.current = null;
        setMapCenter(location);
        setMapZoom(15);
      } else {
        toast.error('Konum alınamadı');
      }
    } catch (error: any) {
      console.error('Failed to get user location:', error);
      const msg = String(error?.message || error || '');
      if (/permission|denied|izin/i.test(msg)) {
        setLocationDenied(true);
        toast.error('Konum izni kapalı. Telefon Ayarları → Uygulamalar → esnaftaucuz → Konum iznini açın.', {
          duration: 6000,
        });
      } else {
        toast.error('Konum alınamadı');
      }
    }
  };

  return (
    <div className="relative overflow-hidden bg-gray-200" style={{ height: `calc(100dvh - ${mapBottomChrome})` }}>
      {/* Custom Leaflet Popup Styles */}
      <style>{`
        .leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-shop-logo-marker,
        .custom-location-marker,
        .custom-business-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 0;
        }
        .leaflet-popup-content {
          margin: 0;
          padding: 16px;
          min-width: 200px;
          max-width: 280px;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          background: white;
        }
        .leaflet-popup-tip {
          background: white;
        }
        /* Keep zoom above bottom tab bar */
        .leaflet-bottom {
          bottom: 12px !important;
        }
        .leaflet-control-zoom {
          margin-bottom: 8px !important;
          margin-right: 10px !important;
        }
        /* Skip redrawing SVG radius while dragging — big FPS win on Android WebView */
        .leaflet-dragging .leaflet-overlay-pane {
          visibility: hidden !important;
        }
        .leaflet-container {
          background: #e5e7eb;
        }
      `}</style>
      
      {/* Map Header — solid bar so title does not wash out over map/zoom */}
      <div className="absolute left-0 right-0 bg-white px-3 py-2.5 z-[1000] border-b border-gray-200 shadow-sm flex items-center justify-between gap-2" style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 'calc(0.625rem + env(safe-area-inset-top, 0px))' }}>
        <h1 className="font-semibold text-base sm:text-lg flex-1 min-w-0 truncate whitespace-nowrap text-gray-900">En Düşük Fiyatlı Ürünler</h1>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            variant={showBusinesses ? "default" : "outline"}
            size="sm"
            onClick={() => setShowBusinesses(!showBusinesses)}
            className="text-xs px-2 h-8"
            title={showBusinesses ? 'İşletmeleri gizle' : 'İşletmeleri göster'}
          >
            🏪
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCenterOnUser}
            className="px-2 h-8"
          >
            <Navigation className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {locationDenied && (
        <div
          className="absolute left-3 right-3 z-[1000] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm"
          style={{ top: 'calc(64px + env(safe-area-inset-top, 0px) + 8px)' }}
        >
          Konum izni kapalı. Yakındaki fiyatlar için izin verin veya sağ üstteki konum düğmesine dokunun.
          <button
            type="button"
            className="ml-2 font-semibold text-amber-950 underline"
            onClick={handleCenterOnUser}
          >
            Tekrar dene
          </button>
        </div>
      )}

      {/* Map Container */}
      <div 
        className="w-full relative" 
            style={{
          height: `calc(100% - ${mapTopChrome})`, 
          marginTop: mapTopChrome,
          zIndex: 1
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-pulse" />
              <p>Harita yükleniyor...</p>
            </div>
              </div>
        ) : mapError ? (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <div className="text-center p-4">
              <p className="text-red-600 font-semibold mb-2">Harita yüklenemedi</p>
              <p className="text-sm text-gray-600 mb-4">{mapError}</p>
              <Button onClick={() => { setMapError(null); window.location.reload(); }}>
                Yeniden Dene
              </Button>
            </div>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
            scrollWheelZoom={true}
            zoomControl={false}
            preferCanvas={true}
            fadeAnimation={false}
            markerZoomAnimation={false}
            zoomAnimation={!isNativePlatform}
            inertia={!isNativePlatform}
            whenCreated={(mapInstance) => {
              try {
                mapRef.current = mapInstance;
                // Prefer snappy pans over fancy animations in WebView
                mapInstance.options.fadeAnimation = false;
                mapInstance.options.markerZoomAnimation = false;
                if (isNativePlatform) {
                  mapInstance.options.zoomAnimation = false;
                  mapInstance.options.inertia = false;
                }
                console.log('✅ Map instance created successfully');
              } catch (error: any) {
                console.error('❌ Error creating map instance:', error);
                setMapError('Harita oluşturulamadı');
              }
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
              updateWhenIdle={true}
              updateWhenZooming={false}
              keepBuffer={2}
            />
            <ZoomControl position="bottomright" />
            
            {/* Auto-open popups component */}
            <AutoOpenPopups prices={prices} markerRefs={markerRefs} mapRef={mapRef} />
            
            {/* User Location Marker and Search Radius Circle */}
            {userLocation && (() => {
              try {
                // Validate userLocation coordinates
                const [lat, lng] = userLocation;
                if (!userLocation || !Array.isArray(userLocation) || userLocation.length !== 2) {
                  console.warn('⚠️ Invalid userLocation format:', userLocation);
                  return null;
                }
                if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
                  console.warn('⚠️ Invalid userLocation coordinates:', { lat, lng });
                  return null;
                }
                if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                  console.warn('⚠️ UserLocation coordinates out of range:', { lat, lng });
                  return null;
                }
                
                // Get user's search radius preference (default: 15 km)
                const searchRadiusKm = (user as any)?.search_radius || 
                                      (user as any)?.preferences?.searchRadius || 
                                      15;
                const searchRadiusMeters = Math.min(searchRadiusKm * 1000, 1000000); // Max 1000km in meters
                
                return (
                  <>
                    <Circle
                      center={userLocation}
                      radius={searchRadiusMeters}
                      pathOptions={{
                        color: '#22c55e',
                        fillColor: '#22c55e',
                        fillOpacity: 0.08,
                        weight: 1.5,
                      }}
                    />
                    
                    {/* User Location Marker */}
                    <Marker
                      position={userLocation}
                      icon={userLocationIcon}
                    >
                      <Popup>
                        <div className="text-center">
                          <strong>📍 Konumunuz</strong>
                          <br />
                          <span className="text-xs text-gray-500">Arama çevresi: {searchRadiusKm} km</span>
                        </div>
                      </Popup>
                    </Marker>
                  </>
                );
              } catch (error: any) {
                console.error('❌ Error rendering user location marker:', error);
                return null;
              }
            })()}

            {/* Price / Shop Markers */}
            {visibleMapPins.map((pin) => {
              const lat = pin.lat;
              const lng = pin.lng;
              
              if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                console.warn('⚠️ Skipping invalid pin coordinates:', { pinId: pin.id, lat, lng });
                return null;
              }

              const isShop = pin.kind === 'shop';
              const icon = isShop
                ? createShopLogoIcon(pin.logoUrl, pin.title)
                : createLocationClusterIcon(pin.items.length || Number(pin.label) || 1);
              
              return (
                <Marker
                  key={pin.id}
                  ref={(ref) => {
                    if (ref) {
                      markerRefs.current[pin.id] = ref;
                    }
                  }}
                  position={[lat, lng]}
                  icon={icon}
                  zIndexOffset={isShop ? 600 : 200}
                  eventHandlers={{
                    click: () => {
                      setSelectedPin(pin);
                      setSelectedPrice(null);
                    },
                  }}
                />
              );
            })}

            {/* Business/Place Markers (platform-specific limits) */}
            {showBusinesses && (() => {
              const isWebPlatform = isWeb();
              const maxBusinesses = isWebPlatform ? 50 : 10; // Reduced from 20 to 10 for mobile to prevent ANR
              return businesses.slice(0, maxBusinesses).map((business) => {
              const lat = business.geometry?.location?.lat;
              const lng = business.geometry?.location?.lng;
              
              // Validate coordinates
              if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') return null;
              if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                console.warn('⚠️ Skipping invalid business coordinates:', { businessId: business.place_id, lat, lng });
                return null;
              }
              
              const businessId = `business-${business.place_id}`;
              
              return (
                <Marker
                  key={businessId}
                  position={[lat, lng]}
                  icon={createBusinessIcon()}
                >
                  <Popup className="custom-popup">
                    <div className="min-w-[200px] max-w-[280px]">
                      {/* Business Name */}
                      <div className="mb-3 pb-2 border-b border-gray-200">
                        <div className="font-bold text-lg text-blue-700 mb-1">
                          🏪 {business.name}
                        </div>
                      </div>
                      
                      {/* Address */}
                      {(business.vicinity || business.formatted_address) && (
                        <div className="mb-3">
                          <div className="flex items-start gap-2 text-sm text-gray-700">
                            <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <span className="text-xs">
                              {business.vicinity || business.formatted_address}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Rating */}
                      {business.rating && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-yellow-500">⭐</span>
                            <span className="font-semibold">{business.rating.toFixed(1)}</span>
                            {business.user_ratings_total && (
                              <span className="text-xs text-gray-500">
                                ({business.user_ratings_total} değerlendirme)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Opening Hours */}
                      {business.opening_hours?.open_now !== undefined && (
                        <div className="mb-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            business.opening_hours.open_now
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : 'bg-red-100 text-red-800 border border-red-300'
                          }`}>
                            {business.opening_hours.open_now ? '🟢 Açık' : '🔴 Kapalı'}
                          </span>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
              });
            })()}

            <MapCenter center={mapCenter} zoom={mapZoom} suspend={shopsFitted} />
            <FitMapToShopPins
              shopPins={shopPinsOnly}
              userLocation={userLocation}
              onFitted={() => setShopsFitted(true)}
            />
          </MapContainer>
        )}
      </div>

      {/* Pin list bottom sheet (shop or clustered location) */}
      {selectedPin && !selectedPrice && (
        <Sheet open={!!selectedPin} onOpenChange={(open) => !open && setSelectedPin(null)}>
          <SheetContent side="bottom" className="h-[55vh]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {selectedPin.kind === 'shop' && selectedPin.logoUrl ? (
                  <img
                    src={selectedPin.logoUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <span className="truncate">{selectedPin.title}</span>
              </SheetTitle>
            </SheetHeader>
            <div className="py-3 space-y-3 overflow-y-auto h-[calc(55vh-5rem)]">
              {selectedPin.subtitle ? (
                <div className="text-xs text-gray-500 flex items-start gap-1 px-1">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{selectedPin.subtitle}</span>
                </div>
              ) : null}
              {selectedPin.kind === 'shop' && selectedPin.merchantId ? (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => navigate(`/app/merchant-shop/${selectedPin.merchantId}`)}
                >
                  Dükkanı aç
                </Button>
              ) : null}
              <div className="text-sm font-medium text-gray-700 px-1">
                {selectedPin.kind === 'shop'
                  ? `Ürünler (${selectedPin.items.length})`
                  : `Bu konumdaki paylaşımlar (${selectedPin.items.length})`}
              </div>
              {selectedPin.items.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-6">
                  {selectedPin.kind === 'shop'
                    ? 'Ürün listesi yüklenemedi; dükkan sayfasından bakabilirsiniz.'
                    : 'Bu konumda listelenecek fiyat yok.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedPin.items.map((item: any) => {
                    const itemId = item.id || item._id || `${item.product_id}-${item.price}`;
                    return (
                      <button
                        key={itemId}
                        type="button"
                        className="w-full text-left px-3 py-2.5 rounded-lg bg-white border border-gray-200 hover:border-green-500"
                        onClick={() => {
                          setSelectedPrice(item);
                          void loadProductPhotos(
                            item.product?.id || item.product?._id || item.product_id || ''
                          );
                        }}
                      >
                        <div className="font-medium text-gray-900 truncate">
                          {item.product?.name || 'Ürün'}
                        </div>
                        <div className="text-green-600 font-semibold text-sm">
                          {formatPrice(Number(item.price))} ₺
                          <span className="text-gray-500 font-normal"> / {item.unit}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Bottom Sheet — single price detail */}
      {selectedPrice && (
        <Sheet
          open={!!selectedPrice}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPrice(null);
            }
          }}
        >
          <SheetContent side="bottom" className="h-[50vh]">
          <SheetHeader>
              <SheetTitle>{selectedPrice.product?.name || 'Ürün'}</SheetTitle>
          </SheetHeader>
            <div className="py-4 space-y-4 overflow-y-auto">
              {/* Main Price Card */}
              <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-gray-900 mb-1">
                      {selectedPrice.product?.name}
                    </h3>
                    <div className="text-xs text-gray-500 mb-3">
                      {selectedPrice.product?.category}
                    </div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <p className="text-3xl font-bold text-green-600">
                        {formatPrice(selectedPrice.price)} ₺
                      </p>
                      <span className="text-lg text-gray-500">/ {selectedPrice.unit}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        ⭐ En Düşük Fiyat
                      </Badge>
                      {(selectedPrice.isVerified || selectedPrice.is_verified) && (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          ✓ Doğrulanmış
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Location Info */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 mb-1">
                        {selectedPrice.location.name}
                      </div>
                      {selectedPrice.location.city && (
                        <div className="text-sm text-gray-600">
                          {selectedPrice.location.city}
                          {selectedPrice.location.district && `, ${selectedPrice.location.district}`}
                        </div>
                      )}
                      {selectedPrice.location.type && (
                        <div className="text-xs text-gray-500 mt-1">
                          Tip: {selectedPrice.location.type}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* User Info */}
                {selectedPrice.user && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Paylaşan:</span> {selectedPrice.user.name}
                      {selectedPrice.user.level && (
                        <span className="text-xs text-gray-500 ml-2">
                          (Seviye {selectedPrice.user.level})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo */}
                {selectedPrice.photo && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Bu Fiyatın Fotoğrafı</div>
                    <img
                      src={selectedPrice.photo}
                      alt={selectedPrice.product?.name || 'Ürün'}
                      className="w-full h-48 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        // Hide image on error
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* All Product Photos */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  Bu Ürün İçin Eklenen Tüm Resimler ({productPhotos.length})
                </div>
                {isLoadingPhotos ? (
                  <div className="text-center py-4 text-gray-500 text-sm">Yükleniyor...</div>
                ) : productPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {productPhotos.map((priceWithPhoto) => {
                      const priceId = priceWithPhoto.id || priceWithPhoto._id || '';
                      return (
                        <div key={priceId} className="relative group">
                          <img
                            src={priceWithPhoto.photo}
                            alt={selectedPrice.product?.name || 'Ürün'}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 rounded-b-lg">
                            <div className="font-semibold">{formatPrice(priceWithPhoto.price)} ₺</div>
                            <div className="text-xs opacity-90">{priceWithPhoto.location?.name}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Bu ürün için henüz fotoğraf eklenmemiş
                  </div>
                )}
              </div>

              {/* Info Note */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">ℹ️ Bilgi:</span> Haritada her ürün için en düşük fiyat gösterilmektedir. 
                  Detaylı bilgi için marker'a tıklayın.
                </p>
              </div>
          </div>
        </SheetContent>
      </Sheet>
      )}
    </div>
  );
}
