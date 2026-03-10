-- Web and guest flows can create new locations before full auth sync.
-- Keep read open and allow inserts for both anon/authenticated roles.

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can create locations" ON public.locations;

CREATE POLICY "Anyone can create locations"
  ON public.locations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.locations TO anon;
GRANT INSERT ON public.locations TO authenticated;
