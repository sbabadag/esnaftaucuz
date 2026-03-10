-- Ensure merchant shop browsing stays consistent for both merchant and customer flows.
-- 1) restore users read policy needed by merchant_products -> users joins
-- 2) align merchant_products select visibility with legacy null is_active rows

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users can read all profiles'
  ) THEN
    CREATE POLICY "Users can read all profiles"
      ON public.users
      FOR SELECT
      USING (true);
  END IF;
END $$;

DROP POLICY IF EXISTS "Merchants can view own products" ON public.merchant_products;
CREATE POLICY "Merchants can view own products"
  ON public.merchant_products
  FOR SELECT
  USING (
    merchant_id = auth.uid()
    OR COALESCE(is_active, true) = true
  );
