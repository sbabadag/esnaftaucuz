# Ürün Fetch Script

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





