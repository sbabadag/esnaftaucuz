# Merchant Subscription Google Play Flow

This project now uses Google Play Billing for merchant subscriptions.

## Flow

1. Android app starts purchase with Google Play Billing.
2. App receives `purchaseToken` and `productId`.
3. App calls `POST /functions/v1/merchant-subscription-google-confirm`.
4. Edge Function verifies purchase using Google Play Developer API.
5. On success, payment is recorded and merchant entitlement is activated in `public.users`.

## Endpoint

- `supabase/functions/merchant-subscription-google-confirm`

## Pricing

- Monthly: `500 TL`
- Yearly: `6000 TL`

## Renewal behavior

- Active subscription status is resolved from authoritative purchase verification and persisted on user profile.
- `sync_merchant_subscription_status(...)` and `has_active_merchant_subscription(...)` continue to keep UI status fresh.

## Security notes

- Google Play verification must run server-side only.
- Keep service-account secrets only in Supabase secrets, never in client code.
