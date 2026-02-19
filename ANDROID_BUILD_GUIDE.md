# Android Build ve Google Play Yükleme Rehberi

Bu rehber, Android App Bundle (AAB) oluşturma ve Google Play Console'a dahili test sürümü yükleme adımlarını içerir.

## 📋 Ön Gereksinimler

### 1. Gerekli Yazılımlar
- ✅ **Node.js** (v18 veya üzeri)
- ✅ **Android Studio** (en son sürüm)
- ✅ **Java JDK** (Android Studio ile birlikte gelir)
- ✅ **Google Play Developer Hesabı** ($25 tek seferlik ödeme)

### 2. Google Play Console Kurulumu
1. [Google Play Console](https://play.google.com/console) hesabı oluşturun
2. Developer kayıt ücretini ödeyin ($25)
3. Uygulama oluşturun: **"Tüm uygulamalar"** → **"Uygulama oluştur"**

## 🚀 Android Build Adımları

### 1. Projeyi Hazırlayın

```bash
# Proje dizinine gidin
cd Mahallem

# Bağımlılıkları yükleyin
npm install
```

### 2. Production Build için Capacitor Config'i Güncelleyin

`capacitor.config.ts` dosyasını düzenleyin:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.esnaftaucuz.app',
  appName: 'esnaftaucuz',
  webDir: 'dist',
  // Production: server.url'yi kaldırın veya yorum satırı yapın
  // server: {
  //   url: 'http://192.168.3.13:5173',
  //   cleartext: true
  // },
  plugins: {
    Camera: {
      permissions: {
        camera: 'esnaftaucuz needs access to your camera to take photos of prices.',
        photos: 'esnaftaucuz needs access to your photos to select price images.',
      },
    },
    Geolocation: {
      permissions: {
        location: 'esnaftaucuz, sana en yakın fiyatları gösterebilmek için konumuna ihtiyaç duyuyor.',
      },
    },
  },
};

export default config;
```

**ÖNEMLİ:** Production build için `server.url` satırını kaldırın veya yorum satırı yapın!

### 3. Web Build Oluşturun

```bash
# Production build
npm run build
```

Bu komut `dist/` klasörü oluşturur.

### 4. Capacitor Sync

```bash
# Android platformunu sync edin
npx cap sync android
```

### 5. Android Studio'yu Açın

```bash
# Android Studio'yu aç
npx cap open android
```

veya

```bash
npm run mobile:android
```

## 🔐 Keystore Oluşturma (İlk Kez)

Google Play'e yüklemek için uygulamanızı imzalamanız gerekir. İlk kez bir keystore oluşturmanız gerekiyor.

### 1. Keystore Oluştur (Terminal/Command Prompt)

```bash
# Windows (PowerShell veya CMD)
keytool -genkey -v -keystore esnaftaucuz-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias esnaftaucuz

# macOS/Linux
keytool -genkey -v -keystore esnaftaucuz-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias esnaftaucuz
```

**Bilgileri doldurun:**
- **Keystore password**: Güçlü bir şifre (kaydedin!)
- **Key password**: Aynı şifre veya farklı (kaydedin!)
- **Adınız**: İsim
- **Organizasyon**: Organizasyon adı
- **Şehir**: Şehir
- **Ülke**: TR (Türkiye için)

**ÖNEMLİ:** 
- Keystore dosyasını ve şifrelerini GÜVENLİ bir yerde saklayın!
- Bu dosyayı kaybederseniz, uygulamanızı güncelleyemezsiniz!

### 2. Keystore'u Güvenli Yere Taşıyın

```bash
# Keystore'u android/app/ klasörüne taşıyın
# Windows
move esnaftaucuz-release-key.jks android\app\

# macOS/Linux
mv esnaftaucuz-release-key.jks android/app/
```

### 3. Key Properties Dosyası Oluşturun

`android/key.properties` dosyası oluşturun:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=esnaftaucuz
storeFile=app/esnaftaucuz-release-key.jks
```

