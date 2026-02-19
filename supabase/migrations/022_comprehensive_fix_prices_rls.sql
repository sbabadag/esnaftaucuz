-- ============================================================================
-- COMPREHENSIVE FIX FOR PRICES TABLE RLS
-- ============================================================================
-- This migration completely fixes prices table RLS policies
-- ============================================================================

-- Step 1: Drop ALL existing policies on prices table
DROP POLICY IF EXISTS "Authenticated users can create prices" ON public.prices;
DROP POLICY IF EXISTS "Anyone can read prices" ON public.prices;
DROP POLICY IF EXISTS "Users can update own prices" ON public.prices;
DROP POLICY IF EXISTS "Users can delete own prices" ON public.prices;
DROP POLICY IF EXISTS "prices_insert_policy" ON public.prices;
DROP POLICY IF EXISTS "prices_select_policy" ON public.prices;
DROP POLICY IF EXISTS "prices_update_policy" ON public.prices;
DROP POLICY IF EXISTS "prices_delete_policy" ON public.prices;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

-- Step 3: Grant ALL necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prices TO authenticated;
GRANT SELECT ON public.prices TO anon;

-- Step 4: Create SELECT policy (everyone can read active prices)
CREATE POLICY "Anyone can read prices" ON public.prices
  FOR SELECT 
  USING (true);

-- Step 5: Create INSERT policy - ULTRA SIMPLIFIED VERSION
-- This policy allows any authenticated user to create prices
-- We check user_id in the application code, not in RLS
CREATE POLICY "Authenticated users can create prices" ON public.prices
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- Simply check if user is authenticated (using uid instead of role)
    auth.uid() IS NOT NULL
  );

-- Step 6: Create UPDATE policy (users can update their own prices)
CREATE POLICY "Users can update own prices" ON public.prices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 7: Create DELETE policy (users can delete their own prices)
CREATE POLICY "Users can delete own prices" ON public.prices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 8: Also ensure locations and products tables have proper policies
-- Locations: Everyone can read, authenticated can create
DROP POLICY IF EXISTS "Anyone can read locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;

CREATE POLICY "Anyone can read locations" ON public.locations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create locations" ON public.locations
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Products: Everyone can read, authenticated can create
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can create products" ON public.products;

CREATE POLICY "Anyone can read products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create products" ON public.products
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Step 9: Grant permissions on related tables
GRANT SELECT, INSERT ON public.locations TO authenticated;
GRANT SELECT ON public.locations TO anon;
GRANT SELECT, INSERT ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;

-- Step 10: Verify the setup
DO $$
DECLARE
  prices_policy_count INTEGER;
  prices_rls_enabled BOOLEAN;
  locations_policy_count INTEGER;
  products_policy_count INTEGER;
BEGIN
  -- Check prices RLS
  SELECT relrowsecurity INTO prices_rls_enabled
  FROM pg_class
  WHERE relname = 'prices' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  -- Count policies
  SELECT COUNT(*) INTO prices_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'prices';
  
  SELECT COUNT(*) INTO locations_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'locations';
  
  SELECT COUNT(*) INTO products_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'products';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRICES RLS FIX VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Prices RLS enabled: %', prices_rls_enabled;
  RAISE NOTICE 'Prices policies count: %', prices_policy_count;
  RAISE NOTICE 'Locations policies count: %', locations_policy_count;
  RAISE NOTICE 'Products policies count: %', products_policy_count;
  RAISE NOTICE '========================================';
END $$;

