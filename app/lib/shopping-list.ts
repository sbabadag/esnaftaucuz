export type Coordinates = { lat: number; lng: number };

export type ShoppingProduct = {
  id: string;
  name: string;
  category?: string;
  image?: string;
  default_unit?: string;
};

export type ShoppingItem = {
  product: ShoppingProduct;
  quantity: number;
};

export type ShoppingPrice = {
  id?: string;
  product_id?: string;
  product?: { id?: string } | null;
  price?: number | string;
  unit?: string;
  is_active?: boolean | null;
  lat?: number | string;
  lng?: number | string;
  coordinates?: unknown;
  location?: {
    id?: string;
    name?: string;
    city?: string;
    district?: string;
    coordinates?: unknown;
    lat?: number | string;
    lng?: number | string;
  } | null;
  created_at?: string;
  is_verified?: boolean;
};

export type ShoppingComparisonResult = {
  item: ShoppingItem;
  cheapest: ShoppingPrice | null;
  distanceKm: number | null;
  lineTotal: number | null;
};

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCoordinates(value: unknown): Coordinates | null {
  if (typeof value === 'string') {
    const match = value.match(/^\s*\(([^,]+),([^)]+)\)\s*$/);
    if (!match) return null;
    const lng = finiteNumber(match[1]);
    const lat = finiteNumber(match[2]);
    return lat === null || lng === null ? null : { lat, lng };
  }

  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const lat = finiteNumber(record.lat ?? record.y);
  const lng = finiteNumber(record.lng ?? record.x);
  return lat === null || lng === null ? null : { lat, lng };
}

export function extractPriceCoordinates(price: ShoppingPrice): Coordinates | null {
  const directLat = finiteNumber(price.lat);
  const directLng = finiteNumber(price.lng);
  if (directLat !== null && directLng !== null) {
    return { lat: directLat, lng: directLng };
  }

  const direct = parseCoordinates(price.coordinates);
  if (direct) return direct;

  const locationLat = finiteNumber(price.location?.lat);
  const locationLng = finiteNumber(price.location?.lng);
  if (locationLat !== null && locationLng !== null) {
    return { lat: locationLat, lng: locationLng };
  }

  return parseCoordinates(price.location?.coordinates);
}

export function calculateDistanceKm(from: Coordinates, to: Coordinates): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const latitude1 = toRadians(from.lat);
  const latitude2 = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function buildShoppingComparison(
  items: ShoppingItem[],
  prices: ShoppingPrice[],
  origin: Coordinates,
  radiusKm: number,
): { results: ShoppingComparisonResult[]; total: number; missingCount: number } {
  const safeRadiusKm = Math.max(0, finiteNumber(radiusKm) ?? 0);

  const results = items.map((item): ShoppingComparisonResult => {
    const productId = item.product.id;
    const expectedUnit = String(item.product.default_unit || '').trim().toLocaleLowerCase('tr');
    let cheapest: ShoppingPrice | null = null;
    let cheapestDistance: number | null = null;

    for (const price of prices) {
      const candidateProductId = price.product_id || price.product?.id;
      if (candidateProductId !== productId || price.is_active === false) continue;

      const value = finiteNumber(price.price);
      if (value === null || value <= 0) continue;

      const unit = String(price.unit || '').trim().toLocaleLowerCase('tr');
      if (expectedUnit && unit && expectedUnit !== unit) continue;

      const coordinates = extractPriceCoordinates(price);
      if (!coordinates) continue;
      const distance = calculateDistanceKm(origin, coordinates);
      if (distance > safeRadiusKm) continue;

      const currentValue = finiteNumber(cheapest?.price);
      if (
        currentValue === null ||
        value < currentValue ||
        (value === currentValue && distance < (cheapestDistance ?? Number.POSITIVE_INFINITY))
      ) {
        cheapest = price;
        cheapestDistance = distance;
      }
    }

    if (!cheapest) {
      return { item, cheapest: null, distanceKm: null, lineTotal: null };
    }

    const quantity = Math.max(0.01, finiteNumber(item.quantity) ?? 1);
    return {
      item,
      cheapest,
      distanceKm: cheapestDistance,
      lineTotal: (finiteNumber(cheapest.price) ?? 0) * quantity,
    };
  });

  return {
    results,
    total: results.reduce((sum, result) => sum + (result.lineTotal ?? 0), 0),
    missingCount: results.filter((result) => !result.cheapest).length,
  };
}
