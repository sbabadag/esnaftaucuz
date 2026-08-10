-- True "most viewed today" ranking based on product detail opens.
-- Replaces lifetime products.search_count ordering for Explore trend row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at
  ON public.product_views (viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_views_product_viewed_at
  ON public.product_views (product_id, viewed_at DESC);

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

-- Aggregates go through SECURITY DEFINER RPCs; no direct client SELECT needed.
DROP POLICY IF EXISTS "Anyone can insert product views" ON public.product_views;
CREATE POLICY "Anyone can insert product views"
  ON public.product_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (product_id IS NOT NULL);

GRANT INSERT ON public.product_views TO anon, authenticated;

-- Start of "today" in Turkey local time, as timestamptz.
CREATE OR REPLACE FUNCTION public.turkey_today_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT ((timezone('Europe/Istanbul', now()))::date)::timestamp
    AT TIME ZONE 'Europe/Istanbul';
$$;

CREATE OR REPLACE FUNCTION public.record_product_view(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = p_product_id
      AND COALESCE(p.is_active, true) = true
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.product_views (product_id)
  VALUES (p_product_id);

  -- Keep legacy column updated for search ranking / older clients.
  UPDATE public.products
  SET search_count = COALESCE(search_count, 0) + 1
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trending_products_today(p_limit int DEFAULT 6)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  image text,
  view_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := GREATEST(1, LEAST(COALESCE(p_limit, 6), 50));
  v_today timestamptz := public.turkey_today_start();
  v_week timestamptz := v_today - interval '7 days';
  v_count int;
BEGIN
  -- 1) Products with at least one price, ranked by views since Turkey midnight.
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.category,
    p.image,
    COUNT(v.id)::bigint AS view_count
  FROM public.product_views v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.viewed_at >= v_today
    AND COALESCE(p.is_active, true) = true
    AND EXISTS (
      SELECT 1
      FROM public.prices pr
      WHERE pr.product_id = p.id
        AND COALESCE(pr.is_active, true) = true
    )
  GROUP BY p.id, p.name, p.category, p.image
  ORDER BY COUNT(v.id) DESC, p.name ASC
  LIMIT v_limit;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RETURN;
  END IF;

  -- 2) Soft fallback: last 7 days of views.
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.category,
    p.image,
    COUNT(v.id)::bigint AS view_count
  FROM public.product_views v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.viewed_at >= v_week
    AND COALESCE(p.is_active, true) = true
    AND EXISTS (
      SELECT 1
      FROM public.prices pr
      WHERE pr.product_id = p.id
        AND COALESCE(pr.is_active, true) = true
    )
  GROUP BY p.id, p.name, p.category, p.image
  ORDER BY COUNT(v.id) DESC, p.name ASC
  LIMIT v_limit;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RETURN;
  END IF;

  -- 3) Last resort: most active priced products in the last 7 days (not stale search_count).
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.category,
    p.image,
    COUNT(pr.id)::bigint AS view_count
  FROM public.prices pr
  JOIN public.products p ON p.id = pr.product_id
  WHERE pr.created_at >= v_week
    AND COALESCE(p.is_active, true) = true
    AND COALESCE(pr.is_active, true) = true
    AND p.name !~ '^[0-9%(]'
  GROUP BY p.id, p.name, p.category, p.image
  ORDER BY COUNT(pr.id) DESC, MAX(pr.created_at) DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.turkey_today_start() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_product_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_products_today(int) TO anon, authenticated;

-- Backfill today's ranking from recent merchant product clicks (same calendar day).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'merchant_product_clicks'
  ) THEN
    INSERT INTO public.product_views (product_id, viewed_at)
    SELECT mpc.product_id, mpc.clicked_at
    FROM public.merchant_product_clicks mpc
    WHERE mpc.clicked_at >= public.turkey_today_start()
      AND mpc.product_id IS NOT NULL;
  END IF;
END $$;
