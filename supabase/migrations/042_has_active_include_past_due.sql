-- Treat past_due (grace / on-hold) as "active" for in-app merchant access,
-- consistent with MerchantSubscriptionScreen and Google Play edge function.

CREATE OR REPLACE FUNCTION public.has_active_merchant_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      AND u.merchant_subscription_status IN ('active', 'past_due')
      AND u.merchant_subscription_current_period_end IS NOT NULL
      AND u.merchant_subscription_current_period_end > NOW()
  )
  INTO v_is_active;

  RETURN COALESCE(v_is_active, FALSE);
END;
$$;

COMMENT ON FUNCTION public.has_active_merchant_subscription(UUID)
IS 'True if merchant subscription is active or past_due with period not ended';
