-- Reset all product search_count values to 0
-- This will reset the "En Çok Bakılanlar" (Most Viewed) data

UPDATE public.products
SET search_count = 0
WHERE search_count > 0;

-- Log the number of products updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Reset search_count for % products', updated_count;
END $$;

