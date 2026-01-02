import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Navigation } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../ui/sheet';
import { Button } from '../../ui/button';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { pricesAPI } from '../../../services/supabase-api';
import { useGeolocation } from '../../../../src/hooks/useGeolocation';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';
import { searchNearbyPlaces } from '../../../utils/places';
import { isWeb } from '../../../../src/utils/capacitor';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon for prices
const createPriceIcon = (price: string) => {
  return L.divIcon({
    className: 'custom-price-marker',
    html: `
      <div style="
        background: #22c55e;
        color: white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        ${price}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

// Custom marker icon for businesses/places
const createBusinessIcon = () => {
  return L.divIcon({
    className: 'custom-business-marker',
    html: `
      <div style="
        background: #3b82f6;
        color: white;
        border-radius: 8px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 20px;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        🏪
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

// Component to center map on user location
function MapCenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  const prevCenterRef = useRef<[number, number] | null>(null);
  const prevZoomRef = useRef<number | undefined>(undefined);
  
  useEffect(() => {
    try {
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
          if (zoom !== undefined && zoom >= 0 && zoom <= 20) {
            map.setView([lat, lng], zoom, { animate: true, duration: 0.5 });
            prevZoomRef.current = zoom;
          } else {
            const currentZoom = map.getZoom();
            if (currentZoom >= 0 && currentZoom <= 20) {
              map.setView([lat, lng], currentZoom, { animate: true, duration: 0.5 });
            } else {
              map.setView([lat, lng], 13, { animate: true, duration: 0.5 });
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
  }, [center, zoom, map]);
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
    // Disable auto-open popups on web for better performance
    if (isWebPlatform) {
      return;
    }
    
    if (prices.length > 0 && mapRef.current) {
      // Wait for markers to render, then open LIMITED popups (max 5 for performance)
      const timer = setTimeout(() => {
        try {
          // Limit to first 5 prices to prevent ANR
          const pricesToOpen = prices.slice(0, 5);
          let openedCount = 0;
          
          // Use requestAnimationFrame to spread popup opening across frames
          const openNextPopup = () => {
            if (openedCount >= pricesToOpen.length) return;
            
            const price = pricesToOpen[openedCount];
            try {
              const priceId = price.id || price._id || '';
              const markerRef = markerRefs.current[priceId];
              if (markerRef?.leafletElement && mapRef.current) {
                const marker = markerRef.leafletElement;
                if (!marker.isPopupOpen()) {
                  marker.openPopup();
                }
              }
            } catch (error: any) {
              console.error('Error opening popup for price:', price.id, error);
            }
            
            openedCount++;
            // Open next popup in next frame (prevents blocking)
            if (openedCount < pricesToOpen.length) {
              requestAnimationFrame(() => {
                setTimeout(openNextPopup, 100); // 100ms delay between each
              });
            }
          };
          
          // Start opening popups
          requestAnimationFrame(openNextPopup);
        } catch (error: any) {
          console.error('Error in AutoOpenPopups:', error);
        }
      }, 2000); // Increased delay to ensure map is fully loaded

      return () => clearTimeout(timer);
    }
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
  const { getCurrentPosition } = useGeolocation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [productPhotos, setProductPhotos] = useState<Price[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false);
  const [showBusinesses, setShowBusinesses] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.8667, 32.4833]); // Default: Konya
  const [mapZoom, setMapZoom] = useState(13);
  const markerRefs = useRef<Record<string, any>>({});
  const mapRef = useRef<L.Map | null>(null);
  const hasFocusFromURL = useRef(false); // Track if we have focus coordinates from URL
  const [mapError, setMapError] = useState<string | null>(null);

  // Check for focus location from URL params FIRST (before loading prices/location)
  useEffect(() => {
    const focusLat = searchParams.get('lat');
    const focusLng = searchParams.get('lng');
    const shouldFocus = searchParams.get('focus') === 'true';
    
    if (shouldFocus && focusLat && focusLng) {
      const lat = parseFloat(focusLat);
      const lng = parseFloat(focusLng);
      
      // Validate coordinates are within valid ranges
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        console.log('📍 Focusing on location from URL:', { lat, lng, rawLat: focusLat, rawLng: focusLng });
        // Leaflet uses [lat, lng] format
        hasFocusFromURL.current = true; // Mark that we have focus from URL
        setMapCenter([lat, lng]);
        setMapZoom(19); // Maximum zoom for closest view of product address
        // Clear URL params after focusing (with a delay to ensure map updates)
        setTimeout(() => {
          window.history.replaceState({}, '', '/app/map');
          // Clear the focus flag after a delay to allow other functions to work normally
          setTimeout(() => {
            hasFocusFromURL.current = false;
          }, 1000);
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
  }, []);

  // Load nearby businesses when user location is available
  useEffect(() => {
    if (userLocation) {
      loadNearbyBusinesses(userLocation[0], userLocation[1]);
    }
  }, [userLocation]);


  const loadUserLocation = async () => {
    try {
      const position = await getCurrentPosition();
      if (position) {
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
        // Only update map center if we don't have focus from URL
        if (!hasFocusFromURL.current) {
          setMapCenter(location);
          setMapZoom(15);
        }
      }
    } catch (error: any) {
      console.error('Failed to get user location:', error);
      toast.error('Konum alınamadı');
    }
  };

  const loadPrices = async () => {
    try {
      setIsLoading(true);
      setMapError(null); // Clear any previous errors
      // Load prices to find cheapest per product (platform-specific limits)
      const isWebPlatform = isWeb();
      const data = await pricesAPI.getAll({
        limit: isWebPlatform ? 500 : 200, // Web can handle more, mobile limited for ANR prevention
        sort: 'cheapest', // Sort by cheapest first
      });
      
      if (!Array.isArray(data)) {
        console.error('Invalid data format:', data);
        toast.error('Fiyat verileri beklenmeyen formatta');
        setMapError('Fiyat verileri yüklenemedi');
        setIsLoading(false);
        return;
      }
      
      // Filter prices that have coordinates (now normalized by API)
      const pricesWithCoords = data.filter((price: any) => {
        // Coordinates are now normalized by pricesAPI.getAll()
        if (price.lat && price.lng) {
          const lat = parseFloat(String(price.lat));
          const lng = parseFloat(String(price.lng));
          if (!isNaN(lat) && !isNaN(lng)) {
            return true;
          }
        }
        return false;
      });
      
      console.log(`📍 Found ${pricesWithCoords.length} prices with coordinates out of ${data.length} total`);
      
      // Group by product and keep only the cheapest price for each product
      const cheapestByProduct: Record<string, Price> = {};
      
      pricesWithCoords.forEach((price: any) => {
        try {
          const productId = price.product?.id || price.product?._id || '';
          if (!productId) return;
          
          const currentPrice = parseFloat(String(price.price));
          if (isNaN(currentPrice)) return;
          
          if (!cheapestByProduct[productId]) {
            cheapestByProduct[productId] = price;
          } else {
            const existingPrice = parseFloat(String(cheapestByProduct[productId].price));
            if (!isNaN(existingPrice) && currentPrice < existingPrice) {
              cheapestByProduct[productId] = price;
            }
          }
        } catch (e) {
          console.error('Error processing price:', e, price);
        }
      });
      
      // Convert to array and set prices
      const cheapestPrices = Object.values(cheapestByProduct);
      setPrices(cheapestPrices);
      
      // If we have prices, center map on them (only if no user location and no focus from URL)
      if (cheapestPrices.length > 0 && !userLocation && !hasFocusFromURL.current) {
        const firstPrice = cheapestPrices[0];
        if (firstPrice.lat && firstPrice.lng) {
          console.log('📍 Centering map on first price location:', { lat: firstPrice.lat, lng: firstPrice.lng });
          setMapCenter([firstPrice.lat, firstPrice.lng]);
        }
      } else if (hasFocusFromURL.current) {
        console.log('📍 Skipping map center update from loadPrices - focus from URL is active');
      }
      
      if (cheapestPrices.length === 0) {
        console.warn('⚠️ No prices with coordinates found');
        console.log('📊 Data summary:', {
          totalPrices: data.length,
          pricesWithCoords: pricesWithCoords.length,
          cheapestByProduct: Object.keys(cheapestByProduct).length,
        });
        toast.info('Haritada gösterilecek fiyat bulunamadı. Fiyatların konum bilgisi olmalı.');
      } else {
        console.log(`✅ Found ${cheapestPrices.length} cheapest prices to display on map`);
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
        productId,
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
        Math.min(searchRadiusMeters, isWebPlatform ? 5000 : 3000), // Web can search wider area
        ['store', 'shop', 'establishment', 'supermarket', 'grocery_or_supermarket', 'bakery', 'butcher', 'pharmacy']
      );
      
      if (result.success && result.places) {
        // Platform-specific limits for performance
        const maxBusinesses = isWebPlatform ? 50 : 20;
        const limitedBusinesses = result.places.slice(0, maxBusinesses);
        setBusinesses(limitedBusinesses);
        console.log(`✅ Loaded ${limitedBusinesses.length} nearby businesses (platform: ${isWebPlatform ? 'web' : 'mobile'})`);
      } else {
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
        const location: [number, number] = [position.latitude, position.longitude];
        setUserLocation(location);
        hasFocusFromURL.current = false; // Clear URL focus when user manually centers
        setMapCenter(location);
        setMapZoom(15);
      } else {
        toast.error('Konum alınamadı');
      }
    } catch (error) {
      console.error('Failed to get user location:', error);
      toast.error('Konum alınamadı');
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 relative overflow-hidden">
      {/* Custom Leaflet Popup Styles */}
      <style>{`
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
      `}</style>
      
      {/* Map Header */}
      <div className="absolute top-0 left-0 right-0 bg-white/95 backdrop-blur-sm px-3 py-2.5 z-[1000] border-b border-gray-200 flex items-center justify-between gap-2">
        <h1 className="font-semibold text-base sm:text-lg flex-1 min-w-0 truncate whitespace-nowrap">En Düşük Fiyatlı Ürünler</h1>
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

      {/* Map Container */}
      <div 
        className="w-full relative" 
            style={{
          height: 'calc(100vh - 80px)', 
          marginTop: '64px',
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
            whenCreated={(mapInstance) => {
              try {
                mapRef.current = mapInstance;
                console.log('✅ Map instance created successfully');
              } catch (error: any) {
                console.error('❌ Error creating map instance:', error);
                setMapError('Harita oluşturulamadı');
              }
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            />
            
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
                    {/* Search Radius Circle */}
                    <Circle
                      center={userLocation}
                      radius={searchRadiusMeters}
                      pathOptions={{
                        color: '#22c55e',
                        fillColor: '#22c55e',
                        fillOpacity: 0.1,
                        weight: 2,
                        dashArray: '5, 5',
                      }}
                    >
                      <Popup>
                        <div className="text-center">
                          <strong>Arama Çevresi</strong>
                          <br />
                          <span className="text-sm text-gray-600">{searchRadiusKm} km</span>
                        </div>
                      </Popup>
                    </Circle>
                    
                    {/* User Location Marker */}
                    <Marker
                      position={userLocation}
                      icon={L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                      })}
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

            {/* Price Markers - Only cheapest prices per product (platform-specific limits) */}
            {(() => {
              const isWebPlatform = isWeb();
              const maxMarkers = isWebPlatform ? 200 : 50; // Web can handle more markers
              return prices.slice(0, maxMarkers).map((price) => {
              // Validate coordinates before rendering marker
              if (!price.lat || !price.lng) return null;
              
              const lat = typeof price.lat === 'number' ? price.lat : parseFloat(String(price.lat));
              const lng = typeof price.lng === 'number' ? price.lng : parseFloat(String(price.lng));
              
              if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                console.warn('⚠️ Skipping invalid price coordinates:', { priceId: price.id, lat, lng });
                return null;
              }
              
              const priceText = `${formatPrice(price.price)} ₺`;
              const priceId = price.id || price._id || '';
              
              return (
                <Marker
                  key={priceId}
                  ref={(ref) => {
                    if (ref) {
                      markerRefs.current[priceId] = ref;
                    }
                  }}
                  position={[lat, lng]}
                  icon={createPriceIcon(priceText)}
                  eventHandlers={{
                    click: (e) => {
                      try {
                        // Use requestAnimationFrame to prevent blocking
                        requestAnimationFrame(() => {
                          try {
                            // Open popup when marker is clicked
                            const marker = e.target;
                            if (marker && marker.isPopupOpen()) {
                              marker.closePopup();
                            } else {
                              marker.openPopup();
                            }
                            // Also open bottom sheet with details
                            setSelectedPrice(price);
                          } catch (error: any) {
                            console.error('❌ Error handling marker click:', error);
                          }
                        });
                      } catch (error: any) {
                        console.error('❌ Error in click handler:', error);
                      }
                    },
                  }}
                >
                  <Popup 
                    autoClose={false} 
                    closeOnClick={false} 
                    className="custom-popup"
                  >
                    <div className="min-w-[200px] max-w-[280px]">
                      {/* Header with product name */}
                      <div className="mb-3 pb-2 border-b border-gray-200">
                        <div className="font-bold text-lg text-green-700 mb-1">
                          {price.product.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {price.product.category}
                        </div>
                      </div>
                      
                      {/* Price section */}
                      <div className="mb-3">
                        <div className="text-2xl font-bold text-green-600 mb-1">
                          {priceText}
                        </div>
                        <div className="text-sm text-gray-600">
                          / {price.unit}
                        </div>
                      </div>
                      
                      {/* Badge */}
                      <div className="mb-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                          ⭐ En Düşük Fiyat
                        </span>
                        {(price.isVerified || price.is_verified) && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300 ml-2">
                            ✓ Doğrulanmış
                          </span>
                        )}
                      </div>
                      
                      {/* Location */}
                      <div className="mb-3 pb-2 border-b border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{price.location.name}</span>
                        </div>
                        {price.location.city && (
                          <div className="text-xs text-gray-500 mt-1 ml-6">
                            {price.location.city}
                            {price.location.district && `, ${price.location.district}`}
                          </div>
                        )}
                      </div>
                      
                      {/* Action button */}
                      <button
                        onClick={async () => {
                          setSelectedPrice(price);
                          // Load all photos for this product
                          await loadProductPhotos(price.product.id || price.product._id || '');
                        }}
                        className="w-full mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Detayları Gör
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
              });
            })()}

            {/* Business/Place Markers (platform-specific limits) */}
            {showBusinesses && (() => {
              const isWebPlatform = isWeb();
              const maxBusinesses = isWebPlatform ? 50 : 20; // Web can handle more businesses
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
                      
                      {/* Types */}
                      {business.types && business.types.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-gray-500">
                            {business.types.slice(0, 3).map((type, idx) => {
                              const typeLabels: Record<string, string> = {
                                'store': 'Mağaza',
                                'shop': 'Dükkan',
                                'establishment': 'İşletme',
                                'supermarket': 'Süpermarket',
                                'grocery_or_supermarket': 'Market',
                                'bakery': 'Fırın',
                                'butcher': 'Kasap',
                                'pharmacy': 'Eczane',
                              };
                              return (
                                <span key={idx} className="inline-block mr-1">
                                  {typeLabels[type] || type}
                                </span>
                              );
                            }).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
              });
            })()}

            <MapCenter center={mapCenter} zoom={mapZoom} />
          </MapContainer>
        )}
      </div>

      {/* Bottom Sheet */}
      {selectedPrice && (
        <Sheet open={!!selectedPrice} onOpenChange={(open) => !open && setSelectedPrice(null)}>
          <SheetContent side="bottom" className="h-[50vh]">
          <SheetHeader>
              <SheetTitle>{selectedPrice.product.name}</SheetTitle>
          </SheetHeader>
            <div className="py-4 space-y-4 overflow-y-auto">
              {/* Main Price Card */}
              <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-gray-900 mb-1">
                      {selectedPrice.product.name}
                    </h3>
                    <div className="text-xs text-gray-500 mb-3">
                      {selectedPrice.product.category}
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
                      alt={selectedPrice.product.name}
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
                            alt={selectedPrice.product.name}
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
