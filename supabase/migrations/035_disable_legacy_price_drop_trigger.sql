-- Disable legacy trigger to avoid duplicate notification generation paths.
-- Price-drop pipeline is now handled by trigger_dispatch_price_drop_pipeline
-- -> notify-price-drop edge function -> notifications insert.

DROP TRIGGER IF EXISTS trigger_check_price_drop ON public.prices;
