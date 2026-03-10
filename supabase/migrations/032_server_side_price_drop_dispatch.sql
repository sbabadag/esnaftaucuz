-- Ensure price-drop notification pipeline runs for all clients (web/mobile/admin)
-- by invoking the Edge Function from DB trigger after price inserts/updates.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_price_drop_pipeline()
RETURNS TRIGGER AS $$
BEGIN
  -- Run only for active rows; notify-price-drop handles drop checks and dedupe.
  IF NEW.is_active IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://xmskjcdwmwlcmjexnnxw.supabase.co/functions/v1/notify-price-drop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'price_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_dispatch_price_drop_pipeline ON public.prices;
CREATE TRIGGER trigger_dispatch_price_drop_pipeline
  AFTER INSERT OR UPDATE OF price, is_active
  ON public.prices
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_price_drop_pipeline();
