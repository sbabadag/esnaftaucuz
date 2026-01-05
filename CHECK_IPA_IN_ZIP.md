# IPA Dosyasını ZIP İçinde Kontrol Etme

## 📦 Artifacts ZIP İçinde IPA Kontrolü

Build tamamlandı ve artifacts var: `esnaftaucuz_3_artifacts.zip [8.97 MB]`

## 🔍 IPA Dosyasını Bulma

### Adım 1: ZIP Dosyasını İndir

1. Codemagic build sayfasında **Artifacts** bölümüne gidin
2. `esnaftaucuz_3_artifacts.zip` dosyasına tıklayın
3. ZIP dosyası indirilecek

### Adım 2: ZIP'i Aç ve Kontrol Et

**Windows'ta:**
1. ZIP dosyasına sağ tıklayın → **Extract All**
2. Açılan klasörde şu yapıyı kontrol edin:

```
esnaftaucuz_3_artifacts.zip
  └── build/
      └── ios/
          └── ipa/
              └── com.esnaftaucuz.app.ipa  ← Bu dosya olmalı
```

**Alternatif konumlar:**
```
esnaftaucuz_3_artifacts.zip
  └── build/
      └── ios/
          └── ipa/
              └── *.ipa  (herhangi bir .ipa dosyası)
```

### Adım 3: IPA Dosyası Yoksa

Eğer ZIP içinde IPA dosyası yoksa:

1. **Build Loglarını Kontrol Et:**
   - Build sayfasında **"Create IPA from build"** adımına tıklayın
   - Logları kontrol edin:
     - "Found app bundle: ..." mesajı var mı?
     - "IPA created: ..." mesajı var mı?
     - "App bundle not found" hatası var mı?

2. **Hata Mesajlarını Kontrol Et:**
   - `build/ios/ipa/error.txt` dosyası var mı?
   - Loglarda hata mesajları var mı?

3. **App Bundle Kontrolü:**
   - ZIP içinde `.app` dosyası var mı?
   - `$CM_BUILD_DIR/build/**/*.app` path'inde app bundle var mı?

## 🐛 Sorun Giderme

### IPA Dosyası Yok

**Olası Nedenler:**
1. App bundle bulunamadı
2. Build başarısız oldu
3. Path yanlış

**Çözüm:**
1. Build loglarını kontrol edin
2. "Create IPA from build" adımının loglarını okuyun
3. Hata mesajlarını paylaşın

### ZIP İçinde Sadece Error.txt Var

Bu durumda:
1. Build loglarını kontrol edin
2. App bundle'ın nerede olduğunu bulun
3. Yeni build başlatın (düzeltilmiş workflow ile)

## ✅ IPA Dosyası Bulunduysa

1. **Sideloadly ile Yükle:**
   - Sideloadly'yi açın
   - iPhone'u USB ile bağlayın
   - IPA File → İndirdiğiniz `.ipa` dosyasını seçin
   - Start butonuna tıklayın

2. **iPhone'da Güven:**
   - Settings → General → VPN & Device Management
   - Developer App → Trust

## 📋 Hızlı Kontrol Listesi

- [ ] ZIP dosyası indirildi
- [ ] ZIP açıldı
- [ ] `build/ios/ipa/*.ipa` dosyası var mı?
- [ ] IPA dosyası bulundu mu?
- [ ] Sideloadly ile yüklendi mi?

## 🔗 Sonraki Adımlar

1. **IPA Bulundu:** Sideloadly ile iPhone'a yükleyin
2. **IPA Bulunamadı:** Build loglarını kontrol edin ve paylaşın
3. **Yeni Build:** Düzeltilmiş workflow ile yeni build başlatın

