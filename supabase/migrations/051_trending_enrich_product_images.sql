-- Enrich trending product thumbnails from prices / merchant_products when products.image is null.

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
  -- 1) Views since Turkey midnight.
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.category,
    COALESCE(
      NULLIF(TRIM(p.image), ''),
      (
        SELECT NULLIF(TRIM(pr.photo), '')
        FROM public.prices pr
        WHERE pr.product_id = p.id
          AND pr.photo IS NOT NULL
          AND TRIM(pr.photo) <> ''
          AND pr.photo ~* '^https?://'
          AND pr.photo !~* 'localhost|_capacitor_file_|127\\.0\\.0\\.1'
        ORDER BY pr.created_at DESC NULLS LAST
        LIMIT 1
      ),
      (
        SELECT NULLIF(TRIM(elem), '')
        FROM public.merchant_products mp
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(mp.images, '[]'::jsonb)) AS elem
        WHERE mp.product_id = p.id
          AND elem ~* '^https?://'
          AND elem !~* 'localhost|_capacitor_file_|127\\.0\\.0\\.1'
        LIMIT 1
      )
    ) AS image,
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
    COALESCE(
      NULLIF(TRIM(p.image), ''),
      (
        SELECT NULLIF(TRIM(pr.photo), '')
        FROM public.prices pr
        WHERE pr.product_id = p.id
          AND pr.photo IS NOT NULL
          AND TRIM(pr.photo) <> ''
          AND pr.photo ~* '^https?://'
          AND pr.photo !~* 'localhost|_capacitor_file_|127\\.0\\.0\\.1'
        ORDER BY pr.created_at DESC NULLS LAST
        LIMIT 1
      ),
      (
        SELECT NULLIF(TRIM(elem), '')
        FROM public.merchant_products mp
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(mp.images, '[]'::jsonb)) AS elem
        WHERE mp.product_id = p.id
          AND elem ~* '^https?://'
          AND elem !~* 'localhost|_capacitor_file_|127\\.0\\.0\\.1'
        LIMIT 1
      )
    ) AS image,
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

  -- 3) Last resort: most active priced products in the last 7 days.
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.category,
    COALESCE(
      NULLIF(TRIM(p.image), ''),
      (
        SELECT NULLIF(TRIM(pr2.photo), '')
        FROM public.prices pr2
        WHERE pr2.product_id = p.id
          AND pr2.photo IS NOT NULL
          AND TRIM(pr2.photo) <> ''
          AND pr2.photo ~* '^https?://'
          AND pr2.photo !~* 'localhost|_capacitor_file_|127\\.0\\.0\\.1'
        ORDER BY pr2.created_at DESC NULLS LAST
        LIMIT 1
      ),
      (
        SELECT NULLIF(TRIM(elem), '')
        FROM public.merchant_products mp
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(mp.images, '[]'::jsonb)) AS elem
        WHERE mp.product_id = p.id
          AND elem ~* '^https?://'
          AND elem !~* 'localhost|_capacitor_file_|127\\.0\\.0\\.1'
        LIMIT 1
      )
    ) AS image,
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

GRANT EXECUTE ON FUNCTION public.get_trending_products_today(int) TO anon, authenticated;
