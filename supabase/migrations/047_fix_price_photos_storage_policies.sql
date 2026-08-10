-- Ensure price-photos storage allows authenticated uploads under {auth.uid()}/...
-- (merchant logos and price photos share this bucket path convention)

-- Public read for price-photos (idempotent via drop/create)
DROP POLICY IF EXISTS "Anyone can read photos" ON storage.objects;
CREATE POLICY "Anyone can read photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'price-photos');

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'price-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
CREATE POLICY "Users can update own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'price-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'price-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'price-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Also allow authenticated SELECT so INSERT ... RETURNING works under RLS
DROP POLICY IF EXISTS "Authenticated users can select own photos" ON storage.objects;
CREATE POLICY "Authenticated users can select own photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'price-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
