-- Keep users.merchant_subscription_status compatible with users CHECK constraint.
-- Stripe "trialing" is considered active entitlement for app gating.

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
        WHEN v_subscription_status IN ('trialing', 'active') THEN 'active'
        WHEN v_subscription_status = 'past_due' THEN 'past_due'
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
IS 'Upserts Stripe subscription and syncs users table using only allowed merchant status values';
