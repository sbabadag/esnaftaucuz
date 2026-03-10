import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type Body = {
  user_id?: string;
  notification_id?: string;
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
    const client = getServiceClient();

    let notificationQuery = client
      .from('notifications')
      .select('id,user_id,type,title,message,created_at,is_read')
      .order('created_at', { ascending: false })
      .limit(1);

    if (body.notification_id) {
      notificationQuery = client
        .from('notifications')
        .select('id,user_id,type,title,message,created_at,is_read')
        .eq('id', body.notification_id)
        .limit(1);
    } else if (body.user_id) {
      notificationQuery = client
        .from('notifications')
        .select('id,user_id,type,title,message,created_at,is_read')
        .eq('user_id', body.user_id)
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: notifications, error: notificationError } = await notificationQuery;
    if (notificationError) return jsonResponse(200, { ok: false, stage: 'notification_query', error: notificationError.message });
    const latest = notifications?.[0];
    if (!latest) return jsonResponse(200, { ok: false, stage: 'notification_query', error: 'No notification found' });

    const { data: tokenRows, error: tokenError } = await client
      .from('user_push_tokens')
      .select('id,platform,is_active,created_at,last_seen_at')
      .eq('user_id', latest.user_id)
      .eq('is_active', true);

    if (tokenError) return jsonResponse(200, { ok: false, stage: 'token_query', error: tokenError.message, latest_notification: latest });

    const dispatchRes = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-notification-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_id: latest.id }),
    });
    const dispatchJson = await dispatchRes.json().catch(() => ({}));

    return jsonResponse(200, {
      ok: true,
      latest_notification: latest,
      active_token_count: tokenRows?.length || 0,
      active_tokens: tokenRows || [],
      dispatch_http_ok: dispatchRes.ok,
      dispatch_response: dispatchJson,
    });
  } catch (error) {
    console.error('debug-push-status error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
