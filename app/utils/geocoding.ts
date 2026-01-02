/**
 * Geocoding utility functions
 * Uses Google Maps Geocoding API (primary) and OpenStreetMap (fallback)
 */

interface GeocodingResult {
  success: boolean;
  address?: string;
  error?: string;
}

/**
 * Detect if we're on mobile (Capacitor)
 */
function isMobile(): boolean {
  return typeof window !== 'undefined' && 
    (window as any).Capacitor?.isNativePlatform() === true;
}

/**
 * Reverse geocoding using Google Maps API (primary) or OpenStreetMap (fallback)
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodingResult> {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  // Try Google Maps first if API key is available
  if (googleApiKey) {
    try {
      const result = await reverseGeocodeGoogle(latitude, longitude, googleApiKey);
      if (result.success) {
        return result;
      }
      console.log('⚠️ Google Maps geocoding failed, trying OpenStreetMap...');
    } catch (error) {
      console.error('Google Maps geocoding error:', error);
      console.log('⚠️ Falling back to OpenStreetMap...');
    }
  } else {
    console.log('⚠️ Google Maps API key not found, using OpenStreetMap...');
  }
  
  // Fallback to OpenStreetMap (works better on web, may have CORS issues on mobile)
  try {
    return await reverseGeocodeOSM(latitude, longitude);
  } catch (error) {
    console.error('OpenStreetMap geocoding error:', error);
    return {
      success: false,
      error: 'Adres bulunamadı',
    };
  }
}

/**
 * Reverse geocoding using Google Maps Geocoding API
 */
async function reverseGeocodeGoogle(
  latitude: number,
  longitude: number,
  apiKey: string
): Promise<GeocodingResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=tr&key=${apiKey}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Google Maps API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.status === 'OK' && data.results && data.results.length > 0) {
    const result = data.results[0];
    const addressComponents = result.address_components || [];
    
    // Extract city and district for Turkey
    let city = '';
    let district = '';
    let mahalle = '';
    
    for (const component of addressComponents) {
      const types = component.types || [];
      
      if (types.includes('locality') || types.includes('administrative_area_level_1')) {
        if (!city) city = component.long_name;
      }
      if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood')) {
        if (!district) district = component.long_name;
      }
      if (types.includes('sublocality_level_2') || types.includes('neighborhood')) {
        if (!mahalle) mahalle = component.long_name;
      }
    }
    
    // Format address
    let locationText = '';
    if (city) {
      if (district && district !== city) {
        locationText = `${city} / ${district}`;
      } else if (mahalle && mahalle !== city) {
        locationText = `${city} / ${mahalle}`;
      } else {
        locationText = city;
      }
    } else if (result.formatted_address) {
      // Fallback to formatted address
      const parts = result.formatted_address.split(',').map((p: string) => p.trim());
      locationText = parts.slice(0, 2).join(' / ');
    }
    
    if (locationText) {
      return {
        success: true,
        address: locationText,
      };
    }
  }
  
  return {
    success: false,
    error: data.status || 'Adres bulunamadı',
  };
}

/**
 * Parse OpenStreetMap response and extract address
 */
function parseOSMResponse(data: any): GeocodingResult {
  if (data.error) {
    return {
      success: false,
      error: data.error,
    };
  }
  
  const address = data.address || {};
  
  // Try multiple strategies to get address
  let locationText = '';
  
  // Strategy 1: City / District format
  const city = address.city || address.town || address.village || address.municipality || address.state;
  const district = address.suburb || address.neighbourhood || address.district || address.county || address.state_district;
  const mahalle = address.quarter || address.neighbourhood;
  
  if (city) {
    if (district && district !== city) {
      locationText = `${city} / ${district}`;
    } else if (mahalle && mahalle !== city) {
      locationText = `${city} / ${mahalle}`;
    } else {
      locationText = city;
    }
  }
  
  // Strategy 2: Parse display_name if city not found
  if (!locationText && data.display_name) {
    const parts = data.display_name.split(',').map((p: string) => p.trim());
    const filteredParts = parts.filter((part: string) => {
      const lower = part.toLowerCase();
      return !lower.includes('türkiye') && 
             !lower.includes('turkey') && 
             !lower.includes('postal') &&
             !lower.match(/^\d+$/);
    });
    
    if (filteredParts.length >= 2) {
      locationText = filteredParts.slice(0, 2).join(' / ');
    } else if (filteredParts.length === 1) {
      locationText = filteredParts[0];
    } else if (parts.length >= 2) {
      locationText = parts.slice(0, 2).join(' / ');
    }
  }
  
  // Strategy 3: Try to extract from any available address field
  if (!locationText) {
    const allAddressFields = [
      address.road,
      address.suburb,
      address.neighbourhood,
      address.village,
      address.town,
      address.city,
      address.state,
    ].filter(Boolean);
    
    if (allAddressFields.length > 0) {
      locationText = allAddressFields.slice(0, 2).join(' / ');
    }
  }
  
  if (locationText) {
    return {
      success: true,
      address: locationText,
    };
  }
  
  return {
    success: false,
    error: 'Adres bulunamadı',
  };
}

/**
 * Reverse geocoding using OpenStreetMap Nominatim API
 */
async function reverseGeocodeOSM(
  latitude: number,
  longitude: number
): Promise<GeocodingResult> {
  // Add delay to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=tr`;
  
  // Check if we're on mobile (Capacitor)
  const isMobile = typeof window !== 'undefined' && 
    (window as any).Capacitor?.isNativePlatform();
  
  try {
    // On mobile, try to use fetch without CORS mode (WebView should handle it)
    // On web, use CORS mode
    const fetchOptions: RequestInit = {
      headers: {
        'User-Agent': 'esnaftaucuz-app/1.0',
      },
    };
    
    // Don't set CORS mode on mobile - WebView should handle it natively
    // On web, we need CORS mode
    if (!isMobile) {
      fetchOptions.mode = 'cors';
    }
    // On mobile, don't set mode at all - let WebView handle it
    
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`OpenStreetMap API error: ${response.status}`);
    }
    
    const data = await response.json();
    return parseOSMResponse(data);
  } catch (error: any) {
    // Handle CORS and network errors
    const errorMessage = error.message || 'Bilinmeyen hata';
    console.error('OpenStreetMap geocoding error:', errorMessage);
    
    // Check if it's a CORS error
    if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      return {
        success: false,
        error: 'CORS hatası: Mobil uygulamada OpenStreetMap API\'sine erişilemiyor. Google Maps API key gerekli.',
      };
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

