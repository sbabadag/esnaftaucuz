/**
 * Google Places API utility functions
 * Fetches nearby businesses (shops, stores, merchants) using Google Places API
 */

interface Place {
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
  price_level?: number;
  photos?: Array<{
    photo_reference: string;
    width: number;
    height: number;
  }>;
  opening_hours?: {
    open_now?: boolean;
  };
}

interface PlacesResult {
  success: boolean;
  places?: Place[];
  error?: string;
}

/**
 * Search for nearby businesses using Google Places API
 * @param latitude - User's latitude
 * @param longitude - User's longitude
 * @param radius - Search radius in meters (default: 2000m = 2km)
 * @param types - Place types to search for (default: store, shop, establishment)
 */
export async function searchNearbyPlaces(
  latitude: number,
  longitude: number,
  radius: number = 2000,
  types: string[] = ['store', 'shop', 'establishment', 'supermarket', 'grocery_or_supermarket']
): Promise<PlacesResult> {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!googleApiKey || googleApiKey.trim() === '') {
    console.error('❌ Google Maps API key not found! Please check vite.config.ts');
    return {
      success: false,
      error: 'Google Maps API key bulunamadı. Lütfen yöneticiye bildirin.',
    };
  }

  try {
    // Use Places API Nearby Search
    const typesParam = types.join('|');
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=${typesParam}&language=tr&key=${googleApiKey}`;
    
    console.log('🔍 Searching for nearby places...', { latitude, longitude, radius, types });
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('❌ Google Places API HTTP error:', response.status, errorText);
      return {
        success: false,
        error: `Google Places API HTTP error: ${response.status}`,
      };
    }
    
    const data = await response.json();
    
    if (data.status === 'REQUEST_DENIED') {
      console.error('❌ Google Places API: REQUEST_DENIED', data.error_message);
      return {
        success: false,
        error: `API key hatası: ${data.error_message || 'REQUEST_DENIED'}`,
      };
    }
    
    if (data.status === 'ZERO_RESULTS') {
      console.warn('⚠️ Google Places API: ZERO_RESULTS');
      return {
        success: true,
        places: [],
      };
    }
    
    if (data.status === 'OK' && data.results) {
      console.log(`✅ Found ${data.results.length} nearby places`);
      return {
        success: true,
        places: data.results,
      };
    }
    
    console.error('❌ Google Places API error status:', data.status, data.error_message);
    return {
      success: false,
      error: data.error_message || data.status || 'İşletmeler bulunamadı',
    };
  } catch (error: any) {
    console.error('❌ Google Places API error:', error);
    return {
      success: false,
      error: error.message || 'İşletmeler yüklenirken bir hata oluştu',
    };
  }
}

/**
 * Get place details by place_id
 */
export async function getPlaceDetails(placeId: string): Promise<Place | null> {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!googleApiKey || googleApiKey.trim() === '') {
    console.error('❌ Google Maps API key not found!');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,types,rating,user_ratings_total,opening_hours,photos&language=tr&key=${googleApiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('❌ Google Places Details API HTTP error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      return data.result;
    }
    
    return null;
  } catch (error: any) {
    console.error('❌ Google Places Details API error:', error);
    return null;
  }
}

