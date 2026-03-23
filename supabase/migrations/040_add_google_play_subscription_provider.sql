-- Enable Google Play as a first-class merchant subscription payment provider.

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname
  INTO v_constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.merchant_subscription_payments'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%provider%'
    AND pg_get_constraintdef(c.oid) ILIKE '%stripe%'
    AND pg_get_constraintdef(c.oid) ILIKE '%iyzico%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.merchant_subscription_payments DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.merchant_subscription_payments
  ADD CONSTRAINT merchant_subscription_payments_provider_check
  CHECK (provider IN ('stripe', 'iyzico', 'manual_eft', 'google_play'));

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname
  INTO v_constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.merchant_subscription_webhook_events'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%provider%'
    AND pg_get_constraintdef(c.oid) ILIKE '%stripe%'
    AND pg_get_constraintdef(c.oid) ILIKE '%iyzico%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.merchant_subscription_webhook_events DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.merchant_subscription_webhook_events
  ADD CONSTRAINT merchant_subscription_webhook_events_provider_check
  CHECK (provider IN ('stripe', 'iyzico', 'google_play'));
