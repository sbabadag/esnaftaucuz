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
  user_id?: string | null;
  user?: {
    id?: string;
    name?: string | null;
    shop_name?: string | null;
  } | null;
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

export type ShopTotal = {
  shopId: string | null;
  shopName: string;
  distanceKm: number | null;
  matchedCount: number;
  total: number;
  items: {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  missingCount: number;
  missingNames: string[];
};

/**
 * "Listemi tek dükkandan alırsam en ucuza hangisi?" karşılaştırması.
 * Her dükkan için: listedeki ürünlerin o dükkandaki en düşük fiyatlarının
 * toplamı hesaplanır; dükkanlar ürün kapsamına (matchedCount) ve toplam
 * tutara göre sıralanır.
 */
export function buildShopTotals(
  items: ShoppingItem[],
  prices: ShoppingPrice[],
  origin: Coordinates,
  radiusKm: number,
): ShopTotal[] {
  const safeRadiusKm = Math.max(0, finiteNumber(radiusKm) ?? 0);

  const itemByProductId = new Map<string, ShoppingItem>();
  for (const item of items) {
    if (!itemByProductId.has(item.product.id)) itemByProductId.set(item.product.id, item);
  }

  const expectedUnitByProductId = new Map<string, string>();
  for (const item of items) {
    expectedUnitByProductId.set(
      item.product.id,
      String(item.product.default_unit || '').trim().toLocaleLowerCase('tr'),
    );
  }

  // Dükkan → ürün → { en düşük fiyat, uzaklık, ham fiyat kaydı }
  const byShop = new Map<string | null, {
    shopName: string;
    pricesByProduct: Map<string, { unitPrice: number; distanceKm: number }>;
  }>();

  for (const price of prices) {
    const productId = price.product_id || price.product?.id;
    const item = productId ? itemByProductId.get(productId) : undefined;
    if (!item || price.is_active === false) continue;

    const value = finiteNumber(price.price);
    if (value === null || value <= 0) continue;

    const expectedUnit = expectedUnitByProductId.get(productId as string) || '';
    const unit = String(price.unit || '').trim().toLocaleLowerCase('tr');
    if (expectedUnit && unit && expectedUnit !== unit) continue;

    const coordinates = extractPriceCoordinates(price);
    if (!coordinates) continue;
    const distance = calculateDistanceKm(origin, coordinates);
    if (distance > safeRadiusKm) continue;

    const shopId = price.user_id || null;
    const shopName =
      price.user?.shop_name ||
      price.user?.name ||
      (shopId ? 'Esnaf' : 'Bilinmeyen dükkan');

    let shop = byShop.get(shopId);
    if (!shop) {
      shop = { shopName, pricesByProduct: new Map() };
      byShop.set(shopId, shop);
    }
    if (shop.shopName === 'Esnaf' && shopName !== 'Esnaf') shop.shopName = shopName;

    const existing = shop.pricesByProduct.get(productId as string);
    if (!existing || value < existing.unitPrice) {
      shop.pricesByProduct.set(productId as string, { unitPrice: value, distanceKm: distance });
    }
  }

  const totals: ShopTotal[] = [];
  for (const [shopId, shop] of byShop) {
    const covered: ShopTotal['items'] = [];
    let total = 0;
    let minDistance: number | null = null;
    for (const [productId, entry] of shop.pricesByProduct) {
      const item = itemByProductId.get(productId);
      if (!item) continue;
      const quantity = Math.max(0.01, finiteNumber(item.quantity) ?? 1);
      const lineTotal = entry.unitPrice * quantity;
      total += lineTotal;
      if (minDistance === null || entry.distanceKm < minDistance) {
        minDistance = entry.distanceKm;
      }
      covered.push({
        productId,
        name: item.product.name,
        quantity,
        unitPrice: entry.unitPrice,
        lineTotal,
      });
    }
    const missing = items.filter((i) => !shop.pricesByProduct.has(i.product.id));
    totals.push({
      shopId,
      shopName: shop.shopName,
      distanceKm: minDistance,
      matchedCount: covered.length,
      total,
      items: covered,
      missingCount: missing.length,
      missingNames: missing.map((m) => m.product.name),
    });
  }

  totals.sort(
    (a, b) =>
      b.matchedCount - a.matchedCount ||
      a.total - b.total ||
      (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY),
  );

  return totals;
}
