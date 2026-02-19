# Android AAB İmzalama Kurulumu

## 🔐 Sorun

Google Play Console hatası: **"Yüklenen tüm paketler imzalanmış olmalıdır"**

AAB dosyası imzalanmamış. İmzalama yapılandırması eksik.

## ✅ Çözüm Adımları

### 1. Keystore Dosyasını Kontrol Edin

Keystore dosyanız şu konumda olmalı:
```
android/app/esnaftaucuz-release-key.jks
```

**Eğer keystore yoksa:**
```bash
# Android Studio'yu açın
npx cap open android

# Build → Generate Signed Bundle / APK
# → Android App Bundle seçin
# → "Create new..." tıklayın
# → Keystore oluşturun
```

### 2. key.properties Dosyası Oluşturun

1. `android/key.properties.template` dosyasını kopyalayın:
   ```bash
   # Windows PowerShell
   Copy-Item android\key.properties.template android\key.properties
   ```

2. `android/key.properties` dosyasını açın ve şifreleri girin:
   ```properties
   storePassword=GERÇEK_KEYSTORE_ŞİFRENİZ
   keyPassword=GERÇEK_KEY_ŞİFRENİZ
   keyAlias=esnaftaucuz
   storeFile=app/esnaftaucuz-release-key.jks
   ```

**ÖNEMLİ:** 
- `key.properties` dosyası `.gitignore`'da olduğu için git'e commit edilmeyecek
- Şifrelerinizi güvenli tutun!

### 3. AAB'i Yeniden Oluşturun

```bash
# Android klasörüne gidin
cd android

# Signed AAB oluşturun
.\gradlew.bat bundleRelease

# Veya root dizinden
cd android; .\gradlew.bat bundleRelease
```

### 4. Yeni AAB'i Google Play Console'a Yükleyin

1. Yeni AAB dosyası: `android/app/build/outputs/bundle/release/app-release.aab`
2. Google Play Console'da eski AAB'i kaldırın
3. Yeni imzalı AAB'i yükleyin

## 🔍 Alternatif: Android Studio ile İmzalama

Eğer Gradle ile imzalama çalışmazsa:

1. **Android Studio'yu açın:**
   ```bash
   npx cap open android
   ```

2. **Build → Generate Signed Bundle / APK**
   - **Android App Bundle** seçin
   - **Keystore:** `android/app/esnaftaucuz-release-key.jks` seçin
   - **Key alias:** `esnaftaucuz`
   - **Key store password:** Keystore şifrenizi girin
   - **Key password:** Key şifrenizi girin
   - **Build variant:** `release` seçin
   - **Finish**

3. **AAB Dosyası:**
   - `android/app/release/app-release.aab` (Android Studio oluşturur)
   - VEYA `android/app/build/outputs/bundle/release/app-release.aab` (Gradle oluşturur)

## ✅ Kontrol

İmzalı AAB'i kontrol etmek için:
```bash
# AAB dosyasının imzalı olduğunu kontrol edin
# Google Play Console yükleme sırasında hata vermemeli
```

## 🚨 Sorun Giderme

### "key.properties not found"
- `android/key.properties` dosyasının var olduğundan emin olun
- Dosya yolunu kontrol edin: `android/key.properties`

### "Keystore file not found"
- Keystore dosyasının `android/app/esnaftaucuz-release-key.jks` konumunda olduğundan emin olun
- `key.properties` içindeki `storeFile` yolunu kontrol edin

### "Wrong password"
- Keystore ve key şifrelerini doğru girdiğinizden emin olun
- Şifreler büyük/küçük harf duyarlıdır

### "App not signed" hatası devam ediyor
- Android Studio'da **Generate Signed Bundle** kullanın
- Keystore bilgilerini manuel olarak girin

## 📝 Notlar

- **Keystore Güvenliği:** Keystore dosyasını ve şifrelerini GÜVENLİ bir yerde saklayın
- **Git:** `key.properties` dosyası `.gitignore`'da, commit edilmeyecek
- **Google Play App Signing:** Google Play App Signing kullanıyorsanız, upload key'i güvenli tutun
