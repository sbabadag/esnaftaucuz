-- Add is_merchant column to users table
-- This field indicates if the user registered as a merchant (esnaf)

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.users.is_merchant IS 'Indicates if the user registered as a merchant (esnaf)';

-- Create index for merchant queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_users_is_merchant ON public.users(is_merchant) WHERE is_merchant = TRUE;

