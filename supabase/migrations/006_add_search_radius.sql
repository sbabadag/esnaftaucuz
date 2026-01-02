-- Add search_radius column to users table
-- This column stores the user's preferred search radius in kilometers for nearby price searches
-- Default: 15 km

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS search_radius INTEGER DEFAULT 15 CHECK (search_radius >= 1 AND search_radius <= 1000);

-- Update existing users to have default search radius
UPDATE public.users 
SET search_radius = 15 
WHERE search_radius IS NULL;

-- Add comment
COMMENT ON COLUMN public.users.search_radius IS 'User preferred search radius in kilometers for nearby price searches (default: 15 km)';

