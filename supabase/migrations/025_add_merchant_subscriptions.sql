-- Merchant subscription model (1000 TL / month)
-- This migration introduces subscription fields for merchant accounts
-- and enforces active subscription for merchant product management.

-- 1) Add merchant subscription columns on users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS merchant_subscription_status TEXT DEFAULT 'inactive'
  CHECK (merchant_subscription_status IN ('inactive', 'active', 'past_due', 'canceled')),
ADD COLUMN IF NOT EXISTS merchant_subscription_plan TEXT DEFAULT 'merchant_basic_1000_tl_monthly',
ADD COLUMN IF NOT EXISTS merchant_subscription_fee_tl INTEGER DEFAULT 1000 CHECK (merchant_subscription_fee_tl >= 0),
ADD COLUMN IF NOT EXISTS merchant_subscription_current_period_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS merchant_subscription_current_period_end TIMESTAMPTZ;

COMMENT ON COLUMN public.users.merchant_subscription_status IS 'Merchant subscription state: inactive, active, past_due, canceled';
COMMENT ON COLUMN public.users.merchant_subscription_plan IS 'Subscription plan code for merchant accounts';
COMMENT ON COLUMN public.users.merchant_subscription_fee_tl IS 'Monthly merchant subscription fee in Turkish Lira';
COMMENT ON COLUMN public.users.merchant_subscription_current_period_start IS 'Current billing period start for merchant subscription';
COMMENT ON COLUMN public.users.merchant_subscription_current_period_end IS 'Current billing period end for merchant subscription';

CREATE INDEX IF NOT EXISTS idx_users_merchant_subscription_status
  ON public.users(merchant_subscription_status)
  WHERE is_merchant = TRUE;

-- 2) Function to check if merchant has active subscription
CREATE OR REPLACE FUNCTION public.has_active_merchant_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.is_merchant = TRUE
      AND u.merchant_subscription_status = 'active'
      AND u.merchant_subscription_current_period_end IS NOT NULL
      AND u.merchant_subscription_current_period_end > NOW()
  );
$$;

COMMENT ON FUNCTION public.has_active_merchant_subscription(UUID)
IS 'Returns true when merchant subscription is active and current period has not ended';

-- 3) Tighten merchant_products policies to require active subscription
DROP POLICY IF EXISTS "Merchants can insert own products" ON public.merchant_products;
DROP POLICY IF EXISTS "Merchants can update own products" ON public.merchant_products;
DROP POLICY IF EXISTS "Merchants can delete own products" ON public.merchant_products;

CREATE POLICY "Merchants can insert own products"
  ON public.merchant_products
  FOR INSERT
  WITH CHECK (
    merchant_id = auth.uid() AND
    public.has_active_merchant_subscription(auth.uid())
  );

CREATE POLICY "Merchants can update own products"
  ON public.merchant_products
  FOR UPDATE
  USING (
    merchant_id = auth.uid() AND
    public.has_active_merchant_subscription(auth.uid())
  )
  WITH CHECK (
    merchant_id = auth.uid() AND
    public.has_active_merchant_subscription(auth.uid())
  );

CREATE POLICY "Merchants can delete own products"
  ON public.merchant_products
  FOR DELETE
  USING (
    merchant_id = auth.uid() AND
    public.has_active_merchant_subscription(auth.uid())
  );

GRANT EXECUTE ON FUNCTION public.has_active_merchant_subscription(UUID) TO authenticated;
