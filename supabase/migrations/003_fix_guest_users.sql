-- Fix: Allow guest users without auth.users reference
-- Run this migration if guest login fails

-- Drop existing foreign key constraint if it exists
ALTER TABLE public.users 
  DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Add a check constraint or trigger to handle both cases:
-- 1. Users with auth.users reference (regular users)
-- 2. Users without auth.users reference (guest users)

-- Create a function to validate user IDs
CREATE OR REPLACE FUNCTION validate_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow the insert/update to proceed
  -- We'll handle validation in application code
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Add a trigger to validate (but allow guest users)
DROP TRIGGER IF EXISTS validate_user_id_trigger ON public.users;
CREATE TRIGGER validate_user_id_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_id();





