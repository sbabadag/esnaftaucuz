import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const IYZICO_WEBHOOK_SECRET = Deno.env.get('IYZICO_WEBHOOK_SECRET') || '';
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const encoder = new TextEncoder();

const timingSafeEqual = (a: string, b: string) => {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
};

const hexToBytes = (hex: string) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
};

const computeHmacHex = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const verifyStripeSignature = async (rawBody: string, stripeSignatureHeader: string) => {
  // Header format: t=timestamp,v1=signature[,v1=signature2...]
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  if (!stripeSignatureHeader) return false;

  const parts = stripeSignatureHeader.split(',').map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Parts = parts.filter((p) => p.startsWith('v1='));
  if (!tPart || v1Parts.length === 0) return false;

  const timestamp = Number(tPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const actual = await computeHmacHex(STRIPE_WEBHOOK_SECRET, signedPayload);

  return v1Parts.some((p) => timingSafeEqual(actual, p.slice(3)));
};

const verifyIyzicoSignature = async (rawBody: string, signatureHeader: string) => {
  // Generic HMAC check. If your Iyzico integration uses a different canonical string,
  // adapt this function accordingly.
  if (!IYZICO_WEBHOOK_SECRET) throw new Error('Missing IYZICO_WEBHOOK_SECRET');
  if (!signatureHeader) return false;

  const actual = await computeHmacHex(IYZICO_WEBHOOK_SECRET, rawBody);
  return timingSafeEqual(actual, signatureHeader);
};

const getServiceClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service role env vars');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

const recordWebhookEvent = async (
  client: ReturnType<typeof createClient>,
  provider: 'stripe' | 'iyzico',
  providerEventId: string,
  paymentId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
) => {
  const { data, error } = await client
    .from('merchant_subscription_webhook_events')
    .insert({
      provider,
      provider_event_id: providerEventId,
      payment_id: paymentId,
      event_type: eventType,
      payload,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    // Idempotent duplicate: silently skip.
    if ((error as any)?.code === '23505') {
      return { duplicated: true };
    }
    throw error;
  }

  return { duplicated: false, rowId: data?.id || null };
};

const confirmPayment = async (
  client: ReturnType<typeof createClient>,
  paymentId: string,
  providerPaymentId?: string,
  metadata?: Record<string, unknown>,
) => {
  const { data, error } = await client.rpc('confirm_merchant_subscription_payment', {
    p_payment_id: paymentId,
    p_provider_payment_id: providerPaymentId || null,
    p_paid_at: new Date().toISOString(),
    p_metadata: metadata || {},
  });

  if (error) throw error;
  return data;
};

const failPayment = async (client: ReturnType<typeof createClient>, paymentId: string, reason: string) => {
  const { data, error } = await client.rpc('fail_merchant_subscription_payment', {
    p_payment_id: paymentId,
    p_failure_reason: reason,
  });
  if (error) throw error;
  return data;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const url = new URL(req.url);
    const provider = (url.searchParams.get('provider') || '').toLowerCase();
    if (!provider || (provider !== 'stripe' && provider !== 'iyzico')) {
      return jsonResponse(400, { error: 'Missing or invalid provider query param' });
    }

    const rawBody = await req.text();
    const client = getServiceClient();

    if (provider === 'stripe') {
      const stripeSignatureHeader = req.headers.get('stripe-signature') || '';
      const isValid = await verifyStripeSignature(rawBody, stripeSignatureHeader);
      if (!isValid) return jsonResponse(401, { error: 'Invalid Stripe signature' });

      const event = JSON.parse(rawBody);
      const eventType = event?.type || '';
      const providerEventId = String(event?.id || '');
      const session = event?.data?.object;
      const paymentId = session?.metadata?.paymentId as string | undefined;
      const providerPaymentId = session?.id as string | undefined;

      if (!providerEventId) {
        return jsonResponse(400, { error: 'Stripe payload missing event id' });
      }

      if (!paymentId) {
        return jsonResponse(400, { error: 'Stripe event missing metadata.paymentId' });
      }

      const eventRecord = await recordWebhookEvent(
        client,
        'stripe',
        providerEventId,
        paymentId,
        eventType,
        event as Record<string, unknown>,
      );
      if (eventRecord.duplicated) {
        return jsonResponse(200, { ok: true, action: 'duplicate_ignored', paymentId, eventType });
      }

      if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
        await confirmPayment(client, paymentId, providerPaymentId, {
          provider: 'stripe',
          eventType,
        });
        return jsonResponse(200, { ok: true, action: 'confirmed', paymentId });
      }

      if (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed') {
        await failPayment(client, paymentId, eventType);
        return jsonResponse(200, { ok: true, action: 'failed', paymentId });
      }

      return jsonResponse(200, { ok: true, action: 'ignored', eventType });
    }

    // iyzico
    const iyzicoSignature = req.headers.get('x-iyzico-signature') || '';
    const isValid = await verifyIyzicoSignature(rawBody, iyzicoSignature);
    if (!isValid) return jsonResponse(401, { error: 'Invalid Iyzico signature' });

    const payload = JSON.parse(rawBody);
    const paymentId = payload?.paymentId as string | undefined;
    const status = String(payload?.status || '').toLowerCase();
    const providerPaymentId = payload?.providerPaymentId as string | undefined;
    const providerEventId =
      String(payload?.eventId || payload?.id || `${paymentId || 'unknown'}:${status}:${payload?.eventTime || payload?.updatedAt || 'na'}`);

    if (!paymentId) return jsonResponse(400, { error: 'Iyzico payload missing paymentId' });

    const eventRecord = await recordWebhookEvent(
      client,
      'iyzico',
      providerEventId,
      paymentId,
      status || 'unknown',
      payload as Record<string, unknown>,
    );
    if (eventRecord.duplicated) {
      return jsonResponse(200, { ok: true, action: 'duplicate_ignored', paymentId, status });
    }

    if (status === 'success' || status === 'succeeded' || status === 'paid') {
      await confirmPayment(client, paymentId, providerPaymentId, {
        provider: 'iyzico',
        eventType: 'payment_success',
      });
      return jsonResponse(200, { ok: true, action: 'confirmed', paymentId });
    }

    if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
      await failPayment(client, paymentId, `iyzico_${status}`);
      return jsonResponse(200, { ok: true, action: 'failed', paymentId });
    }

    return jsonResponse(200, { ok: true, action: 'ignored', status });
  } catch (error) {
    console.error('merchant-subscription-webhook error:', error);
    return jsonResponse(500, { error: (error as Error).message || 'Internal error' });
  }
});
