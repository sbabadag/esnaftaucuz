# 🚨 Production Build Kontrol Rehberi

## ⚠️ ÖNEMLİ: Google Play Test Öncesi Kontrol

Production build yapmadan önce **mutlaka** environment variable'ların set edildiğinden emin olun!

## 🔍 Hızlı Kontrol

```bash
npm run check-env
```

Bu komut tüm gerekli environment variable'ların varlığını kontrol eder.

## ✅ Gerekli Environment Variable'lar

Production build için **mutlaka** şunlar olmalı:

1. **VITE_SUPABASE_URL** - Supabase proje URL'i
2. **VITE_SUPABASE_ANON_KEY** - Supabase anonymous key
3. **VITE_GOOGLE_MAPS_API_KEY** - Google Maps API key

## 📝 Production Build Adımları

### 1. Environment Variable'ları Ayarlayın

**Seçenek A: .env.production dosyası oluşturun**

```bash
# Proje root dizininde .env.production dosyası oluşturun
cat > .env.production << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
EOF
```

**Seçenek B: Environment variable'ları export edin**

```bash
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key-here
export VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

### 2. Kontrol Edin

```bash
npm run check-env
```

Tüm değişkenler ✅ görünüyorsa devam edin.

### 3. Production Build Yapın

```bash
npm run build
```

### 4. Build'i Test Edin

```bash
npm run preview
```

Tarayıcıda açılıp çalıştığını kontrol edin.

### 5. Android Build

```bash
npm run mobile:build
cd android
./gradlew bundleRelease
```

## 🚨 Eğer Environment Variable'lar Yoksa Ne Olur?

### ❌ Supabase Variable'ları Yoksa:
- Uygulama açılır
- Ama authentication, veri yükleme, real-time updates **ÇALIŞMAZ**
- Kullanıcılar giriş yapamaz, veri göremez

### ❌ Google Maps API Key Yoksa:
- Uygulama açılır
- Ama konum adresleri gösterilemez
- Harita özellikleri **ÇALIŞMAZ**
- Geocoding hataları oluşur

## ✅ Doğru Build Kontrol Listesi

- [ ] `.env.production` dosyası oluşturuldu
- [ ] `npm run check-env` komutu ✅ gösteriyor
- [ ] `npm run build` başarıyla tamamlandı
- [ ] `npm run preview` ile test edildi
- [ ] Android build yapıldı (`bundleRelease`)
- [ ] AAB dosyası Google Play Console'a yüklendi

## 🔒 Güvenlik Notu

- `.env.production` dosyası `.gitignore`'da olduğu için Git'e commit edilmez
- API key'lerinizi asla Git'e commit etmeyin
- Production key'lerinizi güvenli tutun

## 📞 Sorun Giderme

### "Missing Supabase environment variables" hatası:
→ `.env.production` dosyasını kontrol edin veya environment variable'ları export edin

### "Google Maps API key bulunamadı" hatası:
→ `VITE_GOOGLE_MAPS_API_KEY` değişkenini kontrol edin

### Build başarılı ama uygulama çalışmıyor:
→ Browser console'da hataları kontrol edin
→ Environment variable'ların build'e gömüldüğünden emin olun
