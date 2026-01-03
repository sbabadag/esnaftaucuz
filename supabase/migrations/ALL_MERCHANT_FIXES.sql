-- ============================================================================
-- COMPREHENSIVE MERCHANT REGISTRATION FIX
-- ============================================================================
-- This file combines all fixes for merchant registration permission errors
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- Step 1: Drop ALL existing INSERT policies on users table to avoid conflicts
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;
DROP POLICY IF EXISTS "Users can create guest profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "authenticated_users_insert" ON public.users;

-- Step 2: Ensure is_merchant column exists with proper defaults
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE;

-- Step 3: Ensure search_radius exists and is properly configured
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS search_radius INTEGER DEFAULT 15;

-- Update any NULL values
UPDATE public.users
SET search_radius = 15
WHERE search_radius IS NULL;

-- Ensure search_radius constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_search_radius_check'
  ) THEN
    ALTER TABLE public.users
    ADD CONSTRAINT users_search_radius_check 
    CHECK (search_radius >= 1 AND search_radius <= 1000);
  END IF;
END $$;

-- Make sure search_radius is NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'search_radius' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.users
    ALTER COLUMN search_radius SET NOT NULL;
  END IF;
END $$;

-- Step 4: Create a simple, permissive INSERT policy
-- This policy allows authenticated users to insert their own profile
-- with ANY column values (including is_merchant)
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step 5: Also ensure guest users can be created
CREATE POLICY "Users can create guest profile" ON public.users
  FOR INSERT 
  TO anon
  WITH CHECK (is_guest = true);

-- Step 6: Verify RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 7: Add comments for documentation
COMMENT ON COLUMN public.users.is_merchant IS 'Indicates if the user registered as a merchant (esnaf). Default: false.';

-- Step 8: Create index for merchant queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_is_merchant ON public.users(is_merchant) WHERE is_merchant = TRUE;

-- Step 9: Verify the setup
DO $$
DECLARE
  policy_count INTEGER;
  column_exists BOOLEAN;
BEGIN
  -- Check if policy exists
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND policyname = 'Users can create own profile';
  
  -- Check if column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'is_merchant'
  ) INTO column_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MERCHANT REGISTRATION FIX - VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INSERT Policy exists: %', CASE WHEN policy_count > 0 THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'is_merchant column exists: %', CASE WHEN column_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'RLS enabled: YES (enforced above)';
  RAISE NOTICE '========================================';
END $$;

