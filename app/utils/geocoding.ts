/**
 * Geocoding utility functions
 * Uses ONLY Google Maps Geocoding API - OpenStreetMap is NOT used
 */

interface GeocodingResult {
  success: boolean;
  address?: string;
  error?: string;
}

interface ForwardGeocodingResult {
  success: boolean;
  lat?: number;
  lng?: number;
  address?: string;
  error?: string;
}

/**
 * Reverse geocoding using Google Maps API ONLY
 * OpenStreetMap fallback removed - Google Maps API key is required
 */
// Fallback API key for web builds (if env var is not available)
const FALLBACK_API_KEY = 'AIzaSyCGRGdSA0IZHxgGI4PCv00kQ8xJ5dpx7Gc';

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodingResult> {
  // Try to get API key from environment, fallback to hardcoded key for web
  let googleApiKey: string | undefined;
  
  try {
    googleApiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;
  } catch (e) {
    console.warn('⚠️ import.meta.env not available, using fallback API key');
  }
  
  // Use fallback if env var is missing or empty
  if (!googleApiKey || googleApiKey.trim() === '') {
    console.warn('⚠️ VITE_GOOGLE_MAPS_API_KEY not found in env, using fallback key');
    googleApiKey = FALLBACK_API_KEY;
  }
  
  // Debug: Log API key status
  console.log('🔑 Google Maps API Key Check:', {
    exists: !!googleApiKey,
    length: googleApiKey?.length || 0,
    firstChars: googleApiKey?.substring(0, 10) || 'N/A',
    source: import.meta.env?.VITE_GOOGLE_MAPS_API_KEY ? 'env' : 'fallback',
  });
  
  // Final check - API key must exist
  if (!googleApiKey || googleApiKey.trim() === '') {
    console.error('❌ Google Maps API key not found!', {
      googleApiKey,
      env: import.meta.env,
    });
    return {
      success: false,
      error: 'Google Maps API key bulunamadı. Lütfen .env dosyasına VITE_GOOGLE_MAPS_API_KEY ekleyin.',
    };
  }
  
  // Use Google Maps API - Retry up to 3 times on failure
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Google Maps geocoding attempt ${attempt}/${maxRetries}...`);
      const result = await reverseGeocodeGoogle(latitude, longitude, googleApiKey);
      
      if (result.success) {
        console.log('✅ Google Maps geocoding successful');
        return result;
      }
      
      // If not successful, store error and retry
      lastError = result.error;
      console.warn(`⚠️ Google Maps geocoding attempt ${attempt} failed:`, result.error);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Google Maps geocoding attempt ${attempt} error:`, error);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed - return error (NEVER use OpenStreetMap)
  console.error('❌ Google Maps geocoding failed after all retries');
  return {
    success: false,
    error: lastError?.message || lastError || 'Google Maps API hatası - Tüm denemeler başarısız oldu',
  };
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
  
  console.log('🌐 Google Maps API request:', { latitude, longitude, apiKeyLength: apiKey?.length || 0 });
  
  let response: Response;
  try {
    response = await fetch(url);
  } catch (fetchError: any) {
    console.error('❌ Google Maps API fetch error:', fetchError);
    throw new Error(`Network error: ${fetchError.message || 'Failed to fetch'}`);
  }
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('❌ Google Maps API HTTP error:', response.status, errorText);
    throw new Error(`Google Maps API HTTP error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('📥 Google Maps API response:', { status: data.status, resultsCount: data.results?.length || 0 });
  
  // Handle API errors
  if (data.status === 'REQUEST_DENIED') {
    console.error('❌ Google Maps API: REQUEST_DENIED', data.error_message);
    return {
      success: false,
      error: `API key hatası: ${data.error_message || 'REQUEST_DENIED'}`,
    };
  }
  
  if (data.status === 'OVER_QUERY_LIMIT') {
    console.error('❌ Google Maps API: OVER_QUERY_LIMIT');
    return {
      success: false,
      error: 'API kotası aşıldı. Lütfen daha sonra tekrar deneyin.',
    };
  }
  
  if (data.status === 'ZERO_RESULTS') {
    console.warn('⚠️ Google Maps API: ZERO_RESULTS');
    return {
      success: false,
      error: 'Bu konum için adres bulunamadı',
    };
  }
  
  if (data.status === 'OK' && data.results && data.results.length > 0) {
    const result = data.results[0];
    const addressComponents = result.address_components || [];
    
    // Extract detailed address components for Turkey
    let city = '';
    let district = '';
    let mahalle = '';
    let sokak = '';
    let sokakNo = '';
    
    for (const component of addressComponents) {
      const types = component.types || [];
      
      // City (Şehir)
      if (types.includes('locality')) {
        if (!city) city = component.long_name;
      }
      // Administrative area level 1 (İl)
      if (types.includes('administrative_area_level_1') && !city) {
        city = component.long_name;
      }
      // District (İlçe)
      if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
        if (!district) district = component.long_name;
      }
      // Neighborhood/Mahalle
      if (types.includes('sublocality_level_2') || types.includes('neighborhood')) {
        if (!mahalle) mahalle = component.long_name;
      }
      // Street (Sokak)
      if (types.includes('route')) {
        if (!sokak) sokak = component.long_name;
      }
      // Street number (Sokak numarası)
      if (types.includes('street_number')) {
        if (!sokakNo) sokakNo = component.long_name;
      }
    }
    
    // Build detailed address: Mahalle, Sokak SokakNo, İlçe, Şehir
    const addressParts: string[] = [];
    
    if (mahalle && mahalle !== district && mahalle !== city) {
      addressParts.push(mahalle);
    }
    
    if (sokak) {
      const sokakText = sokakNo ? `${sokak} ${sokakNo}` : sokak;
      addressParts.push(sokakText);
    }
    
    if (district && district !== city) {
      addressParts.push(district);
    }
    
    if (city) {
      addressParts.push(city);
    }
    
    // Format address
    let locationText = '';
    if (addressParts.length > 0) {
      locationText = addressParts.join(', ');
    } else if (result.formatted_address) {
      // Fallback to formatted address if components are not available
      locationText = result.formatted_address;
    }
    
    if (locationText) {
      console.log('📍 Parsed address components:', { city, district, mahalle, sokak, sokakNo, locationText });
      return {
        success: true,
        address: locationText,
      };
    }
  }
  
  // If we get here, status is not OK
  console.error('❌ Google Maps API error status:', data.status, data.error_message);
  return {
    success: false,
    error: data.error_message || data.status || 'Adres bulunamadı',
  };
}

/**
 * Forward geocoding - Convert address text to coordinates using Google Maps API
 */
export async function forwardGeocode(
  address: string
): Promise<ForwardGeocodingResult> {
  // Try to get API key from environment, fallback to hardcoded key for web
  let googleApiKey: string | undefined;
  
  try {
    googleApiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;
  } catch (e) {
    console.warn('⚠️ import.meta.env not available, using fallback API key');
  }
  
  // Use fallback if env var is missing or empty
  if (!googleApiKey || googleApiKey.trim() === '') {
    console.warn('⚠️ VITE_GOOGLE_MAPS_API_KEY not found in env, using fallback key');
    googleApiKey = FALLBACK_API_KEY;
  }
  
  // Final check - API key must exist
  if (!googleApiKey || googleApiKey.trim() === '') {
    console.error('❌ Google Maps API key not found!');
    return {
      success: false,
      error: 'Google Maps API key bulunamadı. Lütfen .env dosyasına VITE_GOOGLE_MAPS_API_KEY ekleyin.',
    };
  }

  // Use Google Maps API - Retry up to 3 times on failure
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Google Maps forward geocoding attempt ${attempt}/${maxRetries} for: "${address}"`);
      const result = await forwardGeocodeGoogle(address, googleApiKey);
      
      if (result.success) {
        console.log('✅ Google Maps forward geocoding successful');
        return result;
      }
      
      // If not successful, store error and retry
      lastError = result.error;
      console.warn(`⚠️ Google Maps forward geocoding attempt ${attempt} failed:`, result.error);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Google Maps forward geocoding attempt ${attempt} error:`, error);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  console.error('❌ Google Maps forward geocoding failed after all retries');
  return {
    success: false,
    error: lastError?.message || lastError || 'Google Maps API hatası - Tüm denemeler başarısız oldu',
  };
}

/**
 * Forward geocoding using Google Maps Geocoding API
 */
async function forwardGeocodeGoogle(
  address: string,
  apiKey: string
): Promise<ForwardGeocodingResult> {
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&language=tr&key=${apiKey}`;
  
  console.log('🌐 Google Maps forward geocoding API request:', { address, apiKeyLength: apiKey?.length || 0 });
  
  let response: Response;
  try {
    response = await fetch(url);
  } catch (fetchError: any) {
    console.error('❌ Google Maps API fetch error:', fetchError);
    throw new Error(`Network error: ${fetchError.message || 'Failed to fetch'}`);
  }
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('❌ Google Maps API HTTP error:', response.status, errorText);
    throw new Error(`Google Maps API HTTP error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('📥 Google Maps forward geocoding API response:', { status: data.status, resultsCount: data.results?.length || 0 });
  
  // Handle API errors
  if (data.status === 'REQUEST_DENIED') {
    console.error('❌ Google Maps API: REQUEST_DENIED', data.error_message);
    return {
      success: false,
      error: `API key hatası: ${data.error_message || 'REQUEST_DENIED'}`,
    };
  }
  
  if (data.status === 'OVER_QUERY_LIMIT') {
    console.error('❌ Google Maps API: OVER_QUERY_LIMIT');
    return {
      success: false,
      error: 'API kotası aşıldı. Lütfen daha sonra tekrar deneyin.',
    };
  }
  
  if (data.status === 'ZERO_RESULTS') {
    console.warn('⚠️ Google Maps API: ZERO_RESULTS');
    return {
      success: false,
      error: 'Bu adres için konum bulunamadı',
    };
  }
  
  if (data.status === 'OK' && data.results && data.results.length > 0) {
    const result = data.results[0];
    const location = result.geometry?.location;
    
    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      console.log('📍 Forward geocoding successful:', { lat: location.lat, lng: location.lng, address: result.formatted_address });
      return {
        success: true,
        lat: location.lat,
        lng: location.lng,
        address: result.formatted_address || address,
      };
    }
  }
  
  // If we get here, status is not OK or location is invalid
  console.error('❌ Google Maps forward geocoding error status:', data.status, data.error_message);
  return {
    success: false,
    error: data.error_message || data.status || 'Konum bulunamadı',
  };
}


