import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type Body = {
  notification_id?: string;
  type?: string;
  title?: string;
  message?: string;
  product_id?: string | null;
  price_id?: string | null;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

const ALLOWED_TYPES = new Set([
  'price_drop',
  'price_verified',
  'nearby_cheap',
  'contribution_verified',
  'other',
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asUuidOrNull = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return UUID_REGEX.test(raw) ? raw : null;
};

const getServiceClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service role env vars');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

const getUserClientFromRequest = (req: Request) => {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }
  const jwt = authHeader.slice('Bearer '.length);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const userClient = getUserClientFromRequest(req);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user?.id) return jsonResponse(401, { error: 'Unauthorized user' });

    const service = getServiceClient();

    const notificationId = asUuidOrNull(body?.notification_id);
    if (notificationId) {
      const { data: existingById } = await service
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existingById) return jsonResponse(200, { ok: true, existing: true, row: existingById });
    }

    const typeRaw = String(body?.type || 'other').trim();
    const type = ALLOWED_TYPES.has(typeRaw) ? typeRaw : 'other';
    const title = String(body?.title || 'Bildirim').trim() || 'Bildirim';
    const message = String(body?.message || '').trim() || 'Yeni bildirim var.';
    const productId = asUuidOrNull(body?.product_id);
    const priceId = asUuidOrNull(body?.price_id);

    if (priceId && type === 'price_drop') {
      const { data: existingByUnique } = await service
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'price_drop')
        .eq('price_id', priceId)
        .maybeSingle();
      if (existingByUnique) return jsonResponse(200, { ok: true, existing: true, row: existingByUnique });
    }

    const { data: inserted, error: insertError } = await service
      .from('notifications')
      .insert({
        user_id: user.id,
        type,
        title,
        message,
        product_id: productId,
        price_id: priceId,
      })
      .select('*')
      .maybeSingle();

    if (insertError) {
      return jsonResponse(200, { ok: false, stage: 'insert', error: insertError.message });
    }
    return jsonResponse(200, { ok: true, inserted: true, row: inserted || null });
  } catch (error) {
    console.error('sync-notification-from-push error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
