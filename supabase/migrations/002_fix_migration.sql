-- Fix migration: Drop existing objects before recreating
-- Run this if you get "already exists" errors

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_user_level ON public.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
DROP TRIGGER IF EXISTS update_prices_updated_at ON public.prices;

-- Drop functions
DROP FUNCTION IF EXISTS update_user_level() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS increment_location_price_count(UUID) CASCADE;

-- Drop policies
DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can create products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can read prices" ON public.prices;
DROP POLICY IF EXISTS "Authenticated users can create prices" ON public.prices;
DROP POLICY IF EXISTS "Users can update own prices" ON public.prices;

-- Now you can re-run 001_initial_schema.sql safely

