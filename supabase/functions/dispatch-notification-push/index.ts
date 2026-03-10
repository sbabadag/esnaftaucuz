import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type DispatchBody = {
  notification_id?: string;
  user_id?: string;
  type?: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY') || '';
const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID') || '';
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL') || '';
const FCM_PRIVATE_KEY_RAW = Deno.env.get('FCM_PRIVATE_KEY') || '';

const getServiceClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service role env vars');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

const isTokenInvalidResponse = (json: any) => {
  const result = json?.results?.[0];
  const error = result?.error;
  return error === 'InvalidRegistration' || error === 'NotRegistered';
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
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encodeUtf8(unsignedToken),
  );
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

const sendFcmLegacy = async (token: string, title: string, body: string, data: Record<string, string>) => {
  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${FCM_SERVER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      priority: 'high',
      notification: {
        title,
        body,
        sound: 'default',
      },
      data,
    }),
  });
  const json = await response.json().catch(() => ({}));
  return {
    ok: response.ok && json?.failure !== 1,
    invalidToken: isTokenInvalidResponse(json),
    response: json,
  };
};

const sendFcmV1 = async (
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
) => {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      },
    }),
  });

  const json = await response.json().catch(() => ({}));
  const rawError = JSON.stringify(json || {});
  const invalidToken = rawError.includes('UNREGISTERED') || rawError.includes('registration token is not a valid');

  return {
    ok: response.ok,
    invalidToken,
    response: json,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const hasLegacy = !!FCM_SERVER_KEY;
    const hasV1 = !!(FCM_PROJECT_ID && FCM_CLIENT_EMAIL && FCM_PRIVATE_KEY_RAW);
    if (!hasLegacy && !hasV1) {
      return jsonResponse(200, {
        ok: false,
        skipped: true,
        reason:
          'Missing FCM config. Set FCM_SERVER_KEY (legacy) or FCM_PROJECT_ID + FCM_CLIENT_EMAIL + FCM_PRIVATE_KEY (v1).',
      });
    }

    const body = (await req.json()) as DispatchBody;
    const notificationId = body?.notification_id;
    if (!notificationId) return jsonResponse(400, { error: 'Missing notification_id' });

    const client = getServiceClient();

    const { data: notification, error: notificationError } = await client
      .from('notifications')
      .select('id,user_id,type,title,message,product_id,price_id')
      .eq('id', notificationId)
      .single();

    if (notificationError || !notification) {
      return jsonResponse(200, { ok: false, skipped: true, reason: 'Notification not found' });
    }

    const { data: tokenRows, error: tokenError } = await client
      .from('user_push_tokens')
      .select('id,token,platform,is_active')
      .eq('user_id', notification.user_id)
      .eq('is_active', true);

    if (tokenError) {
      return jsonResponse(200, { ok: false, skipped: true, reason: tokenError.message });
    }

    if (!tokenRows || tokenRows.length === 0) {
      return jsonResponse(200, { ok: true, sent: 0, skipped: true, reason: 'No active tokens' });
    }

    const payloadData = {
      notification_id: String(notification.id),
      type: String(notification.type || ''),
      product_id: String(notification.product_id || ''),
      price_id: String(notification.price_id || ''),
      click_action: 'OPEN_NOTIFICATIONS',
    };

    let sent = 0;
    const invalidTokenIds: string[] = [];
    const accessToken = hasV1 ? await getGoogleAccessToken() : null;

    for (const row of tokenRows) {
      const result = accessToken
        ? await sendFcmV1(accessToken, row.token, notification.title, notification.message, payloadData)
        : await sendFcmLegacy(row.token, notification.title, notification.message, payloadData);
      if (result.ok) {
        sent += 1;
      } else if (result.invalidToken) {
        invalidTokenIds.push(row.id);
      } else {
        console.warn('FCM send failed for token:', {
          tokenId: row.id,
          response: result.response,
        });
      }
    }

    if (invalidTokenIds.length > 0) {
      await client
        .from('user_push_tokens')
        .update({ is_active: false })
        .in('id', invalidTokenIds);
    }

    return jsonResponse(200, {
      ok: true,
      sent,
      total_tokens: tokenRows.length,
      disabled_invalid_tokens: invalidTokenIds.length,
    });
  } catch (error) {
    console.error('dispatch-notification-push error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
