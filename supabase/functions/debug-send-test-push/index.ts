import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type Body = {
  user_id?: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID') || '';
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL') || '';
const FCM_PRIVATE_KEY_RAW = Deno.env.get('FCM_PRIVATE_KEY') || '';

const getServiceClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service role env vars');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

const b64url = (input: Uint8Array) =>
  btoa(String.fromCharCode(...input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const encodeUtf8 = (str: string) => new TextEncoder().encode(str);

const pemToArrayBuffer = (pem: string) => {
  const clean = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const getGoogleAccessToken = async () => {
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY_RAW) {
    throw new Error('Missing FCM HTTP v1 secrets');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: FCM_CLIENT_EMAIL,
    sub: FCM_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${b64url(encodeUtf8(JSON.stringify(header)))}.${b64url(
    encodeUtf8(JSON.stringify(payload)),
  )}`;

  const privateKey = FCM_PRIVATE_KEY_RAW.replace(/\\n/g, '\n');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encodeUtf8(unsignedToken));
  const jwt = `${unsignedToken}.${b64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw new Error(`Failed to fetch Google access token: ${JSON.stringify(tokenJson)}`);
  }
  return tokenJson.access_token as string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const client = getServiceClient();

    let tokenQuery = client
      .from('user_push_tokens')
      .select('id,user_id,token,platform,is_active,last_seen_at,created_at')
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .limit(1);

    if (body.user_id) {
      tokenQuery = client
        .from('user_push_tokens')
        .select('id,user_id,token,platform,is_active,last_seen_at,created_at')
        .eq('user_id', body.user_id)
        .eq('is_active', true)
        .order('last_seen_at', { ascending: false })
        .limit(1);
    }

    const { data: tokenRows, error: tokenError } = await tokenQuery;
    if (tokenError) return jsonResponse(200, { ok: false, stage: 'token_query', error: tokenError.message });
    const tokenRow = tokenRows?.[0];
    if (!tokenRow?.token) return jsonResponse(200, { ok: false, stage: 'token_query', error: 'No active token found' });

    const accessToken = await getGoogleAccessToken();
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: tokenRow.token,
          notification: {
            title: 'Test bildirimi',
            body: 'Kapali uygulama push testi',
          },
          data: {
            type: 'debug_test',
            click_action: 'OPEN_NOTIFICATIONS',
          },
          android: {
            priority: 'high',
            ttl: '120s',
            notification: {
              channel_id: 'price_alerts',
              sound: 'default',
            },
          },
        },
      }),
    });

    const json = await response.json().catch(() => ({}));
    return jsonResponse(200, {
      ok: response.ok,
      token_row: {
        id: tokenRow.id,
        user_id: tokenRow.user_id,
        platform: tokenRow.platform,
        last_seen_at: tokenRow.last_seen_at,
      },
      fcm_response: json,
    });
  } catch (error) {
    console.error('debug-send-test-push error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
