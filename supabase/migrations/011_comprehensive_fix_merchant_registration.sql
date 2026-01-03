-- Comprehensive fix for merchant registration permission errors
-- This migration ensures all required columns exist and RLS policies are correct

-- Step 1: Ensure all required columns exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS search_radius INTEGER DEFAULT 15;

-- Step 2: Update search_radius constraint if needed
DO $$
BEGIN
  -- Check if constraint exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_search_radius_check'
  ) THEN
    ALTER TABLE public.users
    ADD CONSTRAINT users_search_radius_check 
    CHECK (search_radius >= 1 AND search_radius <= 1000);
  END IF;
END $$;

-- Step 3: Ensure search_radius has NOT NULL constraint
ALTER TABLE public.users
ALTER COLUMN search_radius SET NOT NULL;

-- Step 4: Update any NULL search_radius values
UPDATE public.users
SET search_radius = 15
WHERE search_radius IS NULL;

-- Step 5: Drop and recreate INSERT policy to ensure it works with all columns
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;

-- Create comprehensive INSERT policy that allows all columns
-- RLS policies work at row level, not column level, so we only need to check auth.uid() = id
-- All columns (including is_merchant) will be allowed if this check passes
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step 6: Add comment for documentation
COMMENT ON COLUMN public.users.is_merchant IS 'Indicates if the user registered as a merchant (esnaf). Default: false.';

-- Step 7: Create index for merchant queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_is_merchant ON public.users(is_merchant) WHERE is_merchant = TRUE;

