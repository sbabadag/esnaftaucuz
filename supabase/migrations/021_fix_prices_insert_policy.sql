-- Fix prices INSERT policy for individual users
-- This ensures authenticated users can create prices with their own user_id

-- Step 1: Drop ALL existing policies on prices table
DROP POLICY IF EXISTS "Authenticated users can create prices" ON public.prices;
DROP POLICY IF EXISTS "Anyone can read prices" ON public.prices;
DROP POLICY IF EXISTS "Users can update own prices" ON public.prices;
DROP POLICY IF EXISTS "Users can delete own prices" ON public.prices;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

-- Step 3: Grant necessary permissions (if not already granted)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prices TO authenticated;
GRANT SELECT ON public.prices TO anon;

-- Step 4: Create SELECT policy (everyone can read)
CREATE POLICY "Anyone can read prices" ON public.prices
  FOR SELECT 
  USING (true);

-- Step 5: Create INSERT policy (authenticated users can create prices with their own user_id)
CREATE POLICY "Authenticated users can create prices" ON public.prices
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- User can only create prices with their own user_id
    user_id = auth.uid()
  );

-- Step 6: Create UPDATE policy (users can update their own prices)
CREATE POLICY "Users can update own prices" ON public.prices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 7: Create DELETE policy (users can delete their own prices)
CREATE POLICY "Users can delete own prices" ON public.prices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 8: Verify the setup
DO $$
DECLARE
  policy_count INTEGER;
  rls_enabled BOOLEAN;
BEGIN
  -- Check RLS is enabled
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'prices' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'prices';
  
  RAISE NOTICE 'Prices table RLS enabled: %', rls_enabled;
  RAISE NOTICE 'Prices table policies count: %', policy_count;
END $$;

