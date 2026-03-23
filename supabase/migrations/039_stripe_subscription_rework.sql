-- Stripe native subscription rework
-- Adds first-class subscription entities and Stripe linkage fields.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS merchant_subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS merchant_subscription_last_event_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON public.users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id
  ON public.users(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.merchant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe')),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  stripe_price_id TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')
  ),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_subscriptions_stripe_subscription_id
  ON public.merchant_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_user_id
  ON public.merchant_subscriptions(user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_merchant_subscriptions_updated_at ON public.merchant_subscriptions;
CREATE TRIGGER update_merchant_subscriptions_updated_at
  BEFORE UPDATE ON public.merchant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own merchant subscriptions" ON public.merchant_subscriptions;
CREATE POLICY "Users can view own merchant subscriptions"
  ON public.merchant_subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

GRANT SELECT ON public.merchant_subscriptions TO authenticated;

ALTER TABLE public.merchant_subscription_payments
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.merchant_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_merchant_subscription_payments_subscription_id
  ON public.merchant_subscription_payments(subscription_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_subscription_payments_stripe_invoice_id
  ON public.merchant_subscription_payments(provider, stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_subscription_payments_stripe_payment_intent_id
  ON public.merchant_subscription_payments(provider, stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_merchant_subscription_from_stripe(
  p_user_id UUID,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_stripe_price_id TEXT,
  p_status TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN DEFAULT FALSE,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
  v_subscription_status TEXT;
BEGIN
  v_subscription_status := LOWER(COALESCE(p_status, 'incomplete'));
  IF v_subscription_status NOT IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid') THEN
    RAISE EXCEPTION 'unsupported stripe status: %', p_status;
  END IF;

  INSERT INTO public.merchant_subscriptions (
    user_id,
    provider,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    metadata
  )
  VALUES (
    p_user_id,
    'stripe',
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_stripe_price_id,
    v_subscription_status,
    p_current_period_start,
    p_current_period_end,
    COALESCE(p_cancel_at_period_end, FALSE),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_price_id = EXCLUDED.stripe_price_id,
      status = EXCLUDED.status,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      metadata = COALESCE(public.merchant_subscriptions.metadata, '{}'::jsonb) || EXCLUDED.metadata
  RETURNING id INTO v_subscription_id;

  UPDATE public.users
  SET is_merchant = TRUE,
      stripe_customer_id = p_stripe_customer_id,
      stripe_subscription_id = p_stripe_subscription_id,
      stripe_price_id = p_stripe_price_id,
      merchant_subscription_status = CASE
        WHEN v_subscription_status IN ('trialing', 'active', 'past_due') THEN v_subscription_status
        WHEN v_subscription_status = 'canceled' THEN 'canceled'
        ELSE 'inactive'
      END,
      merchant_subscription_current_period_start = p_current_period_start,
      merchant_subscription_current_period_end = p_current_period_end,
      merchant_subscription_cancel_at_period_end = COALESCE(p_cancel_at_period_end, FALSE),
      merchant_subscription_last_event_at = NOW()
  WHERE id = p_user_id;

  RETURN v_subscription_id;
END;
$$;

COMMENT ON FUNCTION public.sync_merchant_subscription_from_stripe(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, JSONB)
IS 'Upserts Stripe subscription and synchronizes merchant subscription fields on users table';

GRANT EXECUTE ON FUNCTION public.sync_merchant_subscription_from_stripe(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, JSONB) TO service_role;
