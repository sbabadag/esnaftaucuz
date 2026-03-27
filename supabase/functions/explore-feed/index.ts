import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const getServiceClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service role env vars');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const client = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const limitRecent = Number(body?.limitRecent || 20);
    const limitTrending = Number(body?.limitTrending || 12);
    const limitShops = Number(body?.limitShops || 20);

    // Son fiyatlar: is_active filtresi kullanma — DB'de cok kayit false/null legacy ise liste bos kaliyordu.
    const { data: recentRows, error: recentError } = await client
      .from('prices')
      .select('id, product_id, location_id, price, unit, created_at, is_verified, photo, coordinates, is_active')
      .order('created_at', { ascending: false })
      .limit(limitRecent);

    if (recentError) {
      return jsonResponse(200, { ok: false, error: `recent_prices_failed: ${recentError.message}` });
    }

    const rows = recentRows || [];
    const productIds = Array.from(new Set(rows.map((r: any) => r.product_id).filter(Boolean)));
    const locationIds = Array.from(new Set(rows.map((r: any) => r.location_id).filter(Boolean)));

    const [{ data: productsRows }, { data: locationsRows }, { data: trendingRows }, { data: shopProductRows }] = await Promise.all([
      productIds.length
        ? client.from('products').select('id, name, category, default_unit, image').in('id', productIds)
        : Promise.resolve({ data: [] as any[] }),
      locationIds.length
        ? client.from('locations').select('id, name, type, city, district, coordinates').in('id', locationIds)
        : Promise.resolve({ data: [] as any[] }),
      client
        .from('products')
        .select('id, name, category, image')
        .order('search_count', { ascending: false })
        .limit(limitTrending),
      client
        .from('merchant_products')
        .select(`
          merchant_id,
          coordinates,
          merchant:users!merchant_products_merchant_id_fkey(id, name, avatar, is_merchant)
        `)
        .or('is_active.eq.true,is_active.is.null')
        .order('created_at', { ascending: false })
        .limit(limitShops * 5),
    ]);

    const productsById = new Map((productsRows || []).map((p: any) => [p.id, p]));
    const locationsById = new Map((locationsRows || []).map((l: any) => [l.id, l]));

    const recent = rows.map((row: any) => ({
      ...row,
      product: row.product_id ? productsById.get(row.product_id) || null : null,
      location: row.location_id ? locationsById.get(row.location_id) || null : null,
    }));

    const merchantMap = new Map<string, any>();
    (shopProductRows || []).forEach((row: any) => {
      const merchant = row?.merchant;
      const merchantId = merchant?.id || row?.merchant_id;
      if (!merchantId || merchantMap.has(merchantId)) return;
      merchantMap.set(merchantId, {
        id: merchantId,
        name: merchant?.name || 'Esnaf',
        avatar: merchant?.avatar || null,
        is_merchant: merchant?.is_merchant === true,
        coordinates: row?.coordinates || null,
      });
    });

    return jsonResponse(200, {
      ok: true,
      recentPrices: recent,
      trendProducts: trendingRows || [],
      merchantShops: Array.from(merchantMap.values()),
    });
  } catch (error) {
    console.error('explore-feed error:', error);
    return jsonResponse(500, { ok: false, error: (error as Error).message || 'Internal error' });
  }
});

