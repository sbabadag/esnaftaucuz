-- Fix RLS policy to allow is_merchant column in INSERT
-- This ensures users can register as merchants without permission errors

-- Drop and recreate the INSERT policy to ensure it works with is_merchant
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;

-- Create policy: Authenticated users can insert their own profile
-- This policy allows all columns including is_merchant
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Ensure is_merchant column exists (idempotent)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE;

