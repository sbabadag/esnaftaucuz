# Supabase Edge Functions - Merchant Subscription

Functions added:

- `merchant-subscription-checkout`
- `merchant-subscription-webhook`

## Deploy

```bash
supabase functions deploy merchant-subscription-checkout
supabase functions deploy merchant-subscription-webhook
```

## Required Secrets

Set secrets in Supabase:

```bash
supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_ANON_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set PUBLIC_APP_URL=https://your-app-domain
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set IYZICO_CHECKOUT_BASE_URL=https://your-iyzico-checkout-host
supabase secrets set IYZICO_WEBHOOK_SECRET=your_iyzico_webhook_secret
```

## Endpoints

After deploy:

- Checkout init:
  - `POST /functions/v1/merchant-subscription-checkout`
- Webhook:
  - Stripe: `POST /functions/v1/merchant-subscription-webhook?provider=stripe`
  - Iyzico: `POST /functions/v1/merchant-subscription-webhook?provider=iyzico`

## Stripe Notes

- Uses Stripe Checkout Session API.
- Google Pay can show automatically on eligible Android/Chrome environments.
- Webhook events handled:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.expired`
  - `checkout.session.async_payment_failed`

## Iyzico Notes

- Checkout function currently expects an externally hosted Iyzico checkout URL base (`IYZICO_CHECKOUT_BASE_URL`).
- Webhook function expects JSON with:
  - `paymentId`
  - `status` (`success`/`failed`/etc)
  - optional `providerPaymentId`
- If your Iyzico signature/canonical format differs, adapt signature validation logic in the function.
