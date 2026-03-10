-- Ensure product rows are readable for app clients so price->product joins work.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Public read products" ON public.products;

CREATE POLICY "Public read products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.products TO authenticated;
