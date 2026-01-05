-- Force fix for merchant registration RLS issue
-- This migration removes all conflicting policies and creates a clean one

-- Step 1: Drop ALL existing INSERT policies on users table
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;
DROP POLICY IF EXISTS "Users can create guest profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "authenticated_users_insert" ON public.users;

-- Step 2: Ensure is_merchant column exists with proper defaults
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE;

-- Step 3: Ensure search_radius exists and is NOT NULL
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS search_radius INTEGER DEFAULT 15;

-- Update NULL values
UPDATE public.users
SET search_radius = 15
WHERE search_radius IS NULL;

-- Make sure it's NOT NULL
DO $$
BEGIN
  -- Check if column is nullable, if so make it NOT NULL
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

-- Step 7: Grant necessary permissions (if needed)
-- Note: This might require superuser privileges
-- GRANT INSERT ON public.users TO authenticated;


