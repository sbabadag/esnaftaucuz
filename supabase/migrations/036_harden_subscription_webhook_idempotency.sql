-- Harden merchant subscription webhook idempotency and retry-safety.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.merchant_subscription_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'iyzico')),
  provider_event_id TEXT NOT NULL,
  payment_id UUID,
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_subscription_webhook_events_provider_event
  ON public.merchant_subscription_webhook_events(provider, provider_event_id);

CREATE INDEX IF NOT EXISTS idx_merchant_subscription_webhook_events_payment
  ON public.merchant_subscription_webhook_events(payment_id, received_at DESC);

CREATE OR REPLACE FUNCTION public.fail_merchant_subscription_payment(
  p_payment_id UUID,
  p_failure_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment public.merchant_subscription_payments%ROWTYPE;
BEGIN
  SELECT *
  INTO v_payment
  FROM public.merchant_subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found';
  END IF;

  IF v_payment.status = 'pending' THEN
    UPDATE public.merchant_subscription_payments
    SET status = 'failed',
        failure_reason = p_failure_reason
    WHERE id = p_payment_id;
  END IF;

  -- Idempotent behavior:
  -- if already failed/canceled/refunded/confirmed, keep current state and return payment id.
  RETURN v_payment.id;
END;
$$;

GRANT SELECT, INSERT ON public.merchant_subscription_webhook_events TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_merchant_subscription_payment(UUID, TEXT) TO service_role;
