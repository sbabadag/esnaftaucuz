-- Store multiple photos per price (merchant products can have up to 6 images).
-- Keep `photo` as the primary/first image for feed thumbnails and backward compat.

ALTER TABLE public.prices
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.prices.photos IS 'Array of public image URLs for this price entry';

-- Backfill from merchant_products.images when prices only have the first photo.
UPDATE public.prices p
SET
  photos = mp.images,
  photo = COALESCE(
    NULLIF(TRIM(p.photo), ''),
    NULLIF(mp.images->>0, '')
  ),
  updated_at = NOW()
FROM public.merchant_products mp
WHERE mp.merchant_id = p.user_id
  AND mp.product_id = p.product_id
  AND mp.images IS NOT NULL
  AND jsonb_typeof(mp.images) = 'array'
  AND jsonb_array_length(mp.images) > 0
  AND (
    p.photos IS NULL
    OR p.photos = '[]'::jsonb
    OR jsonb_array_length(COALESCE(p.photos, '[]'::jsonb)) < jsonb_array_length(mp.images)
  );

-- Ensure single-photo rows still expose a one-element photos array for clients.
UPDATE public.prices
SET photos = jsonb_build_array(photo)
WHERE photo IS NOT NULL
  AND TRIM(photo) <> ''
  AND (photos IS NULL OR photos = '[]'::jsonb);
