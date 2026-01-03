-- ============================================================================
-- VERIFICATION QUERIES FOR MERCHANT REGISTRATION FIX
-- ============================================================================
-- Run these queries to verify the setup is correct
-- ============================================================================

-- 1. Check if is_merchant column exists
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'is_merchant';

-- 2. Check if INSERT policy exists
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'Users can create own profile';

-- 3. Check RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'users';

-- 4. Check search_radius column
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'search_radius';

-- 5. Test: Try to see current user structure
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

