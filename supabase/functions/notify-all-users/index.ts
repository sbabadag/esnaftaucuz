import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

/**
 * notify-all-users — tüm kullanıcılara duyuru push'u.
 * Kullanım: POST /functions/v1/notify-all-users
 *   header: x-admin-secret (ADMIN_BROADCAST_SECRET env'i ile eşleşmeli)
 *   body:   { "title": "...", "body": "...", "link": "/app/explore" }
 * Tüm aktif token'lara (android/ios/web) FCM v1 ile gönderir; geçersiz
 * token'ları pasife alır. Ayrıca 'all' topic'ine de mesaj bırakır (topic
 * aboneliği uygulama 1.1.14+ ile yayılıyor).
 */

type BroadcastBody = {
  title?: string;
  body?: string;
  link?: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID') || '';
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL') || '';
const FCM_PRIVATE_KEY_RAW = Deno.env.get('FCM_PRIVATE_KEY') || '';
const ADMIN_BROADCAST_SECRET = Deno.env.get('ADMIN_BROADCAST_SECRET') || '';

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
    throw new Error('Missing FCM HTTP v1 secrets: FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY');
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

const sendFcmV1 = async (
  accessToken: string,
  token: string,
  platform: string,
  title: string,
  body: string,
  link: string,
) => {
  const message: any = {
    token,
    notification: { title, body },
    data: { title, message: body, type: 'announcement', link },
    android: {
      priority: 'high',
      ttl: '86400s',
      notification: {
        sound: 'default',
        channel_id: 'price_alerts',
        notification_priority: 'PRIORITY_MAX',
        default_vibrate_timings: true,
      },
    },
    apns: {
      headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
      payload: { aps: { sound: 'default' } },
    },
  };

  if (platform === 'web') {
    message.webpush = {
      notification: { title, body, icon: '/favicon.ico' },
      fcm_options: { link },
    };
  }

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    },
  );

  const json = await response.json().catch(() => ({}));
  const rawError = JSON.stringify(json || {});
  const invalidToken =
    rawError.includes('UNREGISTERED') || rawError.includes('registration token is not a valid');

  return { ok: response.ok, invalidToken, response: json };
};

const sendToTopic = async (accessToken: string, title: string, body: string, link: string) => {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            topic: 'all',
            notification: { title, body },
            data: { title, message: body, type: 'announcement', link },
            android: {
              priority: 'high',
              ttl: '86400s',
              notification: {
                sound: 'default',
                channel_id: 'price_alerts',
                notification_priority: 'PRIORITY_MAX',
              },
            },
            apns: {
              headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
              payload: { aps: { sound: 'default' } },
            },
          },
        }),
      },
    );
    const json = await response.json().catch(() => ({}));
    return { ok: response.ok, response: json };
  } catch (err) {
    return { ok: false, response: { error: String(err) } };
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    // Admin koruması: header'daki secret, env'deki ADMIN_BROADCAST_SECRET ile eşleşmeli
    const authHeader = req.headers.get('x-admin-secret') || '';
    if (!ADMIN_BROADCAST_SECRET || authHeader !== ADMIN_BROADCAST_SECRET) {
      return jsonResponse(401, { error: 'Unauthorized: x-admin-secret gerekli' });
    }

    const body = (await req.json().catch(() => ({}))) as BroadcastBody;
    const title = String(body?.title || '').trim();
    const message = String(body?.body || '').trim();
    const link = String(body?.link || '/app/explore').trim() || '/app/explore';
    if (!title || !message) {
      return jsonResponse(400, { error: 'title ve body gerekli' });
    }

    const client = getServiceClient();

    const { data: tokenRows, error: tokenError } = await client
      .from('user_push_tokens')
      .select('id,user_id,token,platform')
      .eq('is_active', true);

    if (tokenError) {
      return jsonResponse(500, { error: tokenError.message });
    }
    if (!tokenRows || tokenRows.length === 0) {
      return jsonResponse(200, { ok: true, sent: 0, total_tokens: 0, reason: 'Aktif token yok' });
    }

    const accessToken = await getGoogleAccessToken();

    // Geçersiz token temizliği için izle
    const invalidTokenIds: string[] = [];
    let sent = 0;
    let failed = 0;

    // Küçük eşzamanlılıkla toplu gönderim
    const CONCURRENCY = 8;
    const queue = [...tokenRows];
    const worker = async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) break;
        try {
          const result = await sendFcmV1(accessToken, row.token, row.platform, title, message, link);
          if (result.ok) {
            sent += 1;
          } else if (result.invalidToken) {
            invalidTokenIds.push(row.id);
          } else {
            failed += 1;
            console.warn('FCM send failed for token:', { tokenId: row.id, response: result.response });
          }
        } catch (err) {
          failed += 1;
          console.warn('FCM send exception:', err);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tokenRows.length) }, () => worker()));

    if (invalidTokenIds.length > 0) {
      await client.from('user_push_tokens').update({ is_active: false }).in('id', invalidTokenIds);
    }

    // Topic'e de bırak (1.1.14+ abone olan kurulumlar için; token yolu zaten herkese gitti)
    const topicResult = await sendToTopic(accessToken, title, message, link);

    return jsonResponse(200, {
      ok: true,
      sent,
      failed,
      total_tokens: tokenRows.length,
      disabled_invalid_tokens: invalidTokenIds.length,
      topic: topicResult.ok ? 'sent' : 'skipped',
    });
  } catch (error) {
    console.error('notify-all-users error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
