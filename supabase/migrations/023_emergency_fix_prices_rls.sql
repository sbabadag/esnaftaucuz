-- ============================================================================
-- EMERGENCY FIX FOR PRICES TABLE RLS - ULTRA PERMISSIVE
-- ============================================================================
-- This migration creates the most permissive policy possible for testing
-- ============================================================================

-- Step 1: Drop ALL existing policies
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

-- Step 3: Grant ALL permissions
GRANT ALL ON public.prices TO authenticated;
GRANT SELECT ON public.prices TO anon;

-- Step 4: Create ultra-permissive SELECT policy
CREATE POLICY "Anyone can read prices" ON public.prices
  FOR SELECT 
  USING (true);

-- Step 5: Create ultra-permissive INSERT policy
-- This allows ANY authenticated user to insert ANY price
CREATE POLICY "Authenticated users can create prices" ON public.prices
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);  -- No restrictions at all

-- Step 6: Create UPDATE policy
CREATE POLICY "Users can update own prices" ON public.prices
  FOR UPDATE
  TO authenticated
  USING (true)  -- Allow all authenticated users to update
  WITH CHECK (true);

-- Step 7: Create DELETE policy  
CREATE POLICY "Users can delete own prices" ON public.prices
  FOR DELETE
  TO authenticated
  USING (true);  -- Allow all authenticated users to delete

-- Step 8: Also fix locations and products tables
-- Locations
DROP POLICY IF EXISTS "Anyone can read locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;

CREATE POLICY "Anyone can read locations" ON public.locations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create locations" ON public.locations
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

GRANT ALL ON public.locations TO authenticated;
GRANT SELECT ON public.locations TO anon;

-- Products
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can create products" ON public.products;

CREATE POLICY "Anyone can read products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create products" ON public.products
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

GRANT ALL ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;

-- Step 9: Verify
DO $$
DECLARE
  prices_policy_count INTEGER;
  prices_rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO prices_rls_enabled
  FROM pg_class
  WHERE relname = 'prices' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  SELECT COUNT(*) INTO prices_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'prices';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'EMERGENCY RLS FIX APPLIED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Prices RLS enabled: %', prices_rls_enabled;
  RAISE NOTICE 'Prices policies count: %', prices_policy_count;
  RAISE NOTICE '========================================';
END $$;