**ÖNEMLİ:** Bu dosyayı `.gitignore`'a ekleyin! Şifreleri asla commit etmeyin!

### 4. .gitignore'a Ekle

`.gitignore` dosyasına ekleyin:

```
android/key.properties
android/app/*.jks
android/app/*.keystore
```

## 📦 Android App Bundle (AAB) Oluşturma

### Yöntem 1: Android Studio (Önerilen)

1. **Android Studio'da:**
   - **Build** → **Generate Signed Bundle / APK**
   - **Android App Bundle** seçin
   - **Next**

2. **Keystore Seçimi:**
   - **Key store path**: `android/app/esnaftaucuz-release-key.jks` seçin
   - **Key store password**: Keystore şifrenizi girin
   - **Key alias**: `esnaftaucuz`
   - **Key password**: Key şifrenizi girin
   - **Next**

3. **Build Variant:**
   - **release** seçin
   - **Next**

4. **Build:**
   - **Finish** tıklayın
   - Build tamamlandığında AAB dosyası oluşur

5. **AAB Dosyası Konumu:**
   - `android/app/release/app-release.aab`

### Yöntem 2: Gradle Komut Satırı

```bash
# Android klasörüne gidin
cd android

# Release AAB oluşturun
./gradlew bundleRelease

# Windows için
gradlew.bat bundleRelease
```

AAB dosyası: `android/app/build/outputs/bundle/release/app-release.aab`

## 📤 Google Play Console'a Yükleme

### 1. Google Play Console'a Giriş

