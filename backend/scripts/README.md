# Backend Scripts

## fetch-products

Bu script, Türkiye'deki yaygın ürün isimlerini ve görsellerini toplayıp Supabase veritabanına ekler.

## Özellikler

- ✅ 200+ Türk ürün ismi (Sebze, Meyve, Et, Süt Ürünleri, Bakliyat, Temel Gıda, Diğer)
- ✅ Ürün görsellerini Pexels/Unsplash API'den fetch eder
- ✅ Mevcut ürünleri atlar (idempotent)
- ✅ Rate limiting ile API limitlerini korur
- ✅ Detaylı progress ve error logging

## Kurulum

### 1. Pexels API Key (Opsiyonel - daha iyi görseller için)

1. https://www.pexels.com/api/ adresine gidin
2. Ücretsiz hesap oluşturun
3. API key alın
4. `backend/.env` dosyasına ekleyin:

```env
PEXELS_API_KEY=LinyMEtubm0F5RUNbWMrVN0dRpog3UVI9cUzXSICnlVVnANJOWpKuHiv
```

**Not:** Pexels API key olmadan da çalışır, Unsplash Source API kullanır (rate limit var).

## Kullanım

```bash
cd backend
npm run fetch-products
```

## Script Özellikleri

### Ürün Kategorileri

- **Sebze**: 30+ ürün (Domates, Salatalık, Biber, vb.)
- **Meyve**: 30+ ürün (Elma, Muz, Portakal, vb.)
- **Et**: 20+ ürün (Kıyma, Tavuk, Balık, vb.)
- **Süt Ürünleri**: 15+ ürün (Süt, Yoğurt, Peynir, vb.)
- **Bakliyat**: 15+ ürün (Mercimek, Nohut, Pirinç, vb.)
- **Temel Gıda**: 25+ ürün (Ekmek, Yumurta, Zeytinyağı, vb.)
- **Diğer**: 15+ ürün (Cips, Çikolata, Su, vb.)

### Görsel Fetch

1. **Pexels API** (önerilen): API key ile yüksek kaliteli görseller
2. **Unsplash Source API** (fallback): API key gerektirmez, rate limit var

### Veritabanı İşlemleri

- Mevcut ürünleri atlar (isim bazlı kontrol)
- Yeni ürünleri ekler
- Mevcut ürünlerin görsellerini günceller (yoksa)

## Örnek Çıktı

```
🚀 Starting product fetch and insert process...

📦 Total products to process: 200

[1/200] Processing: Domates...
✅ Added: Domates (Sebze)
[2/200] Processing: Salatalık...
✅ Added: Salatalık (Sebze)
...

═══════════════════════════════════════
📊 Summary:
  ✅ Success: 195
  ⏭️  Skipped: 5
  ❌ Errors: 0
═══════════════════════════════════════

✨ Process completed!
```

## Notlar

- Script idempotent'tir - birden fazla çalıştırılabilir
- Rate limiting: Her ürün arasında 300ms, görsel fetch arasında 500ms bekleme
- Hata durumunda script devam eder, sadece hatalı ürünü atlar
- Görsel fetch başarısız olursa ürün görsel olmadan eklenir

## Geliştirme

Yeni ürün eklemek için `TURKISH_PRODUCTS` array'ine ekleyin:

```typescript
{ name: 'Ürün Adı', category: 'Kategori', default_unit: 'kg' }
```

Kategoriler: `'Sebze'`, `'Meyve'`, `'Et'`, `'Süt Ürünleri'`, `'Bakliyat'`, `'Temel Gıda'`, `'Diğer'`
Birimler: `'kg'`, `'adet'`, `'lt'`, `'paket'`

---

## seed-bazaar-products (Turkey Bazaar Seeder)

Collects Turkey bazaar (pazar/hal) product names and adds them to the product database.

### Features

- ✅ 180+ curated Turkey bazaar products: sebze, meyve, bakliyat, kuruyemiş, et, süt ürünleri, temel gıda
- ✅ Optional: CollectAPI Bazaar API (add `COLLECTAPI_API_KEY` to `.env`)
- ✅ Idempotent: skips existing products (case-insensitive name match)
- ✅ No images fetched (fast, DB-only)

### Usage

```bash
cd backend
npm run seed-bazaar-products
```

### CollectAPI (Optional)

To fetch additional products from CollectAPI:

1. Sign up at https://collectapi.com
2. Go to Profile → Token, copy your API key
3. Add to `backend/.env`:

```env
COLLECTAPI_API_KEY=your_api_key_here
```

**Note:** The script uses a curated list by default. CollectAPI integration may require verifying the correct endpoint at https://docs.collectapi.com

### Photos (Images)

The script fetches product images from **Pexels** (with API key) or **Unsplash** (fallback) and stores them in the `image` column. Add to `backend/.env`:

```env
PEXELS_API_KEY=your_pexels_api_key
```

To run without fetching images (faster):

```bash
npm run seed-bazaar-products -- --skip-images
```








