# Merchant Subscription Webhook Setup

This project now includes SQL functions for automatic subscription activation and renewal:

- `public.confirm_merchant_subscription_payment(...)`
- `public.fail_merchant_subscription_payment(...)`
- `public.activate_merchant_subscription(...)`
- `public.sync_merchant_subscription_status(...)`

The app creates pending payment rows in `public.merchant_subscription_payments`.
After provider confirms payment, your webhook handler must call the confirm function.

Edge Functions are now scaffolded under:

- `supabase/functions/merchant-subscription-checkout`
- `supabase/functions/merchant-subscription-webhook`

## Pricing

- Monthly: `1000 TL`
- Yearly: `9600 TL` (`%20` discount over 12 months)

## 1) Stripe/Iyzico webhook flow

1. App creates a `pending` payment row.
2. Provider checkout is completed.
3. Provider webhook calls your server/edge function.
4. Webhook handler verifies signature and maps provider transaction -> `paymentId`.
5. Webhook handler runs:

```sql
select * from public.confirm_merchant_subscription_payment(
  p_payment_id := '<payment-uuid>'::uuid,
  p_provider_payment_id := '<provider-payment-id>',
  p_paid_at := now(),
  p_metadata := '{"provider_event":"payment_success"}'::jsonb
);
```

This automatically:

- marks payment as `confirmed`
- sets merchant subscription to `active`
- extends period by `billing_period_months` (from current end if still active)
- applies plan mapping:
  - `merchant_basic_1000_tl_monthly` for monthly
  - `merchant_pro_annual_20_discount` for yearly

## 2) Failure flow

If provider marks payment as failed/canceled:

```sql
select public.fail_merchant_subscription_payment(
  p_payment_id := '<payment-uuid>'::uuid,
  p_failure_reason := 'payment_failed'
);
```

## 3) Manual EFT flow

- Merchant creates a `manual_eft` pending payment from app.
- Admin/backoffice verifies transfer.
- Admin confirms with the same `confirm_merchant_subscription_payment(...)` SQL call.

## 4) Renewal behavior

- Every successful confirmation extends subscription by N month(s).
- Expired active subscriptions are automatically switched to `inactive` by `sync_merchant_subscription_status(...)`.
- `has_active_merchant_subscription(...)` also triggers sync for freshness.

## 5) Security notes

- `confirm_merchant_subscription_payment` and `fail_merchant_subscription_payment` are granted to `service_role`.
- Call these only from trusted server-side code (Edge Function/backend), never directly from client.
- Validate provider webhook signatures before confirming payments.
