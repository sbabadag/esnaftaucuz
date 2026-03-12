import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type Body = {
  price_id?: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const normalizeTR = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();

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

    let { data: favoritesRows, error: favoritesError } = await client
      .from('user_favorites')
      .select('user_id')
      .eq('product_id', priceRow.product_id);

    if (favoritesError) {
      return jsonResponse(200, { ok: false, skipped: true, reason: favoritesError.message });
    }

    // Fallback for duplicate products with same display name but different IDs:
    // if no direct favorite exists for this product_id, include favorites from
    // sibling product records that share the same lowercased name.
    if (!favoritesRows || favoritesRows.length === 0) {
      const { data: sameNameProducts } = await client
        .from('products')
        .select('id')
        .ilike('name', productName)
        .limit(100);

      const siblingProductIds = Array.from(
        new Set(
          (sameNameProducts || [])
            .map((p: any) => p?.id)
            .filter((pid: any) => typeof pid === 'string' && pid.length > 0),
        ),
      );

      if (siblingProductIds.length > 0) {
        const { data: siblingFavoritesRows, error: siblingFavoritesError } = await client
          .from('user_favorites')
          .select('user_id')
          .in('product_id', siblingProductIds);
        if (!siblingFavoritesError && Array.isArray(siblingFavoritesRows)) {
          favoritesRows = siblingFavoritesRows;
        }
      }
    }

    // Wider fallback: some catalogs duplicate products under slightly different
    // names/IDs (e.g. case, Turkish chars, suffixes). Match by normalized name
    // similarity and include favorites from those product IDs too.
    if (!favoritesRows || favoritesRows.length === 0) {
      const normalizedName = normalizeTR(productName);
      const firstToken = normalizedName.split(' ').find((token) => token.length >= 3) || normalizedName;

      const { data: roughCandidates } = await client
        .from('products')
        .select('id,name')
        .ilike('name', `%${firstToken}%`)
        .limit(500);

      const matchedIds = Array.from(
        new Set(
          (roughCandidates || [])
            .filter((p: any) => {
              const n = normalizeTR(String(p?.name || ''));
              if (!n) return false;
              return (
                n === normalizedName ||
                n.includes(normalizedName) ||
                normalizedName.includes(n)
              );
            })
            .map((p: any) => p?.id)
            .filter((pid: any) => typeof pid === 'string' && pid.length > 0),
        ),
      );

      if (matchedIds.length > 0) {
        const { data: matchedFavoritesRows, error: matchedFavoritesError } = await client
          .from('user_favorites')
          .select('user_id')
          .in('product_id', matchedIds);
        if (!matchedFavoritesError && Array.isArray(matchedFavoritesRows)) {
          favoritesRows = matchedFavoritesRows;
        }
      }
    }

    // Final fallback: match favorites by joined product name (exact normalized name).
    // This handles cases where duplicated catalog records map the same real product
    // to unrelated IDs and previous ID-based matches miss recipients.
    if (!favoritesRows || favoritesRows.length === 0) {
      const normalizedName = normalizeTR(productName);
      const { data: favoritesWithProduct } = await client
        .from('user_favorites')
        .select('user_id,product:products(name)')
        .limit(5000);

      const nameMatchedRows = (favoritesWithProduct || []).filter((row: any) => {
        const favoriteProductName = normalizeTR(String(row?.product?.name || ''));
        if (!favoriteProductName || !normalizedName) return false;
        return (
          favoriteProductName === normalizedName ||
          favoriteProductName.includes(normalizedName) ||
          normalizedName.includes(favoriteProductName)
        );
      });

      if (nameMatchedRows.length > 0) {
        favoritesRows = nameMatchedRows.map((row: any) => ({ user_id: row.user_id }));
      }
    }

    const candidateUserIds = Array.from(
      new Set(
        (favoritesRows || [])
          .map((row: any) => row?.user_id)
          .filter((id: any) => typeof id === 'string' && id.length > 0 && id !== priceRow.user_id),
      ),
    );

    let usersRows: any[] = [];
    if (candidateUserIds.length > 0) {
      const { data } = await client
        .from('users')
        .select('id,preferences')
        .in('id', candidateUserIds);
      usersRows = data || [];
    }

    let recipientIds = (usersRows || [])
      .filter((u: any) => {
        const pref = u?.preferences?.notifications;
        if (pref === undefined || pref === null) return true;
        if (typeof pref === 'boolean') return pref;
        return String(pref).toLowerCase() === 'true' || String(pref) === '1';
      })
      .map((u: any) => u.id)
      .filter((uid: string) => uid !== priceRow.user_id);

    let tokenFallbackCandidateCount = 0;
    let tokenFallbackRecipientsCount = 0;

    // Safety fallback: if no recipients resolved from favorites/name matching,
    // target active token owners (except the actor) with notifications enabled.
    if (recipientIds.length === 0) {
      const { data: tokenUsersRows } = await client
        .from('user_push_tokens')
        .select('user_id')
        .eq('is_active', true);

      const tokenUserIds = Array.from(
        new Set(
          (tokenUsersRows || [])
            .map((row: any) => row?.user_id)
            .filter((uid: any) => typeof uid === 'string' && uid.length > 0 && uid !== priceRow.user_id),
        ),
      );
      tokenFallbackCandidateCount = tokenUserIds.length;

      if (tokenUserIds.length > 0) {
        const { data: tokenUsersWithPrefs } = await client
          .from('users')
          .select('id,preferences')
          .in('id', tokenUserIds);

        const prefFiltered = (tokenUsersWithPrefs || [])
          .filter((u: any) => {
            const pref = u?.preferences?.notifications;
            if (pref === undefined || pref === null) return true;
            if (typeof pref === 'boolean') return pref;
            return String(pref).toLowerCase() === 'true' || String(pref) === '1';
          })
          .map((u: any) => u.id)
          .filter((uid: any) => typeof uid === 'string' && uid.length > 0 && uid !== priceRow.user_id);

        // If profile rows are missing or preference rows are empty,
        // still dispatch to active-token users as a last resort.
        recipientIds = prefFiltered.length > 0
          ? prefFiltered
          : tokenUserIds.filter((uid: string) => uid !== priceRow.user_id);
        tokenFallbackRecipientsCount = recipientIds.length;
      }
    }

    if (recipientIds.length === 0) {
      return jsonResponse(200, {
        ok: true,
        skipped: true,
        reason: 'No recipients with notifications enabled',
        debug: {
          product_id: priceRow.product_id,
          actor_user_id: priceRow.user_id,
          favorites_count: (favoritesRows || []).length,
          candidate_user_ids_count: candidateUserIds.length,
          token_fallback_candidate_count: tokenFallbackCandidateCount,
          token_fallback_recipient_count: tokenFallbackRecipientsCount,
        },
      });
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
