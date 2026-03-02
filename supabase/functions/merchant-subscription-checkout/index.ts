import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type CheckoutBody = {
  paymentId: string;
  provider: 'stripe' | 'iyzico';
  amountTl: number;
  billingPeriodMonths: number;
  currency: 'TRY';
  plan: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL') || 'https://example.com';

const IYZICO_CHECKOUT_BASE_URL = Deno.env.get('IYZICO_CHECKOUT_BASE_URL') || '';

const assertRequiredEnv = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env vars for function runtime');
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(200, { error: 'Method not allowed' });

  try {
    assertRequiredEnv();

    const authHeader = req.headers.get('Authorization') || '';
    const userToken = authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '').trim()
      : '';

    if (!userToken) {
      return jsonResponse(200, { error: 'Missing bearer token' });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: authData, error: authError } = await serviceClient.auth.getUser(userToken);
    if (authError || !authData?.user?.id) {
      return jsonResponse(200, { error: 'Unauthorized user token' });
    }
    const userId = authData.user.id;

    const body = (await req.json()) as CheckoutBody;
    if (!body?.paymentId || !body?.provider || !body?.amountTl || !body?.billingPeriodMonths) {
      return jsonResponse(200, { error: 'Invalid payload' });
    }

    const { data: payment, error: paymentError } = await serviceClient
      .from('merchant_subscription_payments')
      .select('*')
      .eq('id', body.paymentId)
      .single();

    if (paymentError || !payment) {
      return jsonResponse(200, { error: 'Payment record not found' });
    }

    if (payment.user_id !== userId) {
      return jsonResponse(200, { error: 'Payment does not belong to current user' });
    }

    if (payment.status !== 'pending') {
      return jsonResponse(200, { error: 'Payment is not pending' });
    }

    if (payment.provider !== body.provider) {
      return jsonResponse(200, { error: 'Provider mismatch' });
    }

    if (body.provider === 'stripe') {
      if (!STRIPE_SECRET_KEY) {
        return jsonResponse(200, { error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });
      }

      // Stripe Checkout requires HTTPS return URLs.
      // Use a Supabase function bridge page to avoid GitHub Pages 404 issues.
      const bridgeBase = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/merchant-subscription-return`;
      const successUrl = `${bridgeBase}?checkout=success&paymentId=${encodeURIComponent(body.paymentId)}`;
      const cancelUrl = `${bridgeBase}?checkout=cancel&paymentId=${encodeURIComponent(body.paymentId)}`;

      const form = new URLSearchParams();
      form.set('mode', 'payment');
      form.set('success_url', successUrl);
      form.set('cancel_url', cancelUrl);
      form.set('payment_method_types[]', 'card');
      form.set('line_items[0][quantity]', '1');
      form.set('line_items[0][price_data][currency]', body.currency.toLowerCase());
      form.set('line_items[0][price_data][unit_amount]', String(Math.round(body.amountTl * 100)));
      form.set(
        'line_items[0][price_data][product_data][name]',
        body.billingPeriodMonths >= 12 ? 'Merchant Subscription - Yearly (%20 discount)' : 'Merchant Subscription - Monthly',
      );
      form.set('metadata[paymentId]', body.paymentId);
      form.set('metadata[userId]', userId);
      form.set('metadata[plan]', body.plan);
      form.set('metadata[billingPeriodMonths]', String(body.billingPeriodMonths));

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });

      const stripeJson = await stripeRes.json();
      if (!stripeRes.ok) {
        return jsonResponse(200, {
          error: 'Stripe session creation failed',
          details: stripeJson?.error?.message || 'Unknown Stripe error',
        });
      }

      const providerPaymentId = stripeJson?.id as string;
      const checkoutUrl = stripeJson?.url as string;

      await serviceClient
        .from('merchant_subscription_payments')
        .update({
          provider_payment_id: providerPaymentId,
          metadata: {
            ...(payment.metadata || {}),
            stripe_session_id: providerPaymentId,
            plan: body.plan,
          },
        })
        .eq('id', body.paymentId);

      return jsonResponse(200, {
        checkoutUrl,
        providerPaymentId,
      });
    }

    if (body.provider === 'iyzico') {
      if (!IYZICO_CHECKOUT_BASE_URL) {
        return jsonResponse(200, { error: 'Iyzico not configured. Set IYZICO_CHECKOUT_BASE_URL.' });
      }

      const providerPaymentId = `iyzico_${crypto.randomUUID()}`;
      const checkoutUrl = `${IYZICO_CHECKOUT_BASE_URL}?paymentId=${encodeURIComponent(body.paymentId)}&amountTl=${body.amountTl}&months=${body.billingPeriodMonths}&plan=${encodeURIComponent(body.plan)}`;

      await serviceClient
        .from('merchant_subscription_payments')
        .update({
          provider_payment_id: providerPaymentId,
          metadata: {
            ...(payment.metadata || {}),
            iyzico_reference: providerPaymentId,
            plan: body.plan,
          },
        })
        .eq('id', body.paymentId);

      return jsonResponse(200, {
        checkoutUrl,
        providerPaymentId,
      });
    }

    return jsonResponse(200, { error: 'Unsupported provider' });
  } catch (error) {
    console.error('merchant-subscription-checkout error:', error);
    return jsonResponse(200, { error: (error as Error).message || 'Internal error' });
  }
});
