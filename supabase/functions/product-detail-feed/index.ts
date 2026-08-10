import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type Body = {
  product_id?: string;
  sort_by?: 'cheapest' | 'newest' | 'verified';
  limit?: number;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const getServiceClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service role env vars');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

const isPublicImageUrl = (raw: unknown): string | null => {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  if (/localhost|_capacitor_file_|127\.0\.0\.1|^blob:|^data:/i.test(value)) return null;
  return value;
};

const normalizePhotos = (...sources: unknown[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const list = Array.isArray(source)
      ? source
      : typeof source === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(source);
              return Array.isArray(parsed) ? parsed : [source];
            } catch {
              return [source];
            }
          })()
        : source
          ? [source]
          : [];
    for (const item of list) {
      const url = isPublicImageUrl(item);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const productId = String(body?.product_id || '').trim();
    const sortBy = (body?.sort_by || 'cheapest') as 'cheapest' | 'newest' | 'verified';
    const limit = Math.min(Math.max(Number(body?.limit || 50), 1), 200);

    if (!productId) return jsonResponse(400, { error: 'Missing product_id' });

    const client = getServiceClient();

    const { data: product, error: productError } = await client
      .from('products')
      .select('id,name,category,image,default_unit')
      .eq('id', productId)
      .maybeSingle();

    if (productError || !product) {
      return jsonResponse(200, { ok: false, reason: 'Product not found' });
    }

    let query = client
      .from('prices')
      .select(`
        id,
        price,
        unit,
        created_at,
        is_verified,
        photo,
        photos,
        coordinates,
        product_id,
        location_id,
        user_id,
        location:locations(id,name,type,city,district,coordinates),
        user:users(id,name,avatar)
      `)
      .eq('product_id', productId)
      .or('is_active.eq.true,is_active.is.null')
      .limit(limit);

    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'verified') {
      query = query.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('price', { ascending: true }).order('created_at', { ascending: false });
    }

    let { data: prices, error: pricesError } = await query;
    // Older DBs may not have prices.photos yet.
    if (pricesError && /photos/i.test(String(pricesError.message || ''))) {
      let legacy = client
        .from('prices')
        .select(`
          id,
          price,
          unit,
          created_at,
          is_verified,
          photo,
          coordinates,
          product_id,
          location_id,
          user_id,
          location:locations(id,name,type,city,district,coordinates),
          user:users(id,name,avatar)
        `)
        .eq('product_id', productId)
        .or('is_active.eq.true,is_active.is.null')
        .limit(limit);
      if (sortBy === 'newest') {
        legacy = legacy.order('created_at', { ascending: false });
      } else if (sortBy === 'verified') {
        legacy = legacy.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
      } else {
        legacy = legacy.order('price', { ascending: true }).order('created_at', { ascending: false });
      }
      const retry = await legacy;
      prices = retry.data;
      pricesError = retry.error;
    }
    if (pricesError) return jsonResponse(200, { ok: false, reason: pricesError.message });

    const priceRows = prices || [];
    const userIds = Array.from(new Set(priceRows.map((r: any) => r.user_id).filter(Boolean)));

    const merchantImageMap = new Map<string, string[]>();
    if (userIds.length > 0) {
      const { data: merchantRows } = await client
        .from('merchant_products')
        .select('merchant_id, product_id, images')
        .eq('product_id', productId)
        .in('merchant_id', userIds);
      for (const row of merchantRows || []) {
        const key = String(row.merchant_id);
        merchantImageMap.set(key, normalizePhotos(row.images));
      }
    }

    const enrichedPrices = priceRows.map((row: any) => {
      const merchantImages = merchantImageMap.get(String(row.user_id)) || [];
      const photos = normalizePhotos(row.photos, merchantImages, row.photo);
      return {
        ...row,
        product,
        price: typeof row?.price === 'number' ? row.price : Number(row?.price || 0),
        photos,
        photo: photos[0] || row.photo || null,
      };
    });

    const allPhotos = normalizePhotos(
      ...enrichedPrices.map((r: any) => r.photos),
      product.image,
    );

    return jsonResponse(200, {
      ok: true,
      product: {
        ...product,
        image: allPhotos[0] || product.image || null,
      },
      prices: enrichedPrices,
      all_photos: allPhotos,
    });
  } catch (error) {
    console.error('product-detail-feed error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
