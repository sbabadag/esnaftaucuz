-- Add dummy products for testing
-- This migration adds common Turkish grocery products
-- Uses WHERE NOT EXISTS to avoid duplicates (idempotent)

INSERT INTO public.products (name, category, default_unit, search_count, is_active)
SELECT name, category, default_unit, search_count, is_active
FROM (VALUES
-- Sebzeler
('Domates', 'Sebze', 'kg', 150, true),
('Salatalık', 'Sebze', 'kg', 120, true),
('Biber', 'Sebze', 'kg', 100, true),
('Patlıcan', 'Sebze', 'kg', 80, true),
('Kabak', 'Sebze', 'kg', 70, true),
('Soğan', 'Sebze', 'kg', 200, true),
('Sarımsak', 'Sebze', 'kg', 90, true),
('Havuç', 'Sebze', 'kg', 85, true),
('Patates', 'Sebze', 'kg', 180, true),
('Lahana', 'Sebze', 'kg', 60, true),
('Karnabahar', 'Sebze', 'kg', 50, true),
('Brokoli', 'Sebze', 'kg', 45, true),
('Ispanak', 'Sebze', 'kg', 55, true),
('Marul', 'Sebze', 'adet', 65, true),
('Roka', 'Sebze', 'kg', 40, true),
('Maydanoz', 'Sebze', 'kg', 35, true),
('Dereotu', 'Sebze', 'kg', 30, true),
('Nane', 'Sebze', 'kg', 25, true),

-- Meyveler
('Elma', 'Meyve', 'kg', 140, true),
('Armut', 'Meyve', 'kg', 90, true),
('Muz', 'Meyve', 'kg', 130, true),
('Portakal', 'Meyve', 'kg', 110, true),
('Mandalin', 'Meyve', 'kg', 100, true),
('Limon', 'Meyve', 'kg', 95, true),
('Çilek', 'Meyve', 'kg', 75, true),
('Kiraz', 'Meyve', 'kg', 70, true),
('Üzüm', 'Meyve', 'kg', 80, true),
('Karpuz', 'Meyve', 'kg', 60, true),
('Kavun', 'Meyve', 'kg', 50, true),
('Şeftali', 'Meyve', 'kg', 65, true),
('Kayısı', 'Meyve', 'kg', 55, true),
('Erik', 'Meyve', 'kg', 45, true),
('İncir', 'Meyve', 'kg', 40, true),
('Nar', 'Meyve', 'kg', 35, true),
('Ayva', 'Meyve', 'kg', 30, true),

-- Et Ürünleri
('Kıyma', 'Et', 'kg', 120, true),
('Kuşbaşı', 'Et', 'kg', 100, true),
('Bonfile', 'Et', 'kg', 80, true),
('Tavuk Göğsü', 'Et', 'kg', 150, true),
('Tavuk But', 'Et', 'kg', 130, true),
('Tavuk Kanat', 'Et', 'kg', 90, true),
('Balık', 'Et', 'kg', 70, true),
('Sucuk', 'Et', 'kg', 110, true),
('Sosis', 'Et', 'kg', 95, true),
('Pastırma', 'Et', 'kg', 60, true),

-- Süt Ürünleri
('Süt', 'Süt Ürünleri', 'lt', 200, true),
('Yoğurt', 'Süt Ürünleri', 'kg', 180, true),
('Peynir', 'Süt Ürünleri', 'kg', 160, true),
('Beyaz Peynir', 'Süt Ürünleri', 'kg', 140, true),
('Kaşar Peyniri', 'Süt Ürünleri', 'kg', 120, true),
('Tereyağı', 'Süt Ürünleri', 'kg', 100, true),
('Ayran', 'Süt Ürünleri', 'lt', 80, true),
('Krema', 'Süt Ürünleri', 'lt', 60, true),
('Kaymak', 'Süt Ürünleri', 'kg', 50, true),

-- Bakliyat
('Mercimek', 'Bakliyat', 'kg', 90, true),
('Nohut', 'Bakliyat', 'kg', 85, true),
('Fasulye', 'Bakliyat', 'kg', 80, true),
('Barbunya', 'Bakliyat', 'kg', 70, true),
('Pirinç', 'Bakliyat', 'kg', 150, true),
('Bulgur', 'Bakliyat', 'kg', 100, true),
('Makarna', 'Bakliyat', 'kg', 120, true),
('Un', 'Bakliyat', 'kg', 110, true),

-- Temel Gıda
('Ekmek', 'Temel Gıda', 'adet', 250, true),
('Yumurta', 'Temel Gıda', 'adet', 200, true),
('Zeytinyağı', 'Temel Gıda', 'lt', 130, true),
('Ayçiçek Yağı', 'Temel Gıda', 'lt', 120, true),
('Tuz', 'Temel Gıda', 'kg', 80, true),
('Şeker', 'Temel Gıda', 'kg', 100, true),
('Çay', 'Temel Gıda', 'kg', 90, true),
('Kahve', 'Temel Gıda', 'kg', 70, true),
('Bal', 'Temel Gıda', 'kg', 60, true),
('Reçel', 'Temel Gıda', 'kg', 50, true),
('Zeytin', 'Temel Gıda', 'kg', 85, true),
('Pekmez', 'Temel Gıda', 'kg', 40, true),

-- Diğer
('Cips', 'Diğer', 'paket', 90, true),
('Çikolata', 'Diğer', 'paket', 80, true),
('Bisküvi', 'Diğer', 'paket', 70, true),
('Gazlı İçecek', 'Diğer', 'lt', 100, true),
('Su', 'Diğer', 'lt', 150, true)
) AS new_products(name, category, default_unit, search_count, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products 
  WHERE LOWER(products.name) = LOWER(new_products.name)
);

-- Update search_count for trending products (simulate popular searches)
UPDATE public.products SET search_count = 250 WHERE LOWER(name) = 'domates';
UPDATE public.products SET search_count = 220 WHERE LOWER(name) = 'ekmek';
UPDATE public.products SET search_count = 200 WHERE LOWER(name) = 'yumurta';
UPDATE public.products SET search_count = 190 WHERE LOWER(name) = 'süt';
UPDATE public.products SET search_count = 180 WHERE LOWER(name) = 'patates';
UPDATE public.products SET search_count = 170 WHERE LOWER(name) = 'soğan';
UPDATE public.products SET search_count = 160 WHERE LOWER(name) = 'yoğurt';
UPDATE public.products SET search_count = 150 WHERE LOWER(name) = 'pirinç';
UPDATE public.products SET search_count = 140 WHERE LOWER(name) = 'tavuk göğsü';
UPDATE public.products SET search_count = 130 WHERE LOWER(name) = 'elma';
