# Kapalı Test (Closed Test) Sürümü Oluşturma

Google Play Console'da kapalı test için yeni sürüm oluşturma adımları.

## 📋 Ön Hazırlık

### Version Code Güncellendi ✅
- **Eski:** versionCode 2, versionName "1.0.1"
- **Yeni:** versionCode 3, versionName "1.0.2"

## 🚀 Adım 1: Yeni AAB Oluşturma

### 1.1 Production Build
```bash
# Bağımlılıkları kontrol et
npm install

# Production build
npm run build

# Android sync
npx cap sync android
```

### 1.2 Android Studio'da AAB Oluşturma

1. **Android Studio'yu açın:**
   ```bash
   npx cap open android
   ```

2. **Build → Clean Project**

3. **Build → Rebuild Project**

4. **Build → Generate Signed Bundle / APK**
   - **Android App Bundle** seçin
   - **Keystore:** Mevcut keystore'u seçin (`esnaftaucuz-release-key.jks`)
   - **Key alias:** `esnaftaucuz` (veya oluştururken verdiğiniz alias)
   - **Key store password:** Keystore şifrenizi girin
   - **Key password:** Key şifrenizi girin
   - **Build variant:** `release` seçin
   - **Finish**

5. **AAB Dosyası Konumu:**
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```

## 📤 Adım 2: Google Play Console'a Yükleme

### 2.1 Kapalı Test Sayfasına Gidin

1. [Google Play Console](https://play.google.com/console) açın
2. **"esnaftaucuz"** uygulamasını seçin
3. Sol menüden: **"Test edin ve yayınlayın"** → **"Test etme"** → **"Kapalı test"**

### 2.2 Yeni Sürüm Oluşturun

1. **"Sürüm oluştur"** veya **"Yeni sürüm oluştur"** butonuna tıklayın

2. **"Uygulama paketleri"** bölümünde:
   - AAB dosyasını sürükleyip bırakın (`app-release.aab`)
   - VEYA **"↑ Yükle"** butonuna tıklayıp dosyayı seçin

3. **Sürüm bilgileri:**
   - **Sürüm adı:** `v1.0.2 (Closed Test)` veya `1.0.2`
   - **Sürüm notları (opsiyonel):**
     ```
     Kapalı test sürümü
     - Yeni özellikler
     - Hata düzeltmeleri
     - Performans iyileştirmeleri
     ```

4. **"İleri"** butonuna tıklayın

5. **Önizleme ve onay:**
   - Hataları kontrol edin
   - Uyarıları gözden geçirin
   - **"Sürümü yayınla"** veya **"Onayla"** butonuna tıklayın

## 👥 Adım 3: Test Kullanıcıları Ekleme

### 3.1 Test Kullanıcıları Ekleme

1. **"Kapalı test"** sayfasında **"Test kullanıcıları"** sekmesine gidin

2. **"E-posta listesi"** seçeneğini seçin

3. **Test kullanıcılarının e-posta adreslerini ekleyin:**
   - Her satıra bir e-posta
   - VEYA virgülle ayırarak ekleyin

4. **"Kaydet"** butonuna tıklayın

### 3.2 Test Linkini Paylaşma

1. **"Test kullanıcıları"** bölümünde **"Test linkini kopyala"** butonuna tıklayın

2. **Test linkini test kullanıcılarına gönderin:**
   ```
   https://play.google.com/apps/internaltest/[TEST_ID]
   ```

3. Test kullanıcıları bu linke tıklayarak uygulamayı indirebilir

## ✅ Kontrol Listesi

- [ ] Version code 3'e güncellendi
- [ ] Production build yapıldı
- [ ] Android Studio'da AAB oluşturuldu
- [ ] AAB dosyası hazır (`app-release.aab`)
- [ ] Google Play Console'da kapalı test sayfasına gidildi
- [ ] Yeni sürüm oluşturuldu
- [ ] AAB dosyası yüklendi
- [ ] Sürüm bilgileri girildi
- [ ] Sürüm yayınlandı
- [ ] Test kullanıcıları eklendi
- [ ] Test linki paylaşıldı

## 📝 Sürüm Notları Örneği

```
Kapalı Test Sürümü v1.0.2

Yeni Özellikler:
- Favoriler özelliği eklendi
- Fiyat düşüş bildirimleri
- Geliştirilmiş arama

Hata Düzeltmeleri:
- Fiyat ekleme sorunları düzeltildi
- Performans iyileştirmeleri

Bilinen Sorunlar:
- [Varsa bilinen sorunları buraya ekleyin]
```

## 🔄 Dahili Test vs Kapalı Test

### Dahili Test (Internal Test)
- **Kullanıcı sayısı:** Maksimum 100
- **Onay süresi:** Hemen (otomatik)
- **Kullanım:** Hızlı test için

### Kapalı Test (Closed Test)
- **Kullanıcı sayısı:** Sınırsız (ancak belirli gruplar)
- **Onay süresi:** Birkaç saat (Google incelemesi)
- **Kullanım:** Daha geniş test grubu için

## 🚨 Önemli Notlar

1. **Version Code:** Her yeni sürümde mutlaka artırılmalı
2. **Keystore:** Aynı keystore kullanılmalı (farklı keystore kullanılamaz)
3. **Test Kullanıcıları:** E-posta adresleri Google hesabı olmalı
4. **Onay Süresi:** Kapalı test için Google onayı gerekir (1-3 saat)
5. **Sürüm Notları:** Kullanıcılar için açıklayıcı olmalı

## 🐛 Sorun Giderme

### "Version code has been used before"
- Version code'u artırın (şu an 3)
- Yeni AAB oluşturun

### "Keystore hatası"
- Aynı keystore'u kullandığınızdan emin olun
- Keystore şifresini kontrol edin

### "Test kullanıcıları uygulamayı göremiyor"
- Test linkini doğru paylaştığınızdan emin olun
- Kullanıcıların Google hesabı ile giriş yaptığından emin olun
- Sürümün onaylandığını kontrol edin

## 📚 Kaynaklar

- [Google Play Console - Closed Testing](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Version Codes](https://developer.android.com/studio/publish/versioning)

Hazır olduğunuzda yeni AAB'i oluşturup kapalı test'e yükleyebilirsiniz!

