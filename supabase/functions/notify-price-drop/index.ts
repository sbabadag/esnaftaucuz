import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type Body = {
  price_id?: string;
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
    const body = (await req.json()) as Body;
    const priceId = body?.price_id;
    if (!priceId) return jsonResponse(400, { error: 'Missing price_id' });

    const client = getServiceClient();

    const { data: priceRow, error: priceError } = await client
      .from('prices')
      .select('id,product_id,price,user_id,is_active')
      .eq('id', priceId)
      .maybeSingle();

    if (priceError || !priceRow) {
      return jsonResponse(200, { ok: false, skipped: true, reason: 'Price not found' });
    }
    if (priceRow.is_active !== true) {
      return jsonResponse(200, { ok: true, skipped: true, reason: 'Price is not active' });
    }

    const { data: prevMinRow } = await client
      .from('prices')
      .select('price')
      .eq('product_id', priceRow.product_id)
      .eq('is_active', true)
      .neq('id', priceRow.id)
      .order('price', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!prevMinRow?.price || Number(priceRow.price) >= Number(prevMinRow.price)) {
      return jsonResponse(200, {
        ok: true,
        skipped: true,
        reason: 'Not a price drop',
      });
    }

    const { data: productRow } = await client
      .from('products')
      .select('name')
      .eq('id', priceRow.product_id)
      .maybeSingle();
    const productName = productRow?.name || 'Urun';

    const { data: favoritesRows, error: favoritesError } = await client
      .from('user_favorites')
      .select('user_id')
      .eq('product_id', priceRow.product_id);

    if (favoritesError) {
      return jsonResponse(200, { ok: false, skipped: true, reason: favoritesError.message });
    }

    const candidateUserIds = Array.from(
      new Set(
        (favoritesRows || [])
          .map((row: any) => row?.user_id)
          .filter((id: any) => typeof id === 'string' && id.length > 0),
      ),
    );

    if (candidateUserIds.length === 0) {
      return jsonResponse(200, { ok: true, skipped: true, reason: 'No recipients' });
    }

    const { data: usersRows } = await client
      .from('users')
      .select('id,preferences')
      .in('id', candidateUserIds);

    const recipientIds = (usersRows || [])
      .filter((u: any) => {
        const pref = u?.preferences?.notifications;
        if (pref === undefined || pref === null) return true;
        if (typeof pref === 'boolean') return pref;
        return String(pref).toLowerCase() === 'true' || String(pref) === '1';
      })
      .map((u: any) => u.id);

    if (recipientIds.length === 0) {
      return jsonResponse(200, { ok: true, skipped: true, reason: 'No recipients with notifications enabled' });
    }

    const notificationRows = recipientIds.map((userId) => ({
      user_id: userId,
      type: 'price_drop',
      title: 'Fiyat Dustu! 🎉',
      message: `${productName} icin yeni dusuk fiyat: ${priceRow.price} TL (onceki en dusuk: ${prevMinRow.price} TL)`,
      product_id: priceRow.product_id,
      price_id: priceRow.id,
    }));

    const { data: insertedRows, error: insertError } = await client
      .from('notifications')
      .insert(notificationRows, {
        onConflict: 'user_id,price_id,type',
        ignoreDuplicates: true,
      })
      .select('id');

    if (insertError) {
      return jsonResponse(200, { ok: false, skipped: true, reason: insertError.message });
    }

    const notificationIds = (insertedRows || [])
      .map((row: any) => row?.id)
      .filter((id: any) => typeof id === 'string' && id.length > 0);

    // Push dispatch is handled by DB trigger on notifications insert
    // (dispatch_remote_push_for_notification). Avoid manual dispatch here
    // to prevent duplicate pushes.

    return jsonResponse(200, {
      ok: true,
      inserted_notifications: notificationIds.length,
      dispatch_via_trigger: true,
    });
  } catch (error) {
    console.error('notify-price-drop error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
