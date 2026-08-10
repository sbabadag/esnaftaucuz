/**
 * Keep merchant shop pins on the geocoded shop address (not last GPS capture).
 */
import { forwardGeocode } from '../utils/geocoding';
import { safeGetSession } from './supabase';

export type ShopCoords = { lat: number; lng: number };

async function authHeaders(): Promise<Record<string, string> | null> {
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!sbKey) return null;
  const { accessToken } = await safeGetSession();
  const token = accessToken || sbKey;
  return {
    apikey: sbKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function buildMerchantAddressQuery(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
  return [input.address, input.district, input.city]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
}

export async function geocodeMerchantShopAddress(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
}): Promise<{ coords: ShopCoords; formattedAddress?: string } | null> {
  const query = buildMerchantAddressQuery(input);
  if (query.length < 3) return null;
  try {
    const result = await forwardGeocode(query);
    if (result?.success && result.coordinates) {
      return {
        coords: result.coordinates,
        formattedAddress: result.address || query,
      };
    }
  } catch (err) {
    console.warn('geocodeMerchantShopAddress failed:', err);
  }
  return null;
}

/**
 * Persist shop coords on user.location, locations row, merchant_products, and prices feed.
 * Best-effort: never throws to callers.
 */
export async function syncMerchantShopCoordinates(input: {
  merchantId: string;
  coords: ShopCoords;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  locationName?: string | null;
}): Promise<{ updated: boolean; reason?: string }> {
  try {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL as string;
    if (!sbUrl) return { updated: false, reason: 'missing-env' };
    const headers = await authHeaders();
    if (!headers) return { updated: false, reason: 'missing-auth' };

    const point = `(${input.coords.lng},${input.coords.lat})`;
    const addressText =
      String(input.address || '').trim() ||
      [input.district, input.city].map((p) => String(p || '').trim()).filter(Boolean).join(', ');

    try {
      const userResp = await fetch(
        `${sbUrl}/rest/v1/users?id=eq.${encodeURIComponent(input.merchantId)}&select=location`,
        { headers }
      );
      const rows = userResp.ok ? await userResp.json().catch(() => []) : [];
      const prevLoc =
        Array.isArray(rows) && rows[0]?.location && typeof rows[0].location === 'object'
          ? rows[0].location
          : {};
      await fetch(`${sbUrl}/rest/v1/users?id=eq.${encodeURIComponent(input.merchantId)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          location: {
            ...prevLoc,
            city: input.city || prevLoc.city || null,
            district: input.district || prevLoc.district || null,
            coordinates: { lat: input.coords.lat, lng: input.coords.lng },
          },
        }),
      });
    } catch (err) {
      console.warn('syncMerchantShopCoordinates: user location patch failed', err);
    }

    let locationId: string | null = null;
    try {
      const mpResp = await fetch(
        `${sbUrl}/rest/v1/merchant_products?merchant_id=eq.${encodeURIComponent(input.merchantId)}&select=location_id&location_id=not.is.null&limit=1`,
        { headers }
      );
      if (mpResp.ok) {
        const mpRows = await mpResp.json().catch(() => []);
        if (Array.isArray(mpRows) && mpRows[0]?.location_id) {
          locationId = String(mpRows[0].location_id);
        }
      }
    } catch {
      /* continue */
    }

    if (locationId) {
      await fetch(`${sbUrl}/rest/v1/locations?id=eq.${encodeURIComponent(locationId)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          ...(input.locationName ? { name: input.locationName } : {}),
          ...(addressText ? { address: addressText } : {}),
          coordinates: point,
          city: input.city || null,
          district: input.district || null,
        }),
      });
    } else {
      const locResp = await fetch(`${sbUrl}/rest/v1/locations?select=id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          name: input.locationName || 'Esnaf Dükkanı',
          type: 'market',
          address: addressText || input.locationName || 'Esnaf Dükkanı',
          coordinates: point,
          city: input.city || null,
          district: input.district || null,
        }),
      });
      if (locResp.ok) {
        const created = await locResp.json().catch(() => []);
        locationId = Array.isArray(created) && created[0]?.id ? String(created[0].id) : null;
      }
    }

    const mpPatch: Record<string, unknown> = { coordinates: point };
    if (locationId) mpPatch.location_id = locationId;
    await fetch(
      `${sbUrl}/rest/v1/merchant_products?merchant_id=eq.${encodeURIComponent(input.merchantId)}`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(mpPatch),
      }
    );

    const pricePatch: Record<string, unknown> = { coordinates: point };
    if (locationId) pricePatch.location_id = locationId;
    await fetch(
      `${sbUrl}/rest/v1/prices?user_id=eq.${encodeURIComponent(input.merchantId)}`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(pricePatch),
      }
    );

    return { updated: true };
  } catch (error: any) {
    console.warn('syncMerchantShopCoordinates error:', error);
    return { updated: false, reason: error?.message || 'error' };
  }
}