1. [Google Play Console](https://play.google.com/console) açın
2. Uygulamanızı seçin: **"esnaftaucuz"**

### 2. Dahili Test Sürümü Oluşturma

1. Sol menüden: **"Test etme ve yayınlayın"** → **"Test etme"** → **"Dahili test"**
2. **"Sürüm oluştur"** veya **"Yeni sürüm oluştur"** tıklayın

### 3. AAB Dosyasını Yükleme

1. **"Uygulama paketleri"** bölümünde:
   - AAB dosyasını sürükleyip bırakın
   - VEYA **"↑ Yükle"** butonuna tıklayıp dosyayı seçin
   - Dosya: `android/app/release/app-release.aab`

2. Yükleme tamamlanana kadar bekleyin (birkaç dakika sürebilir)

### 4. Sürüm Bilgileri

1. **"Sürüm adı"** alanına bir isim girin:
   - Örnek: `1.0.0 (Internal Test)`
   - Maksimum 50 karakter

2. **"Sürüm notları"** (opsiyonel):
   - Test kullanıcıları için notlar ekleyebilirsiniz

### 5. Önizleme ve Onaylama

1. **"İleri"** butonuna tıklayın
2. Sürüm bilgilerini kontrol edin
3. **"Sürümü yayınla"** veya **"Onayla"** tıklayın

### 6. Test Kullanıcıları Ekleme

1. **"Test kullanıcıları"** sekmesine gidin
2. **"E-posta adresleri ekle"** tıklayın
3. Test kullanıcılarının e-posta adreslerini ekleyin
4. **"Değişiklikleri kaydet"**

**Not:** Dahili test için maksimum 100 test kullanıcısı ekleyebilirsiniz.

## ✅ Yükleme Sonrası

### 1. Yayın Durumu

- Sürüm yüklendikten sonra **"İncelemede"** durumunda olacak
- Genellikle birkaç saat içinde onaylanır
- Onaylandıktan sonra test kullanıcıları uygulamayı indirebilir

### 2. Test Kullanıcılarına Link Gönderme

1. **"Dahili test"** sayfasında
2. **"Test kullanıcıları"** bölümünde
3. **"Test linkini kopyala"** butonuna tıklayın
4. Bu linki test kullanıcılarına gönderin

### 3. Test Kullanıcıları İçin

Test kullanıcıları:
1. Linke tıklayın
2. Google Play'de uygulamayı açın
3. **"Teste katıl"** butonuna tıklayın
4. Uygulamayı indirebilir

## 🔄 Güncelleme Yükleme

Yeni bir sürüm yüklemek için:

1. Yeni AAB oluşturun (yukarıdaki adımları tekrarlayın)
2. Google Play Console'da **"Yeni sürüm oluştur"**
3. Yeni AAB dosyasını yükleyin
4. Sürüm numarasını artırın (örnek: 1.0.1)
5. Yayınlayın

## 🚨 Yaygın Hatalar ve Çözümleri

### 1. "Upload failed" Hatası

**Sebep:** AAB dosyası bozuk veya eksik
**Çözüm:**
- AAB dosyasını yeniden oluşturun
- Android Studio'da **Build** → **Clean Project**
- Tekrar build edin

### 2. "Version code already exists" Hatası

**Sebep:** Aynı version code ile daha önce sürüm yüklenmiş
**Çözüm:**
- `android/app/build.gradle` dosyasında `versionCode` değerini artırın
- Örnek: `versionCode 1` → `versionCode 2`

### 3. "Keystore not found" Hatası

**Sebep:** Keystore dosyası bulunamıyor
**Çözüm:**
- Keystore dosyasının `android/app/` klasöründe olduğundan emin olun
- `key.properties` dosyasındaki `storeFile` yolunu kontrol edin

### 4. "App not signed" Hatası

**Sebep:** AAB imzalanmamış
**Çözüm:**
- Android Studio'da **Generate Signed Bundle** kullanın
- Keystore bilgilerini doğru girdiğinizden emin olun

## 📝 Kontrol Listesi

Yüklemeden önce kontrol edin:

- [ ] `capacitor.config.ts`'de `server.url` kaldırıldı/yorum satırı yapıldı
- [ ] `npm run build` başarıyla tamamlandı
- [ ] `npx cap sync android` başarıyla tamamlandı
- [ ] Keystore oluşturuldu ve güvenli yerde saklandı
- [ ] `key.properties` dosyası oluşturuldu
- [ ] AAB dosyası başarıyla oluşturuldu
- [ ] Google Play Console'da uygulama oluşturuldu
- [ ] Test kullanıcıları eklendi

## 🔐 Güvenlik Notları

1. **Keystore Güvenliği:**
   - Keystore dosyasını ve şifrelerini GÜVENLİ bir yerde saklayın
   - Cloud backup yapın (şifreli)
   - Asla public repository'ye commit etmeyin

2. **Key Properties:**
   - `key.properties` dosyasını `.gitignore`'a ekleyin
   - Şifreleri environment variables olarak kullanmayı düşünün

3. **Google Play App Signing:**
   - Google Play App Signing kullanıyorsanız, upload key'i güvenli tutun
   - App signing key Google tarafından yönetilir

## 📚 Ek Kaynaklar

- [Google Play Console Yardım](https://support.google.com/googleplay/android-developer)
- [Android App Bundle Rehberi](https://developer.android.com/guide/app-bundle)
- [Capacitor Android Docs](https://capacitorjs.com/docs/android)
- [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)

## 💡 İpuçları

1. **İlk Yükleme:**
   - Küçük bir test grubuyla başlayın
   - Uygulamayı test edin
   - Geri bildirim toplayın

2. **Sürüm Numaralandırma:**
   - Semantic versioning kullanın: `MAJOR.MINOR.PATCH`
   - Örnek: `1.0.0`, `1.0.1`, `1.1.0`

3. **Test Süreci:**
   - Dahili test → Kapalı test → Açık test → Production
   - Her aşamada daha fazla kullanıcı ekleyin

4. **Hata Ayıklama:**
   - Google Play Console'da crash raporlarını kontrol edin
   - Test kullanıcılarından geri bildirim alın
   - Logcat kullanarak hataları inceleyin


