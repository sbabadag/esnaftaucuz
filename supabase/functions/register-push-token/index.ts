import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type Body = {
  token?: string;
  platform?: 'ios' | 'android' | 'web';
  user_id?: string;
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
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
    if (!jwt || jwt.split('.').length < 3) {
      return jsonResponse(401, { error: 'Missing or invalid bearer token' });
    }

    const service = getServiceClient();
    const { data: authData, error: authError } = await service.auth.getUser(jwt);
    if (authError || !authData?.user?.id) {
      return jsonResponse(401, { error: 'Unauthorized user token' });
    }
    const resolvedUserId = authData.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const token = String(body?.token || '').trim();
    const platform = String(body?.platform || '').trim().toLowerCase();
    const bodyUserId = String(body?.user_id || '').trim();

    if (!token) return jsonResponse(400, { error: 'Missing token' });
    if (!['ios', 'android', 'web'].includes(platform)) {
      return jsonResponse(400, { error: 'Invalid platform' });
    }
    // Never trust client-supplied user_id for another account
    if (bodyUserId && bodyUserId !== resolvedUserId) {
      return jsonResponse(403, { error: 'user_id does not match authenticated user' });
    }

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
