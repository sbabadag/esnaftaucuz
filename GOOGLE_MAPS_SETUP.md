# Google Maps API Kurulumu

## 📋 Özet

Uygulama artık **Google Maps Geocoding API**'yi birincil olarak kullanıyor, **OpenStreetMap** ise fallback olarak kullanılıyor.

## 💰 Maliyet

- **Ücretsiz Kotası**: Aylık 200$ ücretsiz kredi
- **Geocoding API**: 1.000 istek/ay ücretsiz, sonrası 1.000 istek başına ~$5
- **Çoğu uygulama için yeterli**: Küçük-orta ölçekli uygulamalar için ücretsiz kotası yeterli

## 🔑 API Key Alma

1. **Google Cloud Console**'a gidin: https://console.cloud.google.com/
2. Yeni bir proje oluşturun veya mevcut projeyi seçin
3. **APIs & Services** → **Library**'ye gidin
4. **Geocoding API**'yi arayın ve **Enable** edin
5. **APIs & Services** → **Credentials**'a gidin
6. **Create Credentials** → **API Key** seçin
7. API key'i kopyalayın

## ⚙️ API Key'i Projeye Ekleme

1. Proje root dizininde `.env` dosyası oluşturun (yoksa)
2. Aşağıdaki satırı ekleyin:

```env
VITE_GOOGLE_MAPS_API_KEY=your-api-key-here
```

3. Uygulamayı yeniden başlatın:
```bash
npm run dev
```

## 🔒 Güvenlik

### ⚠️ ÖNEMLİ: Geocoding API Kısıtlamaları

**Geocoding API, HTTP referrer kısıtlamaları ile çalışmaz!**

Eğer API anahtarınızda "HTTP referrers (web sites)" kısıtlaması varsa, şu hatayı alırsınız:
```
REQUEST_DENIED: API keys with referer restrictions cannot be used with this API.
```

### API Key Kısıtlamaları (Önerilen)

1. **Application restrictions** (Uygulama kısıtlamaları):
   - **Seçenek 1 (Test için)**: **None** - Hiç kısıtlama yok (sadece test için)
   - **Seçenek 2 (Production için)**: **IP addresses** - Sadece belirli IP adreslerinden erişim
     - Development: Kendi IP adresinizi ekleyin
     - Production: Sunucu IP adreslerini ekleyin
   - **❌ KULLANMAYIN**: **HTTP referrers** - Geocoding API ile çalışmaz!

2. **API kısıtlaması**:
   - **API restrictions** → **Restrict key**
   - Sadece **Geocoding API**'yi seçin
   - Bu, API anahtarının sadece Geocoding API için kullanılmasını sağlar

## 🎯 Nasıl Çalışıyor?

1. **Google Maps API** (birincil):
   - API key varsa önce Google Maps kullanılır
   - Daha güvenilir ve hızlı
   - Türkiye için iyi adres çözümleme

2. **OpenStreetMap** (fallback):
   - Google Maps başarısız olursa veya API key yoksa kullanılır
   - Ücretsiz ama rate limit var
   - 1 saniye delay ile rate limit'e takılmamaya çalışır

## ✅ Test Etme

1. `.env` dosyasına API key'i ekleyin
2. Uygulamayı yeniden başlatın
3. Ana sayfada otomatik olarak konum alınacak
4. Veya "Mevcut Konum" butonuna basın
5. Console'da hangi servisin kullanıldığını görebilirsiniz

## 📝 Notlar

- API key olmadan da çalışır (OpenStreetMap kullanır)
- API key eklemek daha güvenilir sonuçlar verir
- Ücretsiz kotayı aşmamak için kullanımı izleyin
- Google Cloud Console'dan kullanım istatistiklerini görebilirsiniz

