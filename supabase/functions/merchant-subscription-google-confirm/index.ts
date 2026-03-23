import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type ConfirmBody = {
  purchaseToken?: string;
  productId?: string;
  orderId?: string;
  packageName?: string;
  purchaseTime?: number;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const GOOGLE_PLAY_PACKAGE_NAME = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME') || '';
const GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
  Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL') ||
  Deno.env.get('FCM_CLIENT_EMAIL') ||
  '';
const GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY =
  Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY') ||
  Deno.env.get('FCM_PRIVATE_KEY') ||
  '';
const GOOGLE_PLAY_SUBS_PRODUCT_ID_MONTHLY = Deno.env.get('GOOGLE_PLAY_SUBS_PRODUCT_ID_MONTHLY') || '';
const GOOGLE_PLAY_SUBS_PRODUCT_ID_YEARLY = Deno.env.get('GOOGLE_PLAY_SUBS_PRODUCT_ID_YEARLY') || '';
const MERCHANT_SUBS_MONTHLY_AMOUNT_TL = Math.max(1, Number(Deno.env.get('MERCHANT_SUBS_MONTHLY_AMOUNT_TL') || '900'));
const MERCHANT_SUBS_YEARLY_AMOUNT_TL = Math.max(
  MERCHANT_SUBS_MONTHLY_AMOUNT_TL,
  Number(Deno.env.get('MERCHANT_SUBS_YEARLY_AMOUNT_TL') || '9000'),
);

const encoder = new TextEncoder();

const getServiceClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service env vars');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

const b64url = (input: Uint8Array | string) => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemToPkcs8Bytes = (pemRaw: string): Uint8Array => {
  const normalized = String(pemRaw || '')
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

const createGoogleAccessToken = async (): Promise<string> => {
  if (!GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('Missing Google Play service account env vars');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Bytes(GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signingInput));
  const jwt = `${signingInput}.${b64url(new Uint8Array(signatureBuffer))}`;

  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.set('assertion', jwt);

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const tokenJson = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok) {
    throw new Error(String(tokenJson?.error_description || tokenJson?.error || `Google token HTTP ${tokenResp.status}`));
  }
  const accessToken = String(tokenJson?.access_token || '').trim();
  if (!accessToken) throw new Error('Google token response missing access_token');
  return accessToken;
};

const inferBillingMonths = (productId: string): number => {
  const normalized = String(productId || '').toLowerCase();
  if (!normalized) return 1;
  if (GOOGLE_PLAY_SUBS_PRODUCT_ID_YEARLY && normalized === GOOGLE_PLAY_SUBS_PRODUCT_ID_YEARLY.toLowerCase()) return 12;
  if (GOOGLE_PLAY_SUBS_PRODUCT_ID_MONTHLY && normalized === GOOGLE_PLAY_SUBS_PRODUCT_ID_MONTHLY.toLowerCase()) return 1;
  if (
    normalized.includes('year') ||
    normalized.includes('annual') ||
    normalized.includes('yillik') ||
    normalized.includes('yil')
  ) {
    return 12;
  }
  return 1;
};

const resolveAmountTl = (billingMonths: number): number =>
  billingMonths >= 12 ? MERCHANT_SUBS_YEARLY_AMOUNT_TL : MERCHANT_SUBS_MONTHLY_AMOUNT_TL;

const resolvePlanCode = (billingMonths: number): string =>
  billingMonths >= 12 ? 'merchant_google_play_yearly' : 'merchant_google_play_monthly';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    if (!GOOGLE_PLAY_PACKAGE_NAME) return jsonResponse(500, { error: 'Missing GOOGLE_PLAY_PACKAGE_NAME' });

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';
    if (!token) return jsonResponse(401, { error: 'Missing bearer token' });

    const service = getServiceClient();
    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return jsonResponse(401, { error: 'Unauthorized user token' });
    }
    const userId = authData.user.id;

    const body = (await req.json().catch(() => ({}))) as ConfirmBody;
    const purchaseToken = String(body?.purchaseToken || '').trim();
    const productIdFromClient = String(body?.productId || '').trim();
    const packageNameFromClient = String(body?.packageName || '').trim();
    if (!purchaseToken) {
      return jsonResponse(400, { error: 'purchaseToken is required' });
    }
    if (packageNameFromClient && packageNameFromClient !== GOOGLE_PLAY_PACKAGE_NAME) {
      return jsonResponse(400, { error: 'Package name mismatch' });
    }

    const googleAccessToken = await createGoogleAccessToken();
    const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      GOOGLE_PLAY_PACKAGE_NAME,
    )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const verifyResp = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
      },
    });
    const verifyJson = await verifyResp.json().catch(() => ({}));
    if (!verifyResp.ok) {
      return jsonResponse(400, {
        error: 'Google Play verification failed',
        details: verifyJson?.error?.message || `HTTP ${verifyResp.status}`,
      });
    }

    const subscriptionState = String(verifyJson?.subscriptionState || '').trim();
    const lineItems = Array.isArray(verifyJson?.lineItems) ? verifyJson.lineItems : [];
    const matchedLineItem = productIdFromClient
      ? lineItems.find((item: any) => String(item?.productId || '') === productIdFromClient)
      : (lineItems[0] || null);
    if (!matchedLineItem) {
      return jsonResponse(409, { error: 'Verified purchase does not include requested product id' });
    }

    const verifiedProductId = String(matchedLineItem?.productId || productIdFromClient || '').trim();
    if (!verifiedProductId) {
      return jsonResponse(409, { error: 'Could not resolve verified product id' });
    }

    const expiryTimeRaw = String(matchedLineItem?.expiryTime || '').trim();
    const expiryDate = expiryTimeRaw ? new Date(expiryTimeRaw) : null;
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) {
      return jsonResponse(409, { error: 'Google Play response missing valid expiryTime' });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiryIso = expiryDate.toISOString();
    const billingPeriodMonths = inferBillingMonths(verifiedProductId);
    const amountTl = resolveAmountTl(billingPeriodMonths);
    const planCode = resolvePlanCode(billingPeriodMonths);
    const monthlyEquivalentFeeTl = Math.max(1, Math.round(amountTl / billingPeriodMonths));
    const isUnexpired = expiryDate.getTime() > now.getTime();

    // Treat grace/hold as non-blocking active state to avoid locking users while Play retries.
    const normalizedState = subscriptionState.toUpperCase();
    const isGraceOrHold =
      normalizedState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
      normalizedState === 'SUBSCRIPTION_STATE_ON_HOLD';
    const isActive = isUnexpired && normalizedState !== 'SUBSCRIPTION_STATE_EXPIRED';
    const merchantStatus = isActive
      ? (isGraceOrHold ? 'past_due' : 'active')
      : 'inactive';

    const paymentMetadata = {
      source: 'google_play_verify',
      product_id: verifiedProductId,
      order_id: String(body?.orderId || verifyJson?.latestOrderId || ''),
      package_name: GOOGLE_PLAY_PACKAGE_NAME,
      purchase_time: Number(body?.purchaseTime || 0) || null,
      google_subscription_state: subscriptionState,
      google_expiry_time: expiryIso,
      acknowledged: true,
      line_item: matchedLineItem,
    };

    const { data: paymentRow, error: paymentError } = await service
      .from('merchant_subscription_payments')
      .upsert({
        user_id: userId,
        provider: 'google_play',
        status: isActive ? 'confirmed' : 'failed',
        amount_tl: amountTl,
        billing_period_months: billingPeriodMonths,
        provider_payment_id: purchaseToken,
        provider_reference: String(body?.orderId || verifyJson?.latestOrderId || '') || null,
        paid_at: isActive ? nowIso : null,
        failure_reason: isActive ? null : `google_play_${normalizedState || 'inactive'}`,
        metadata: paymentMetadata,
      }, {
        onConflict: 'provider,provider_payment_id',
      })
      .select('id, status')
      .single();

    if (paymentError) {
      throw paymentError;
    }

    const { error: userUpdateError } = await service
      .from('users')
      .update({
        is_merchant: true,
        merchant_subscription_status: merchantStatus,
        merchant_subscription_plan: planCode,
        merchant_subscription_fee_tl: monthlyEquivalentFeeTl,
        merchant_subscription_current_period_start: nowIso,
        merchant_subscription_current_period_end: expiryIso,
        merchant_subscription_last_event_at: nowIso,
      })
      .eq('id', userId);
    if (userUpdateError) {
      throw new Error(`Failed to update user merchant status: ${String(userUpdateError.message || userUpdateError)}`);
    }

    return jsonResponse(200, {
      ok: true,
      active: isActive,
      status: merchantStatus,
      paymentId: paymentRow?.id || null,
      billingPeriodMonths,
      amountTl,
      productId: verifiedProductId,
      periodEnd: expiryIso,
      googleSubscriptionState: subscriptionState,
    });
  } catch (error) {
    console.error('merchant-subscription-google-confirm error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
