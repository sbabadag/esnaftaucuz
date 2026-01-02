-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
-- Note: id can reference auth.users OR be a standalone UUID for guest users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar TEXT,
  google_id TEXT,
  is_guest BOOLEAN DEFAULT FALSE,
  level TEXT DEFAULT 'Mahalleli' CHECK (level IN ('Yeni', 'Mahalleli', 'Uzman', 'Efsane')),
  points INTEGER DEFAULT 0,
  contributions JSONB DEFAULT '{"shares": 0, "verifications": 0}'::jsonb,
  location JSONB DEFAULT '{"city": "Konya", "district": "Selçuklu", "coordinates": {"lat": null, "lng": null}}'::jsonb,
  preferences JSONB DEFAULT '{"notifications": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Diğer' CHECK (category IN ('Sebze', 'Meyve', 'Et', 'Süt Ürünleri', 'Bakliyat', 'Temel Gıda', 'Diğer')),
  default_unit TEXT DEFAULT 'kg' CHECK (default_unit IN ('kg', 'adet', 'lt', 'paket')),
  image TEXT,
  search_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for product search
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products USING gin(to_tsvector('turkish', name));
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- Locations table
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pazar', 'manav', 'market', 'kasap', 'bakkal', 'diğer')),
  address TEXT,
  coordinates POINT NOT NULL, -- PostgreSQL point type for lat/lng
  city TEXT DEFAULT 'Konya',
  district TEXT DEFAULT 'Selçuklu',
  is_verified BOOLEAN DEFAULT FALSE,
  price_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spatial index for location queries
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON public.locations USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_locations_city_district ON public.locations(city, district);

-- Prices table
CREATE TABLE IF NOT EXISTS public.prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'adet', 'lt', 'paket')),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  coordinates POINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for prices
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON public.prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_location_id ON public.prices(location_id);
CREATE INDEX IF NOT EXISTS idx_prices_user_id ON public.prices(user_id);
CREATE INDEX IF NOT EXISTS idx_prices_created_at ON public.prices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prices_is_verified ON public.prices(is_verified, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prices_coordinates ON public.prices USING GIST(coordinates);

-- Function to update user level based on points
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.points >= 1000 THEN
    NEW.level := 'Efsane';
  ELSIF NEW.points >= 500 THEN
    NEW.level := 'Uzman';
  ELSIF NEW.points >= 100 THEN
    NEW.level := 'Mahalleli';
  ELSE
    NEW.level := 'Yeni';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update level (drop if exists first)
DROP TRIGGER IF EXISTS trigger_update_user_level ON public.users;
CREATE TRIGGER trigger_update_user_level
  BEFORE UPDATE OF points ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_level();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at (drop if exists first)
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prices_updated_at ON public.prices;
CREATE TRIGGER update_prices_updated_at BEFORE UPDATE ON public.prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function to increment location price count
CREATE OR REPLACE FUNCTION increment_location_price_count(location_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.locations
  SET price_count = price_count + 1
  WHERE id = location_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can create products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can read prices" ON public.prices;
DROP POLICY IF EXISTS "Authenticated users can create prices" ON public.prices;
DROP POLICY IF EXISTS "Users can update own prices" ON public.prices;

-- Users: Users can read all, update own
CREATE POLICY "Users can read all profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Products: Everyone can read, authenticated users can create
CREATE POLICY "Anyone can read products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create products" ON public.products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Locations: Everyone can read, authenticated users can create
CREATE POLICY "Anyone can read locations" ON public.locations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create locations" ON public.locations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Prices: Everyone can read, authenticated users can create/update own
CREATE POLICY "Anyone can read prices" ON public.prices
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create prices" ON public.prices
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own prices" ON public.prices
  FOR UPDATE USING (auth.uid() = user_id);

