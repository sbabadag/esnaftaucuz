-- Emergency fix: make locations inserts/selects work for web + native flows.

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can create locations" ON public.locations;
DROP POLICY IF EXISTS "Users can update own locations" ON public.locations;
DROP POLICY IF EXISTS "Users can delete own locations" ON public.locations;

CREATE POLICY "Anyone can read locations"
  ON public.locations
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Anyone can create locations"
  ON public.locations
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.locations TO anon;
GRANT SELECT, INSERT ON public.locations TO authenticated;
