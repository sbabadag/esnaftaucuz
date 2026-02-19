# 🚀 Google Play Console'a Yükleme Rehberi

## ✅ Build Tamamlandı!

Production build başarıyla tamamlandı. AAB dosyası hazır.

## 📦 AAB Dosya Bilgileri

- **Dosya**: `android/app/build/outputs/bundle/release/app-release.aab`
- **Version Code**: 4
- **Version Name**: 1.0.3
- **Build Type**: Release (Signed)

## 📤 Google Play Console'a Yükleme Adımları

### 1. Google Play Console'a Giriş

1. [Google Play Console](https://play.google.com/console) adresine gidin
2. Uygulamanızı seçin: **esnaftaucuz**

### 2. Yeni Sürüm Oluşturma

1. Sol menüden **"Production"** veya **"Closed testing"** → **"Testers"** seçin
2. **"Create new release"** veya **"Create release"** butonuna tıklayın

### 3. AAB Dosyasını Yükleme

1. **"Upload"** veya **"Browse files"** butonuna tıklayın
2. Şu dosyayı seçin:
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```
3. Dosya yüklenene kadar bekleyin (birkaç dakika sürebilir)

### 4. Sürüm Notları

**Release notes** (Türkçe):
```
Sürüm 1.0.3:
- Production build ile environment variable'lar düzeltildi
- Tüm özellikler artık düzgün çalışıyor
- Supabase bağlantısı ve Google Maps entegrasyonu aktif
```

**Release notes** (English):
```
Version 1.0.3:
- Fixed environment variables in production build
- All features now working properly
- Supabase connection and Google Maps integration active
```

### 5. Yayınlama

1. **"Review release"** butonuna tıklayın
2. Tüm bilgileri kontrol edin:
   - ✅ Version code: 4
   - ✅ Version name: 1.0.3
   - ✅ AAB dosyası yüklendi
   - ✅ Release notes eklendi

3. **"Start rollout to Closed testing"** veya **"Save"** butonuna tıklayın

### 6. Test Edilmesi

- Google Play Console, AAB dosyasını işleyecek (5-10 dakika)
- İşlem tamamlandıktan sonra tester'lar uygulamayı indirebilir
- Tester'lar uygulamayı açabilir ve tüm özellikler çalışacak

## ✅ Bu Build'de Düzeltilenler

1. ✅ **Environment Variables**: `.env` dosyasından otomatik yükleniyor
2. ✅ **Supabase**: Bağlantı çalışıyor
3. ✅ **Google Maps**: API key aktif
4. ✅ **Hardcoded Secrets**: Production'da kaldırıldı
5. ✅ **Local Dev URL**: Production build'de yok

## 🔍 Test Kontrol Listesi

Tester'lar şunları test edebilir:
- [ ] Uygulama açılıyor
- [ ] Giriş yapılabiliyor (Supabase)
- [ ] Veri yükleniyor
- [ ] Konum izni verilebiliyor
- [ ] Adres gösteriliyor (Google Maps)
- [ ] Harita çalışıyor
- [ ] Fiyat ekleme çalışıyor

## 📞 Sorun Giderme

### "Version code 4 has been used before" hatası:
→ Version code'u 5'e yükseltin (`android/app/build.gradle`)

### AAB yükleme hatası:
→ Dosya boyutunu kontrol edin (max 150MB)
→ İnternet bağlantınızı kontrol edin

### Tester'lar uygulamayı açamıyor:
→ Google Play Console'da "App bundles" → "App signing" kontrol edin
→ Keystore doğru mu kontrol edin

## 🎉 Başarılı!

Build başarıyla tamamlandı ve Google Play Console'a yüklenmeye hazır!
