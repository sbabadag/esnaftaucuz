-- ============================================================================
-- TEMPORARY FIX: DISABLE RLS ON PRICES TABLE FOR TESTING
-- ============================================================================
-- WARNING: This disables RLS temporarily. Re-enable after fixing the issue.
-- ============================================================================

-- Step 1: Disable RLS on prices table (TEMPORARY - FOR TESTING ONLY)
ALTER TABLE public.prices DISABLE ROW LEVEL SECURITY;

-- Step 2: Ensure all permissions are granted
GRANT ALL ON public.prices TO authenticated;
GRANT SELECT ON public.prices TO anon;
GRANT ALL ON public.prices TO service_role;

-- Step 3: Also ensure locations and products have proper permissions
GRANT ALL ON public.locations TO authenticated;
GRANT SELECT ON public.locations TO anon;
GRANT ALL ON public.locations TO service_role;

GRANT ALL ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT ALL ON public.products TO service_role;

-- Step 4: Verify
DO $$
DECLARE
  prices_rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO prices_rls_enabled
  FROM pg_class
  WHERE relname = 'prices' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS TEMPORARILY DISABLED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Prices RLS enabled: %', prices_rls_enabled;
  RAISE NOTICE 'WARNING: RLS is DISABLED - re-enable after fixing!';
  RAISE NOTICE '========================================';
END $$;



