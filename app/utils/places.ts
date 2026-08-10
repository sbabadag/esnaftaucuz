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
    // Leaflet map still works without Places; avoid alarming console.error spam.
    console.warn('VITE_GOOGLE_MAPS_API_KEY missing — nearby business markers skipped');
    return {
      success: false,
      error: 'Google Maps API key bulunamadı. Lütfen yöneticiye bildirin.',
    };
  }

  try {
    // Legacy Nearby Search accepts only ONE `type`. Extra values joined with "|"
    // are invalid and can yield empty/denied results.
    const primaryType = (types && types.length > 0 ? types[0] : 'store') || 'store';
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${Math.min(Math.max(radius, 100), 50000)}&type=${encodeURIComponent(primaryType)}&language=tr&key=${googleApiKey}`;
    
    console.log('🔍 Searching for nearby places...', { latitude, longitude, radius, type: primaryType });
    
    // For Capacitor apps, use fetch with mode: 'no-cors' or handle CORS gracefully
    // CORS errors in Capacitor webview should be caught and handled
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    } catch (fetchError: any) {
      // CORS error or network error - common in Capacitor webview
      if (fetchError.message?.includes('CORS') || fetchError.message?.includes('Failed to fetch')) {
        console.warn('⚠️ CORS error when fetching places (common in Capacitor). Skipping business markers.');
        // Return empty result instead of error - this is a non-critical feature
        return {
          success: true,
          places: [],
        };
      }
      throw fetchError;
    }
    
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
        error: 'Yakındaki işletmeler şu an yüklenemiyor.',
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
    // Handle CORS errors gracefully - this is common in Capacitor webview
    if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch') || error.message?.includes('Access-Control-Allow-Origin')) {
      console.warn('⚠️ CORS error when fetching places (common in Capacitor). Skipping business markers.');
      // Return empty result instead of error - this is a non-critical feature
      return {
        success: true,
        places: [],
      };
    }
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
    console.warn('VITE_GOOGLE_MAPS_API_KEY missing — place details skipped');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,types,rating,user_ratings_total,opening_hours,photos&language=tr&key=${googleApiKey}`;
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    } catch (fetchError: any) {
      // CORS error - common in Capacitor webview
      if (fetchError.message?.includes('CORS') || fetchError.message?.includes('Failed to fetch')) {
        console.warn('⚠️ CORS error when fetching place details. Skipping.');
        return null;
      }
      throw fetchError;
    }
    
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
    // Handle CORS errors gracefully
    if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch') || error.message?.includes('Access-Control-Allow-Origin')) {
      console.warn('⚠️ CORS error when fetching place details. Skipping.');
      return null;
    }
    console.error('❌ Google Places Details API error:', error);
    return null;
  }
}

