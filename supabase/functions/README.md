# Supabase Edge Functions - Merchant Subscription

Functions added:

- `merchant-subscription-create`
- `merchant-subscription-cancel`
- `merchant-subscription-checkout`
- `merchant-subscription-webhook`
- `dispatch-notification-push`

## Deploy

```bash
supabase functions deploy merchant-subscription-create
supabase functions deploy merchant-subscription-cancel
supabase functions deploy merchant-subscription-checkout
supabase functions deploy merchant-subscription-webhook
supabase functions deploy dispatch-notification-push
```

## Required Secrets

Set secrets in Supabase:

```bash
supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_ANON_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set PUBLIC_APP_URL=https://your-app-domain
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_live_or_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_ID_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_ID_YEARLY=price_...   # optional
supabase secrets set STRIPE_API_VERSION=2024-06-20      # optional
supabase secrets set IYZICO_CHECKOUT_BASE_URL=https://your-iyzico-checkout-host
supabase secrets set IYZICO_API_KEY=your_iyzico_api_key                 # iyzico direct API entegrasyonu icin
supabase secrets set IYZICO_SECRET_KEY=your_iyzico_secret_key           # iyzico direct API entegrasyonu icin
supabase secrets set IYZICO_BASE_URL=https://api.iyzipay.com            # optional, sandbox icin degistirin
supabase secrets set IYZICO_WEBHOOK_SECRET=your_iyzico_webhook_secret
supabase secrets set FCM_SERVER_KEY=AAAA...your-fcm-server-key...  # optional legacy
supabase secrets set FCM_PROJECT_ID=your-firebase-project-id
supabase secrets set FCM_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
supabase secrets set FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Endpoints

After deploy:

- Native subscription create:
  - `POST /functions/v1/merchant-subscription-create`
- Subscription cancel:
  - `POST /functions/v1/merchant-subscription-cancel`
- Checkout init:
  - `POST /functions/v1/merchant-subscription-checkout`
- Webhook:
  - Stripe: `POST /functions/v1/merchant-subscription-webhook?provider=stripe`
  - Iyzico: `POST /functions/v1/merchant-subscription-webhook?provider=iyzico`

## Stripe Notes

- Uses Stripe Checkout Session API.
- Native flow uses Stripe PaymentSheet initialization endpoint (`merchant-subscription-create`).
- Google Pay can show automatically on eligible Android/Chrome environments.
- Webhook events handled:
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - (legacy) `checkout.session.*`

## Iyzico Notes

- Checkout function currently expects an externally hosted Iyzico checkout URL base (`IYZICO_CHECKOUT_BASE_URL`).
- `IYZICO_API_KEY` ve `IYZICO_SECRET_KEY` alanlari direct API akisi icin hazir tutulur (kullanim senaryosuna gore devreye alinabilir).
- Webhook function expects JSON with:
  - `paymentId`
  - `status` (`success`/`failed`/etc)
  - optional `providerPaymentId`
- If your Iyzico signature/canonical format differs, adapt signature validation logic in the function.
