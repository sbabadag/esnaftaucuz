-- Merchant shop profile fields on public.users (persisted columns, not only preferences JSON).
-- Backfills from existing preferences / avatar when present.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS shop_logo TEXT,
  ADD COLUMN IF NOT EXISTS shop_phone TEXT,
  ADD COLUMN IF NOT EXISTS shop_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS shop_address TEXT,
  ADD COLUMN IF NOT EXISTS shop_description TEXT,
  ADD COLUMN IF NOT EXISTS shop_opening_hours TEXT;

COMMENT ON COLUMN public.users.shop_logo IS 'Public merchant/shop logo URL';
COMMENT ON COLUMN public.users.shop_phone IS 'Merchant contact phone';
COMMENT ON COLUMN public.users.shop_whatsapp IS 'Merchant WhatsApp number';
COMMENT ON COLUMN public.users.shop_address IS 'Merchant street address text';
COMMENT ON COLUMN public.users.shop_description IS 'Short shop description';
COMMENT ON COLUMN public.users.shop_opening_hours IS 'Human-readable opening hours';

-- Prefer existing preferences JSON values; fall back avatar for logo.
UPDATE public.users
SET
  shop_logo = COALESCE(
    NULLIF(TRIM(shop_logo), ''),
    NULLIF(TRIM(preferences->>'shopLogo'), ''),
    NULLIF(TRIM(avatar), '')
  ),
  shop_phone = COALESCE(
    NULLIF(TRIM(shop_phone), ''),
    NULLIF(TRIM(preferences->>'phone'), '')
  ),
  shop_whatsapp = COALESCE(
    NULLIF(TRIM(shop_whatsapp), ''),
    NULLIF(TRIM(preferences->>'whatsapp'), ''),
    NULLIF(TRIM(preferences->>'phone'), '')
  ),
  shop_address = COALESCE(
    NULLIF(TRIM(shop_address), ''),
    NULLIF(TRIM(preferences->>'shopAddress'), '')
  ),
  shop_description = COALESCE(
    NULLIF(TRIM(shop_description), ''),
    NULLIF(TRIM(preferences->>'shopDescription'), '')
  ),
  shop_opening_hours = COALESCE(
    NULLIF(TRIM(shop_opening_hours), ''),
    NULLIF(TRIM(preferences->>'openingHours'), '')
  )
WHERE
  (shop_logo IS NULL OR TRIM(shop_logo) = '')
  OR (shop_phone IS NULL OR TRIM(shop_phone) = '')
  OR (shop_whatsapp IS NULL OR TRIM(shop_whatsapp) = '')
  OR (shop_address IS NULL OR TRIM(shop_address) = '')
  OR (shop_description IS NULL OR TRIM(shop_description) = '')
  OR (shop_opening_hours IS NULL OR TRIM(shop_opening_hours) = '');
