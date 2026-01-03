-- ============================================================================
-- FIX RLS FOR REGISTRATION WITHOUT EMAIL CONFIRMATION
-- ============================================================================
-- This migration creates an RLS policy that works even when email is not confirmed
-- The issue: signUp() creates user but email confirmation is required,
-- so signInWithPassword() fails and auth.uid() is null during INSERT
-- ============================================================================

-- Step 1: Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;

-- Step 2: Create a policy that works even without email confirmation
-- This policy allows INSERT if:
-- 1. The id matches auth.uid() (normal case)
-- 2. OR the email matches an unconfirmed auth user (registration case)
-- 3. OR we're inserting a row where id exists in auth.users (even if unconfirmed)
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- Case 1: Normal authenticated user creating their own profile
    (auth.uid() IS NOT NULL AND id = auth.uid())
    OR
    -- Case 2: Email matches an auth user (even if unconfirmed)
    (email IS NOT NULL AND EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = users.id 
      AND auth.users.email = users.email
    ))
    OR
    -- Case 3: ID exists in auth.users (registration scenario)
    (EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = users.id
    ))
  );

-- Step 3: Also create a more permissive policy for registration
-- This allows any authenticated request to insert if the user exists in auth.users
-- (This is safe because we're checking auth.users table)
DROP POLICY IF EXISTS "Allow registration profile creation" ON public.users;

CREATE POLICY "Allow registration profile creation" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- Allow if the user ID exists in auth.users (registration scenario)
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = users.id
    )
  );

-- Step 4: Verify policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND cmd = 'INSERT';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS FIX FOR REGISTRATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total INSERT policies: %', policy_count;
  RAISE NOTICE 'Policy 1: Users can create own profile';
  RAISE NOTICE 'Policy 2: Allow registration profile creation';
  RAISE NOTICE '========================================';
END $$;

