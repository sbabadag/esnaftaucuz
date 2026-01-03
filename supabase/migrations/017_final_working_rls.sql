-- ============================================================================
-- FINAL WORKING RLS POLICY
-- ============================================================================
-- This migration should work because auth.uid() is now available
-- ============================================================================

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;
DROP POLICY IF EXISTS "Allow registration profile creation" ON public.users;
DROP POLICY IF EXISTS "Users can create guest profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "authenticated_users_insert" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.users;

-- Step 2: Grant INSERT permission (if not already granted)
GRANT INSERT ON public.users TO authenticated;

-- Step 3: Create simple INSERT policy using auth.uid()
-- Since auth.uid() is now available, this should work
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step 4: Ensure guest users can be created
CREATE POLICY "Users can create guest profile" ON public.users
  FOR INSERT 
  TO anon
  WITH CHECK (is_guest = true);

-- Step 5: Ensure UPDATE policy exists
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 6: Verify RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 7: Verify setup
DO $$
DECLARE
  insert_policy_count INTEGER;
  has_grant BOOLEAN;
  rls_enabled BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO insert_policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND cmd = 'INSERT' AND policyname = 'Users can create own profile';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND grantee = 'authenticated'
    AND privilege_type = 'INSERT'
  ) INTO has_grant;
  
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'users';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL WORKING RLS SETUP';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INSERT policy exists: %', CASE WHEN insert_policy_count > 0 THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'INSERT grant to authenticated: %', CASE WHEN has_grant THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'RLS enabled: %', CASE WHEN rls_enabled THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '========================================';
END $$;

