-- Merchant product click tracking for reports
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.merchant_product_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_product_id UUID NOT NULL REFERENCES public.merchant_products(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_product_clicks_merchant_day
  ON public.merchant_product_clicks (merchant_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_product_clicks_product_day
  ON public.merchant_product_clicks (merchant_product_id, clicked_at DESC);

ALTER TABLE public.merchant_product_clicks ENABLE ROW LEVEL SECURITY;

-- Merchants can only read their own click logs.
DROP POLICY IF EXISTS "Merchants can view own product clicks" ON public.merchant_product_clicks;
CREATE POLICY "Merchants can view own product clicks"
  ON public.merchant_product_clicks
  FOR SELECT
  USING (merchant_id = auth.uid());

-- Authenticated users can create click events.
DROP POLICY IF EXISTS "Authenticated users can create product clicks" ON public.merchant_product_clicks;
CREATE POLICY "Authenticated users can create product clicks"
  ON public.merchant_product_clicks
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT ON public.merchant_product_clicks TO authenticated;
