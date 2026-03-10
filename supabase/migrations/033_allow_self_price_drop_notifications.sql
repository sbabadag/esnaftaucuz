-- Allow users to receive price-drop notifications for their own newly added lower prices
-- when they also favorite that product (same account across web/mobile).

CREATE OR REPLACE FUNCTION public.check_price_drop_and_notify()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_min_price NUMERIC(10, 2);
  v_product_name TEXT;
BEGIN
  IF NEW.is_active IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.price = OLD.price THEN
    RETURN NEW;
  END IF;

  SELECT p.name INTO v_product_name
  FROM public.products p
  WHERE p.id = NEW.product_id;

  SELECT MIN(pr.price) INTO v_previous_min_price
  FROM public.prices pr
  WHERE pr.product_id = NEW.product_id
    AND pr.is_active = TRUE
    AND pr.id <> NEW.id;

  IF v_previous_min_price IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.price < v_previous_min_price THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      product_id,
      price_id
    )
    SELECT
      uf.user_id,
      'price_drop',
      'Fiyat Dustu! 🎉',
      COALESCE(v_product_name, 'Urun') || ' icin yeni dusuk fiyat: ' ||
      NEW.price::TEXT || ' TL (onceki en dusuk: ' || v_previous_min_price::TEXT || ' TL)',
      NEW.product_id,
      NEW.id
    FROM public.user_favorites uf
    JOIN public.users u ON u.id = uf.user_id
    WHERE uf.product_id = NEW.product_id
      AND (
        u.preferences IS NULL
        OR u.preferences->>'notifications' IS NULL
        OR LOWER(u.preferences->>'notifications') IN ('true', '1')
      )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
