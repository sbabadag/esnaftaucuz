# Supabase Storage Bucket Ayarları

## price-photos Bucket RLS Politikaları

Supabase Storage bucket'ı için aşağıdaki RLS politikalarını ayarlamanız gerekiyor:

### 1. Bucket Ayarları
- Supabase Dashboard → Storage → Buckets → `price-photos`
- Bucket **PUBLIC** olarak ayarlanmalı (zaten öyle görünüyor)

### 2. RLS Politikaları

Supabase Dashboard → Storage → Policies → `price-photos` bucket'ı için aşağıdaki politikaları ekleyin:

#### Policy 1: Authenticated kullanıcılar upload yapabilir
```sql
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'price-photos' AND
  auth.role() = 'authenticated'
);
```

#### Policy 2: Herkes fotoğrafları okuyabilir (Public bucket için)
```sql
CREATE POLICY "Anyone can read photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'price-photos');
```

#### Policy 3: Kullanıcılar kendi fotoğraflarını silebilir
```sql
CREATE POLICY "Users can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'price-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### 3. Manuel Olarak Ayarlama

1. Supabase Dashboard'a gidin
2. Storage → Policies → `price-photos` bucket'ını seçin
3. "New Policy" butonuna tıklayın
4. Yukarıdaki politikaları ekleyin

### 4. Test Etme

Bir fiyat girişi yaparken:
1. Browser Console'u açın (F12)
2. Bir fotoğraf yükleyin
3. Console'da şu logları kontrol edin:
   - `📸 Uploading photo to Supabase Storage...`
   - `✅ Photo uploaded to storage:`
   - `✅ Photo URL generated:`
   - `📝 Creating price with data:` (photoUrl değerini kontrol edin)

### 5. Sorun Giderme

Eğer fotoğraf yüklenemiyorsa:
- Console'da hata mesajını kontrol edin
- Storage bucket'ının PUBLIC olduğundan emin olun
- RLS politikalarının doğru ayarlandığını kontrol edin
- Kullanıcının authenticated olduğundan emin olun



