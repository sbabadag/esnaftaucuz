-- ============================================================================
-- FINAL FIX FOR MERCHANT REGISTRATION RLS ISSUE
-- ============================================================================
-- This migration creates a more permissive RLS policy that should work
-- ============================================================================

-- Step 1: Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;
DROP POLICY IF EXISTS "Users can create guest profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "authenticated_users_insert" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.users;

-- Step 2: Ensure columns exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS search_radius INTEGER DEFAULT 15;

-- Update NULL values
UPDATE public.users
SET search_radius = 15
WHERE search_radius IS NULL;



CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- Primary check: id must match auth.uid()
    id = auth.uid()
    OR
    -- Fallback: allow if email matches authenticated user's email
    (email IS NOT NULL AND email IN (SELECT email FROM auth.users WHERE id = auth.uid()))
  );


-- Step 5: Ensure guest users can be created
CREATE POLICY "Users can create guest profile" ON public.users
  FOR INSERT 
  TO anon
  WITH CHECK (is_guest = true);

-- Step 6: Ensure UPDATE policy exists for is_merchant updates
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 7: Verify RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 8: Test query to verify policy
DO $$
DECLARE
  policy_count INTEGER;
  rls_enabled BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND policyname = 'Users can create own profile';
  
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'users';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL MERCHANT REGISTRATION FIX';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INSERT Policy count: %', policy_count;
  RAISE NOTICE 'RLS enabled: %', CASE WHEN rls_enabled THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '========================================';
END $$;

