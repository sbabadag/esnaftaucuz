# Supabase Edge Functions - Merchant Subscription

Project now uses Google Play Billing only.

## Functions

- `merchant-subscription-google-confirm`
- `dispatch-notification-push`

## Deploy

**Önerilen (token gerekir):** GitHub → Actions → **Deploy Supabase Edge (Google confirm)** → Run workflow.  
Repo **Secrets** içinde `SUPABASE_ACCESS_TOKEN` tanımlı olmalı ([token oluştur](https://supabase.com/dashboard/account/tokens)).

Yerel:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...   # Windows: set SUPABASE_ACCESS_TOKEN=...
supabase functions deploy merchant-subscription-google-confirm --project-ref xmskjcdwmwlcmjexnnxw
```

PowerShell: `scripts/deploy-supabase-google-confirm.ps1`

```bash
supabase functions deploy dispatch-notification-push
```

## Required Secrets

Set secrets in Supabase:

```bash
supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_ANON_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set GOOGLE_PLAY_PACKAGE_NAME=com.esnaftaucuz.app
supabase secrets set GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=play-billing-sa@project.iam.gserviceaccount.com
supabase secrets set GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
supabase secrets set GOOGLE_PLAY_SUBS_PRODUCT_ID_MONTHLY=merchant_basic_monthly
supabase secrets set GOOGLE_PLAY_SUBS_PRODUCT_ID_YEARLY=merchant_basic_yearly
supabase secrets set MERCHANT_SUBS_MONTHLY_AMOUNT_TL=500
supabase secrets set MERCHANT_SUBS_YEARLY_AMOUNT_TL=6000
supabase secrets set FCM_SERVER_KEY=AAAA...your-fcm-server-key...  # optional legacy
supabase secrets set FCM_PROJECT_ID=your-firebase-project-id
supabase secrets set FCM_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
supabase secrets set FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Endpoint

- Google Play purchase verify + activate:
  - `POST /functions/v1/merchant-subscription-google-confirm`
