# Hızlı İmzalama Rehberi

## 🚀 Android Studio ile İmzalama (Önerilen - Şifre Gerekmez Dosyada)

Bu yöntem en kolayıdır çünkü şifreleri Android Studio'da manuel girebilirsiniz.

### Adımlar:

1. **Android Studio'yu açın:**
   ```bash
   npx cap open android
   ```

2. **Build → Generate Signed Bundle / APK**

3. **Android App Bundle** seçin → **Next**

4. **Keystore bilgilerini girin:**
   - **Key store path:** `android/app/esnaftaucuz-release-key.jks` seçin
   - **Key store password:** Keystore şifrenizi girin
   - **Key alias:** `esnaftaucuz`
   - **Key password:** Key şifrenizi girin
   - **Next**

5. **Build variant:** `release` seçin → **Finish**

6. **AAB Dosyası:**
   - `android/app/release/app-release.aab` (Android Studio oluşturur)
   - Bu dosyayı Google Play Console'a yükleyin

## 📝 Alternatif: key.properties ile Gradle İmzalama

Eğer şifrelerinizi `key.properties` dosyasına girmek isterseniz:

1. **android/key.properties** dosyasını açın

2. **Şifreleri girin:**
   ```properties
   storePassword=GERÇEK_KEYSTORE_ŞİFRENİZ
   keyPassword=GERÇEK_KEY_ŞİFRENİZ
   keyAlias=esnaftaucuz
   storeFile=app/esnaftaucuz-release-key.jks
   ```

3. **AAB'i oluşturun:**
   ```bash
   cd android
   .\gradlew.bat bundleRelease
   ```

4. **AAB Dosyası:**
   - `android/app/build/outputs/bundle/release/app-release.aab`

## ✅ Hangisini Seçmeliyim?

- **Android Studio:** Şifreleri her seferinde manuel girmek istiyorsanız
- **key.properties:** Otomatik imzalama için (şifreler dosyada saklanır)

**Öneri:** İlk kez Android Studio kullanın, sonra key.properties ile otomatikleştirebilirsiniz.
