-- Merchant subscription payment and renewal flow
-- Supports Stripe, Iyzico, and manual EFT tracking.

CREATE TABLE IF NOT EXISTS public.merchant_subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'iyzico', 'manual_eft')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'canceled', 'refunded')),
  amount_tl INTEGER NOT NULL CHECK (amount_tl > 0),
  currency TEXT NOT NULL DEFAULT 'TRY',
  billing_period_months INTEGER NOT NULL DEFAULT 1 CHECK (billing_period_months >= 1 AND billing_period_months <= 12),
  provider_payment_id TEXT,
  provider_reference TEXT,
  receipt_url TEXT,
  failure_reason TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_subscription_payments_user_id
  ON public.merchant_subscription_payments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_subscription_payments_status
  ON public.merchant_subscription_payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_subscription_payments_provider_payment_id
  ON public.merchant_subscription_payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_subscription_payments_provider_pid
  ON public.merchant_subscription_payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- Keep updated_at synchronized
DROP TRIGGER IF EXISTS update_merchant_subscription_payments_updated_at ON public.merchant_subscription_payments;
CREATE TRIGGER update_merchant_subscription_payments_updated_at
  BEFORE UPDATE ON public.merchant_subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.merchant_subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own merchant subscription payments" ON public.merchant_subscription_payments;
CREATE POLICY "Users can view own merchant subscription payments"
  ON public.merchant_subscription_payments
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own merchant subscription payments" ON public.merchant_subscription_payments;
CREATE POLICY "Users can create own merchant subscription payments"
  ON public.merchant_subscription_payments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_merchant = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can update own pending manual eft payments" ON public.merchant_subscription_payments;
CREATE POLICY "Users can update own pending manual eft payments"
  ON public.merchant_subscription_payments
  FOR UPDATE
  USING (
    user_id = auth.uid() AND
    provider = 'manual_eft' AND
    status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid() AND
    provider = 'manual_eft' AND
    status = 'pending'
  );

GRANT SELECT, INSERT, UPDATE ON public.merchant_subscription_payments TO authenticated;

