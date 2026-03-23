import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type Body = {
  token?: string;
  platform?: 'ios' | 'android' | 'web';
  user_id?: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

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
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const token = String(body?.token || '').trim();
    const platform = String(body?.platform || '').trim().toLowerCase();
    const bodyUserId = String(body?.user_id || '').trim();
    if (!token) return jsonResponse(400, { error: 'Missing token' });
    if (!['ios', 'android', 'web'].includes(platform)) {
      return jsonResponse(400, { error: 'Invalid platform' });
    }

    let resolvedUserId = '';
    try {
      const userClient = getUserClientFromRequest(req);
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();
      if (!userError && user?.id) {
        resolvedUserId = user.id;
      }
    } catch {
      // Continue with body user_id fallback for native/session edge cases.
    }

    if (!resolvedUserId && bodyUserId) {
      resolvedUserId = bodyUserId;
    }

    if (!resolvedUserId) {
      return jsonResponse(401, { error: 'Unauthorized user' });
    }

    const service = getServiceClient();
    const payload = {
      user_id: resolvedUserId,
      token,
      platform,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    };

    const { data, error } = await service
      .from('user_push_tokens')
      .upsert(payload, {
        onConflict: 'token',
        ignoreDuplicates: false,
      })
      .select('id,user_id,platform,is_active,last_seen_at')
      .maybeSingle();

    if (error) {
      return jsonResponse(200, { ok: false, stage: 'upsert', error: error.message });
    }

    return jsonResponse(200, { ok: true, row: data || null });
  } catch (error) {
    console.error('register-push-token error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
