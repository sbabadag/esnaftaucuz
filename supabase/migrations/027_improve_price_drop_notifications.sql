-- Improve favorite-based price drop notifications.
-- Sends a notification when a newly added/updated active price is lower than
-- the previous minimum price for the same product.

-- Prevent duplicate notifications for the same user + price + type.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_price_drop
ON public.notifications(user_id, price_id, type)
WHERE type = 'price_drop' AND price_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_price_drop_and_notify()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_min_price NUMERIC(10, 2);
  v_product_name TEXT;
  v_notifications_enabled BOOLEAN;
BEGIN
  -- Only evaluate active prices.
  IF NEW.is_active IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, if price did not change, skip.
  IF TG_OP = 'UPDATE' AND NEW.price = OLD.price THEN
    RETURN NEW;
  END IF;

  -- Product name for notification text.
  SELECT p.name
    INTO v_product_name
  FROM public.products p
  WHERE p.id = NEW.product_id;

  -- Previous minimum active price (excluding this row).
  SELECT MIN(pr.price)
    INTO v_previous_min_price
  FROM public.prices pr
  WHERE pr.product_id = NEW.product_id
    AND pr.is_active = TRUE
    AND pr.id <> NEW.id;

  -- If there is no older price yet, do not notify.
  IF v_previous_min_price IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify only if new price is strictly lower than previous minimum.
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
    JOIN public.users u
      ON u.id = uf.user_id
    WHERE uf.product_id = NEW.product_id
      -- Do not notify the user who just added this price.
      AND uf.user_id <> NEW.user_id
      -- Respect user notification preference (default true).
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

DROP TRIGGER IF EXISTS trigger_check_price_drop ON public.prices;
CREATE TRIGGER trigger_check_price_drop
  AFTER INSERT OR UPDATE OF price, is_active
  ON public.prices
  FOR EACH ROW
  EXECUTE FUNCTION public.check_price_drop_and_notify();

