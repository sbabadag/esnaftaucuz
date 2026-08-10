/**
 * Parse PostgreSQL POINT / GeoJSON-like coordinates into lat/lng.
 * POINT strings are stored as (lng,lat).
 */
export function parseLatLng(coords: unknown): { lat: number; lng: number } | null {
  if (!coords) return null;

  if (typeof coords === 'string') {
    const match = coords.match(/\(([^,]+),([^)]+)\)/);
    if (!match) return null;
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  if (typeof coords === 'object') {
    const c = coords as Record<string, unknown>;
    if (typeof c.lat === 'number' && typeof c.lng === 'number') {
      if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null;
      return { lat: c.lat, lng: c.lng };
    }
    if (typeof c.x === 'number' && typeof c.y === 'number') {
      // PostgreSQL POINT object: x=lng, y=lat
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
      return { lat: c.y, lng: c.x };
    }
  }

  return null;
}

/** Attach normalized lat/lng on a price row (from price.coordinates or location.coordinates). */
export function normalizePriceCoordinates<T extends Record<string, any>>(price: T): T & {
  lat?: number;
  lng?: number;
} {
  const fromPrice = parseLatLng(price?.coordinates);
  if (fromPrice) {
    return { ...price, lat: fromPrice.lat, lng: fromPrice.lng };
  }
  const fromLocation = parseLatLng(price?.location?.coordinates);
  if (fromLocation) {
    return { ...price, lat: fromLocation.lat, lng: fromLocation.lng };
  }
  return price;
}
