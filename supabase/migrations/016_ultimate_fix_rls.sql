-- ============================================================================
-- ULTIMATE FIX FOR RLS REGISTRATION ISSUE
-- ============================================================================
-- This migration creates the simplest possible RLS policy that should work
-- ============================================================================

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;
DROP POLICY IF EXISTS "Allow registration profile creation" ON public.users;
DROP POLICY IF EXISTS "Users can create guest profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "authenticated_users_insert" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.users;

-- Step 2: Grant INSERT permission to authenticated role
-- This is safe because RLS will still control what can be inserted
GRANT INSERT ON public.users TO authenticated;

-- Step 3: Create the simplest possible INSERT policy
-- This policy allows INSERT if the user ID exists in auth.users
-- (which Supabase creates during signUp, even without email confirmation)
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- Allow if user ID exists in auth.users (registration scenario)
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = users.id
    )
  );

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
BEGIN
  SELECT COUNT(*) INTO insert_policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND cmd = 'INSERT';
  
  -- Check if grant exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND grantee = 'authenticated'
    AND privilege_type = 'INSERT'
  ) INTO has_grant;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ULTIMATE RLS FIX';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INSERT policies: %', insert_policy_count;
  RAISE NOTICE 'INSERT grant to authenticated: %', CASE WHEN has_grant THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'RLS enabled: YES';
  RAISE NOTICE '========================================';
END $$;