-- Marks expired subscriptions as inactive.
CREATE OR REPLACE FUNCTION public.sync_merchant_subscription_status(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_updated INTEGER := 0;
BEGIN
  IF p_user_id IS NULL THEN
    UPDATE public.users
    SET merchant_subscription_status = 'inactive'
    WHERE is_merchant = TRUE
      AND merchant_subscription_status = 'active'
      AND merchant_subscription_current_period_end IS NOT NULL
      AND merchant_subscription_current_period_end <= NOW();

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  ELSE
    UPDATE public.users
    SET merchant_subscription_status = 'inactive'
    WHERE id = p_user_id
      AND is_merchant = TRUE
      AND merchant_subscription_status = 'active'
      AND merchant_subscription_current_period_end IS NOT NULL
      AND merchant_subscription_current_period_end <= NOW();

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  END IF;

  RETURN v_rows_updated;
END;
$$;

COMMENT ON FUNCTION public.sync_merchant_subscription_status(UUID)
IS 'Sets merchant subscription status to inactive when period end is in the past';

-- Activate/extend merchant subscription after successful payment.
CREATE OR REPLACE FUNCTION public.activate_merchant_subscription(
  p_user_id UUID,
  p_billing_period_months INTEGER DEFAULT 1,
  p_amount_tl INTEGER DEFAULT 1000,
  p_plan TEXT DEFAULT 'merchant_basic_1000_tl_monthly',
  p_paid_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  user_id UUID,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_end TIMESTAMPTZ;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_monthly_equivalent_fee_tl INTEGER;
BEGIN
  IF p_billing_period_months < 1 OR p_billing_period_months > 12 THEN
    RAISE EXCEPTION 'billing period months must be between 1 and 12';
  END IF;

  PERFORM 1
  FROM public.users
  WHERE id = p_user_id
    AND is_merchant = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant user not found or not merchant';
  END IF;

  SELECT merchant_subscription_current_period_end
  INTO v_current_end
  FROM public.users
  WHERE id = p_user_id;

  v_period_start := COALESCE(
    CASE
      WHEN v_current_end IS NOT NULL AND v_current_end > p_paid_at THEN v_current_end
      ELSE p_paid_at
    END,
    p_paid_at
  );

  v_period_end := v_period_start + make_interval(months => p_billing_period_months);
  v_monthly_equivalent_fee_tl := GREATEST(1, ROUND((p_amount_tl::NUMERIC / p_billing_period_months)));

  UPDATE public.users
  SET merchant_subscription_status = 'active',
      merchant_subscription_plan = p_plan,
      merchant_subscription_fee_tl = v_monthly_equivalent_fee_tl,
      merchant_subscription_current_period_start = v_period_start,
      merchant_subscription_current_period_end = v_period_end
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT p_user_id, v_period_start, v_period_end, 'active'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.activate_merchant_subscription(UUID, INTEGER, INTEGER, TEXT, TIMESTAMPTZ)
IS 'Activates or extends merchant subscription period after successful payment';

-- Confirm payment and activate subscription.
-- This function is intended to be called from trusted server-side code
-- (Edge Function or backend webhook handler using service role key).
CREATE OR REPLACE FUNCTION public.confirm_merchant_subscription_payment(
  p_payment_id UUID,
  p_provider_payment_id TEXT DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NOW(),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  payment_id UUID,
  user_id UUID,
  provider TEXT,
  status TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment public.merchant_subscription_payments%ROWTYPE;
  v_activation RECORD;
BEGIN
  SELECT *
  INTO v_payment
  FROM public.merchant_subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found';
  END IF;

  IF v_payment.status = 'confirmed' THEN
    SELECT *
    INTO v_activation
    FROM public.users u
    WHERE u.id = v_payment.user_id;

    RETURN QUERY
    SELECT
      v_payment.id,
      v_payment.user_id,
      v_payment.provider,
      v_payment.status,
      v_activation.merchant_subscription_current_period_start,
      v_activation.merchant_subscription_current_period_end;
    RETURN;
  END IF;

  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'only pending payments can be confirmed';
  END IF;

  UPDATE public.merchant_subscription_payments
  SET status = 'confirmed',
      provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
      paid_at = p_paid_at,
      metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
      failure_reason = NULL
  WHERE id = p_payment_id;

  SELECT *
  INTO v_activation
  FROM public.activate_merchant_subscription(
    v_payment.user_id,
    v_payment.billing_period_months,
    v_payment.amount_tl,
    CASE
      WHEN v_payment.billing_period_months >= 12 THEN 'merchant_pro_annual_20_discount'
      ELSE 'merchant_basic_1000_tl_monthly'
    END,
    p_paid_at
  );

  RETURN QUERY
  SELECT
    v_payment.id,
    v_payment.user_id,
    v_payment.provider,
    'confirmed'::TEXT,
    v_activation.period_start,
    v_activation.period_end;
END;
$$;

COMMENT ON FUNCTION public.confirm_merchant_subscription_payment(UUID, TEXT, TIMESTAMPTZ, JSONB)
IS 'Confirms subscription payment and activates/extends merchant subscription';

CREATE OR REPLACE FUNCTION public.fail_merchant_subscription_payment(
  p_payment_id UUID,
  p_failure_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  UPDATE public.merchant_subscription_payments
  SET status = 'failed',
      failure_reason = p_failure_reason
  WHERE id = p_payment_id
    AND status = 'pending'
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'pending payment not found';
  END IF;

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION public.fail_merchant_subscription_payment(UUID, TEXT)
IS 'Marks pending subscription payment as failed';

GRANT EXECUTE ON FUNCTION public.sync_merchant_subscription_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_merchant_subscription(UUID, INTEGER, INTEGER, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_merchant_subscription_payment(UUID, TEXT, TIMESTAMPTZ, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_merchant_subscription_payment(UUID, TEXT) TO service_role;

-- Keep has_active check fresh by synchronizing expiry before check.
CREATE OR REPLACE FUNCTION public.has_active_merchant_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_active BOOLEAN;
BEGIN
  PERFORM public.sync_merchant_subscription_status(p_user_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.is_merchant = TRUE
      AND u.merchant_subscription_status = 'active'
      AND u.merchant_subscription_current_period_end IS NOT NULL
      AND u.merchant_subscription_current_period_end > NOW()
  )
  INTO v_is_active;

  RETURN COALESCE(v_is_active, FALSE);
END;
$$;

COMMENT ON FUNCTION public.has_active_merchant_subscription(UUID)
IS 'Checks active merchant subscription and auto-syncs expiry status';
