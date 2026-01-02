import { useEffect, useState, useRef } from 'react';
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

// Component to center map on user location
function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Component to handle auto-opening popups
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
  
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current = map;
    }
  }, [map, mapRef]);

  useEffect(() => {
    if (prices.length > 0) {
      // Wait for markers to render
      const timer = setTimeout(() => {
        // Open first 3 popups
        const popupsToOpen = Math.min(3, prices.length);
        for (let i = 0; i < popupsToOpen; i++) {
          const price = prices[i];
          const priceId = price.id || price._id || '';
          const markerRef = markerRefs.current[priceId];
          if (markerRef?.leafletElement) {
            const marker = markerRef.leafletElement;
            if (!marker.isPopupOpen()) {
              marker.openPopup();
            }
          }
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [prices, markerRefs]);

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

export default function MapScreen() {
  const { getCurrentPosition } = useGeolocation();
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [productPhotos, setProductPhotos] = useState<Price[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.8667, 32.4833]); // Default: Konya
  const [mapZoom, setMapZoom] = useState(13);
  const markerRefs = useRef<Record<string, any>>({});
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    loadUserLocation();
    loadPrices();
  }, []);


  const loadUserLocation = async () => {
    try {
      const position = await getCurrentPosition();
      if (position) {
        const location: [number, number] = [position.latitude, position.longitude];
        setUserLocation(location);
        setMapCenter(location);
        setMapZoom(15);
      }
    } catch (error) {
      console.error('Failed to get user location:', error);
      toast.error('Konum alınamadı');
    }
  };

  const loadPrices = async () => {
    try {
      setIsLoading(true);
      // Load all prices to find cheapest per product
      const data = await pricesAPI.getAll({
        limit: 500, // Load more prices to find cheapest per product
        sort: 'cheapest', // Sort by cheapest first
      });
      
      if (!Array.isArray(data)) {
        console.error('Invalid data format:', data);
        toast.error('Fiyat verileri beklenmeyen formatta');
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
      
      // If we have prices, center map on them
      if (cheapestPrices.length > 0 && !userLocation) {
        const firstPrice = cheapestPrices[0];
        if (firstPrice.lat && firstPrice.lng) {
          setMapCenter([firstPrice.lat, firstPrice.lng]);
        }
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

  const handleCenterOnUser = async () => {
    try {
      const position = await getCurrentPosition();
      if (position) {
        const location: [number, number] = [position.latitude, position.longitude];
        setUserLocation(location);
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
      <div className="absolute top-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 z-[1000] border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-center font-semibold flex-1">En Düşük Fiyatlı Ürünler</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCenterOnUser}
          className="ml-2"
        >
          <Navigation className="w-4 h-4 mr-1" />
          Konumum
        </Button>
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
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Auto-open popups component */}
            <AutoOpenPopups prices={prices} markerRefs={markerRefs} mapRef={mapRef} />
            
            {/* User Location Marker and Search Radius Circle */}
            {userLocation && (() => {
              // Get user's search radius preference (default: 15 km)
              const searchRadiusKm = (user as any)?.search_radius || 
                                    (user as any)?.preferences?.searchRadius || 
                                    15;
              const searchRadiusMeters = searchRadiusKm * 1000;
              
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
            })()}

            {/* Price Markers - Only cheapest prices per product */}
            {prices.map((price) => {
              if (!price.lat || !price.lng) return null;
              
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
                  position={[price.lat, price.lng]}
                  icon={createPriceIcon(priceText)}
                  eventHandlers={{
                    click: (e) => {
                      // Open popup when marker is clicked
                      const marker = e.target;
                      if (marker && marker.isPopupOpen()) {
                        marker.closePopup();
                      } else {
                        marker.openPopup();
                      }
                      // Also open bottom sheet with details
                      setSelectedPrice(price);
                    },
                  }}
                >
                  <Popup 
                    autoClose={true} 
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
            })}

            <MapCenter center={mapCenter} />
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
