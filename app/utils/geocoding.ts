/**
 * Geocoding utility functions
 * Supports both Google Maps Geocoding API and OpenStreetMap Nominatim as fallback
 */

interface GeocodingResult {
  success: boolean;
  address?: string;
  error?: string;
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
  }
  
  // Fallback to OpenStreetMap
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
 * Reverse geocoding using OpenStreetMap Nominatim API
 */
async function reverseGeocodeOSM(
  latitude: number,
  longitude: number
): Promise<GeocodingResult> {
  // Add delay to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=tr`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'esnaftaucuz-app/1.0',
    },
  });
  
  if (!response.ok) {
    throw new Error(`OpenStreetMap API error: ${response.status}`);
  }
  
  const data = await response.json();
  
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

