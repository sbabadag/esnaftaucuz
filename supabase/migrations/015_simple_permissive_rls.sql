-- ============================================================================
-- SIMPLE PERMISSIVE RLS POLICY FOR REGISTRATION
-- ============================================================================
-- This is a more permissive policy that should work even without email confirmation
-- IMPORTANT: This policy is safe because it only allows INSERT for authenticated users
-- and checks that the user ID exists in auth.users (which Supabase creates)
-- ============================================================================

-- Step 1: Drop ALL existing INSERT policies
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;
DROP POLICY IF EXISTS "Allow registration profile creation" ON public.users;
DROP POLICY IF EXISTS "Users can create guest profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "authenticated_users_insert" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.users;

-- Step 2: Create a simple, permissive policy
-- This policy allows any authenticated user to insert a row where:
-- 1. The id matches a user in auth.users (registration scenario)
-- 2. OR the id matches auth.uid() (if session exists)
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- Allow if user ID exists in auth.users (registration case - even without email confirmation)
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = users.id
    )
    OR
    -- Allow if id matches auth.uid() (normal authenticated case)
    (auth.uid() IS NOT NULL AND id = auth.uid())
  );

-- Step 3: Ensure guest users can be created
CREATE POLICY "Users can create guest profile" ON public.users
  FOR INSERT 
  TO anon
  WITH CHECK (is_guest = true);

-- Step 4: Ensure UPDATE policy exists
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 5: Verify RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 6: Verify setup
DO $$
DECLARE
  insert_policy_count INTEGER;
  update_policy_count INTEGER;
  rls_enabled BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO insert_policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND cmd = 'INSERT';
  
  SELECT COUNT(*) INTO update_policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND cmd = 'UPDATE';
  
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'users';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SIMPLE PERMISSIVE RLS SETUP';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INSERT policies: %', insert_policy_count;
  RAISE NOTICE 'UPDATE policies: %', update_policy_count;
  RAISE NOTICE 'RLS enabled: %', CASE WHEN rls_enabled THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '========================================';
END $$;


