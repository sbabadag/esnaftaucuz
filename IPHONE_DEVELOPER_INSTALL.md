# Developer Mode iPhone'a Yükleme Rehberi

## 📱 Developer Mode Açık iPhone'a Yükleme

Developer mode açık iPhone'unuza uygulamayı yüklemek için birkaç yöntem var.

## 🚀 Yöntem 1: GitHub Actions + Sideloadly (ÖNERİLEN - Windows'ta)

### Adım 1: GitHub Actions ile Build

1. **Windows'ta hazırlık:**
```bash
npm run build
npx cap sync ios
git add .
git commit -m "iOS build for device"
git push
```

2. **GitHub'da build:**
   - GitHub → **Actions** sekmesi
   - **iOS Build** workflow'unu seçin
   - **Run workflow** → **Run workflow** butonuna tıklayın
   - Build tamamlanınca **artifact** olarak `.ipa` dosyasını indirin

### Adım 2: Sideloadly ile Yükleme (Windows'ta)

1. **Sideloadly İndir:**
   - https://sideloadly.io adresinden indirin
   - Windows için `.exe` dosyasını indirin

2. **Apple ID ile Giriş:**
   - Sideloadly'yi açın
   - Apple ID'nizi girin (2FA aktifse app-specific password gerekebilir)

3. **iPhone'u Bağla:**
   - iPhone'unuzu USB ile Windows PC'ye bağlayın
   - iPhone'da "Trust This Computer" onayını verin
   - Developer mode açık olduğundan emin olun

4. **IPA Yükle:**
   - Sideloadly'de **IPA File** butonuna tıklayın
   - GitHub Actions'tan indirdiğiniz `.ipa` dosyasını seçin
   - **Start** butonuna tıklayın
   - iPhone'da ayarlardan uygulamaya güvenin

## 🚀 Yöntem 2: GitHub Actions + AltStore (Windows'ta)

### Adım 1: AltStore İndir
- https://altstore.io adresinden indirin
- Windows için `.exe` dosyasını indirin

### Adım 2: AltServer Kurulumu
1. AltServer'ı çalıştırın
2. iPhone'unuzu USB ile bağlayın
3. AltStore'u iPhone'a yükleyin

### Adım 3: IPA Yükleme
1. AltStore'u iPhone'da açın
2. **My Apps** → **+** butonuna tıklayın
3. GitHub Actions'tan indirdiğiniz `.ipa` dosyasını seçin
4. Yükleme tamamlanınca iPhone'da uygulamayı açın

## 🚀 Yöntem 3: Codemagic ile Build + Yükleme

### Adım 1: Codemagic Kurulumu
1. https://codemagic.io adresine gidin
2. GitHub hesabınızla giriş yapın
3. Repository'nizi bağlayın
4. Capacitor template'i seçin

### Adım 2: Build ve Download
1. Codemagic'te **Start new build** butonuna tıklayın
2. Build tamamlanınca `.ipa` dosyasını indirin
3. Sideloadly veya AltStore ile yükleyin

## 🚀 Yöntem 4: macOS Erişimi Varsa (Xcode ile)

### Adım 1: Xcode'da Aç
```bash
# macOS'ta:
npm run build
npx cap sync ios
npx cap open ios
```

### Adım 2: iPhone'u Bağla
1. iPhone'unuzu USB ile Mac'e bağlayın
2. Xcode'da cihazınızı seçin
3. **Signing & Capabilities** sekmesinde:
   - **Team** seçin (Apple Developer hesabınız)
   - **Automatically manage signing** işaretleyin

### Adım 3: Build ve Run
1. Xcode'da ▶️ (Play) butonuna tıklayın
2. İlk kez yüklüyorsa iPhone'da:
   - **Settings** → **General** → **VPN & Device Management**
   - Developer App → **Trust**

## 📋 Developer Mode Kontrolü

iPhone'da Developer Mode'un açık olduğundan emin olun:

1. **Settings** → **Privacy & Security** → **Developer Mode**
2. **Developer Mode** açık olmalı
3. Açık değilse açın ve iPhone'u yeniden başlatın

## 🔧 GitHub Actions Workflow Güncelleme

`.github/workflows/ios-build.yml` dosyasını güncelleyerek `.ipa` dosyası oluşturabiliriz:

```yaml
- name: Export IPA
  run: |
    cd ios/App
    xcodebuild -exportArchive \
      -archivePath build/App.xcarchive \
      -exportPath build/ipa \
      -exportOptionsPlist ExportOptions.plist
```

## 💡 Pratik İpuçları

### 1. Apple ID App-Specific Password
2FA aktifse, Sideloadly/AltStore için app-specific password oluşturun:
1. https://appleid.apple.com → **Sign-In and Security**
2. **App-Specific Passwords** → **Generate an app-specific password**
3. Bu şifreyi Sideloadly/AltStore'da kullanın

### 2. Sertifika Süresi
- Ücretsiz Apple ID ile: 7 gün
- Developer Program ile: 1 yıl
- Süre dolunca yeniden yüklemeniz gerekir

### 3. Developer Mode Açık Değilse
1. **Settings** → **Privacy & Security** → **Developer Mode**
2. Açın ve iPhone'u yeniden başlatın
3. Onay verin

## 🎯 Hızlı Başlangıç (Windows'ta)

```bash
# 1. Build ve sync
npm run build
npx cap sync ios

# 2. GitHub'a push
git add .
git commit -m "iOS build for device"
git push

# 3. GitHub Actions'ta build et
# GitHub → Actions → iOS Build → Run workflow

# 4. .ipa dosyasını indir

# 5. Sideloadly ile yükle
# - Sideloadly'yi aç
# - iPhone'u bağla
# - .ipa dosyasını seç
# - Start'a tıkla
```

## ⚠️ Önemli Notlar

1. **Developer Mode:** iPhone'da mutlaka açık olmalı
2. **Apple ID:** Ücretsiz Apple ID ile 7 günlük imzalama
3. **Yeniden Yükleme:** 7 gün sonra yeniden yüklemeniz gerekir
4. **Trust:** İlk yüklemede Settings'ten güvenmeniz gerekir

## 📞 Sorun Giderme

### "Untrusted Developer" Hatası
1. **Settings** → **General** → **VPN & Device Management**
2. Developer App → **Trust**

### "Developer Mode is Disabled" Hatası
1. **Settings** → **Privacy & Security** → **Developer Mode**
2. Açın ve iPhone'u yeniden başlatın

### Sideloadly Bağlantı Hatası
1. iPhone'u USB ile bağlayın
2. "Trust This Computer" onayını verin
3. Developer Mode'un açık olduğundan emin olun

## 🔗 Faydalı Linkler

- [Sideloadly](https://sideloadly.io)
- [AltStore](https://altstore.io)
- [Apple Developer](https://developer.apple.com)
- [Capacitor iOS Docs](https://capacitorjs.com/docs/ios)

