-- Fix search_radius constraint: Ensure NOT NULL and update any NULL values
-- This migration ensures all users have a valid search_radius value

-- First, update any NULL values to default (15)
UPDATE public.users 
SET search_radius = 15 
WHERE search_radius IS NULL;

-- Add NOT NULL constraint (if column allows NULL)
-- Note: This will fail if there are still NULL values, but we just updated them above
DO $$ 
BEGIN
    -- Check if column is nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'search_radius'
        AND is_nullable = 'YES'
    ) THEN
        -- Make column NOT NULL
        ALTER TABLE public.users 
        ALTER COLUMN search_radius SET NOT NULL;
    END IF;
END $$;

-- Ensure DEFAULT is set
ALTER TABLE public.users 
ALTER COLUMN search_radius SET DEFAULT 15;

-- Re-apply CHECK constraint to ensure it's correct
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_search_radius_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_search_radius_check 
CHECK (search_radius >= 1 AND search_radius <= 1000);

