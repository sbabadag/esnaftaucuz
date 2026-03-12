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
        coordinates,
        product_id,
        location_id,
        user_id,
        location:locations(id,name,type,city,district,coordinates),
        user:users(id,name,avatar)
      `)
      .eq('product_id', productId)
      .eq('is_active', true)
      .limit(limit);

    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'verified') {
      query = query.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('price', { ascending: true }).order('created_at', { ascending: false });
    }

    const { data: prices, error: pricesError } = await query;
    if (pricesError) return jsonResponse(200, { ok: false, reason: pricesError.message });

    return jsonResponse(200, {
      ok: true,
      product,
      prices: (prices || []).map((row: any) => ({
        ...row,
        product,
        price: typeof row?.price === 'number' ? row.price : Number(row?.price || 0),
      })),
    });
  } catch (error) {
    console.error('product-detail-feed error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
