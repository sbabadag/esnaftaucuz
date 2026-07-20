-- ============================================================================
-- Re-enable prices RLS (disabled by 024) and harden emergency-permissive policies
-- ============================================================================
-- Context:
--   023 made prices UPDATE/DELETE ultra-permissive (USING true)
--   024 disabled RLS on prices entirely (never re-enabled)
--   031 allowed PUBLIC (incl. anon) location inserts
-- App price inserts already require a real auth session (auth.uid()).
-- ============================================================================

-- --------------------------------------------------------------------------
-- PRICES
-- --------------------------------------------------------------------------
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can create prices" ON public.prices;
DROP POLICY IF EXISTS "Anyone can read prices" ON public.prices;
DROP POLICY IF EXISTS "Users can update own prices" ON public.prices;
DROP POLICY IF EXISTS "Users can delete own prices" ON public.prices;
DROP POLICY IF EXISTS "prices_insert_policy" ON public.prices;
DROP POLICY IF EXISTS "prices_select_policy" ON public.prices;
DROP POLICY IF EXISTS "prices_update_policy" ON public.prices;
DROP POLICY IF EXISTS "prices_delete_policy" ON public.prices;

GRANT SELECT ON public.prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prices TO authenticated;
GRANT ALL ON public.prices TO service_role;

CREATE POLICY "Anyone can read prices"
  ON public.prices
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create prices"
  ON public.prices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update own prices"
  ON public.prices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prices"
  ON public.prices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- LOCATIONS — public read; inserts only for authenticated (not open anon)
-- --------------------------------------------------------------------------
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can create locations" ON public.locations;
DROP POLICY IF EXISTS "Users can update own locations" ON public.locations;
DROP POLICY IF EXISTS "Users can delete own locations" ON public.locations;

REVOKE INSERT ON public.locations FROM anon;
GRANT SELECT ON public.locations TO anon;
GRANT SELECT, INSERT ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;

CREATE POLICY "Anyone can read locations"
  ON public.locations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create locations"
  ON public.locations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- --------------------------------------------------------------------------
-- PRODUCTS — public read; inserts only for authenticated
-- --------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can create products" ON public.products;

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

CREATE POLICY "Public read products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- --------------------------------------------------------------------------
-- Verify
-- --------------------------------------------------------------------------
DO $$
DECLARE
  prices_rls BOOLEAN;
  locations_rls BOOLEAN;
  products_rls BOOLEAN;
  prices_policies INTEGER;
BEGIN
  SELECT relrowsecurity INTO prices_rls
  FROM pg_class
  WHERE relname = 'prices' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  SELECT relrowsecurity INTO locations_rls
  FROM pg_class
  WHERE relname = 'locations' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  SELECT relrowsecurity INTO products_rls
  FROM pg_class
  WHERE relname = 'products' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  SELECT COUNT(*) INTO prices_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'prices';

  RAISE NOTICE '044 harden RLS — prices.enabled=% policies=% | locations.enabled=% | products.enabled=%',
    prices_rls, prices_policies, locations_rls, products_rls;

  IF NOT prices_rls THEN
    RAISE EXCEPTION 'prices RLS failed to enable';
  END IF;
END $$;
