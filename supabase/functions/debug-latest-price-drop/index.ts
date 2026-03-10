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

    const { data: latestPrice, error: latestPriceError } = await client
      .from('prices')
      .select('id,product_id,user_id,price,is_active,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPriceError || !latestPrice) {
      return jsonResponse(200, { ok: false, stage: 'latest_price', error: latestPriceError?.message || 'No price rows found' });
    }

    const { data: prevMinRow } = await client
      .from('prices')
      .select('id,price,user_id,created_at')
      .eq('product_id', latestPrice.product_id)
      .eq('is_active', true)
      .neq('id', latestPrice.id)
      .order('price', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: favoritesRows } = await client
      .from('user_favorites')
      .select('user_id')
      .eq('product_id', latestPrice.product_id);

    const favoriteUserIds = Array.from(
      new Set((favoritesRows || []).map((r: any) => r?.user_id).filter((x: any) => typeof x === 'string' && x.length > 0)),
    );

    const recipientCandidates = favoriteUserIds.filter((id) => id !== latestPrice.user_id);

    const { data: existingNotifs } = await client
      .from('notifications')
      .select('id,user_id,type,price_id,created_at')
      .eq('price_id', latestPrice.id)
      .eq('type', 'price_drop');

    const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/notify-price-drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_id: latestPrice.id }),
    });
    const invokeJson = await invokeRes.json().catch(() => ({}));

    const { data: notifsAfterInvoke } = await client
      .from('notifications')
      .select('id,user_id,type,price_id,created_at')
      .eq('price_id', latestPrice.id)
      .eq('type', 'price_drop');

    return jsonResponse(200, {
      ok: true,
      latest_price: latestPrice,
      previous_min_price_row: prevMinRow || null,
      is_strict_price_drop: !!(prevMinRow?.price && Number(latestPrice.price) < Number(prevMinRow.price)),
      favorite_user_ids: favoriteUserIds,
      recipient_candidates_excluding_author: recipientCandidates,
      existing_notifications_for_latest_price: existingNotifs || [],
      notify_price_drop_invoke_http_ok: invokeRes.ok,
      notify_price_drop_invoke_response: invokeJson,
      notifications_after_invoke: notifsAfterInvoke || [],
    });
  } catch (error) {
    console.error('debug-latest-price-drop error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
