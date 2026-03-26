-- Relax merchant_products RLS policies to only check ownership + is_merchant.
-- Subscription enforcement is handled at the application layer with caching,
-- REST fallbacks, and proper error messages.  Putting subscription logic in
-- RLS caused 403 errors on mobile when the subscription check timed out or
-- the period-end timestamp was stale.

DROP POLICY IF EXISTS "Merchants can insert own products" ON public.merchant_products;
DROP POLICY IF EXISTS "Merchants can update own products" ON public.merchant_products;
DROP POLICY IF EXISTS "Merchants can delete own products" ON public.merchant_products;

CREATE POLICY "Merchants can insert own products"
  ON public.merchant_products
  FOR INSERT
  WITH CHECK (
    merchant_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_merchant = TRUE)
  );

CREATE POLICY "Merchants can update own products"
  ON public.merchant_products
  FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete own products"
  ON public.merchant_products
  FOR DELETE
  USING (merchant_id = auth.uid());
