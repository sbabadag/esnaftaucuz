# Windows'ta iOS Build - Capacitor ile

## ✅ Windows'ta Yapabilecekleriniz

### 1. Capacitor Sync (Windows'ta Çalışır)
```bash
# Web build
npm run build

# iOS dosyalarını sync et (Windows'ta çalışır!)
npx cap sync ios
```

Bu komut:
- ✅ `dist/` klasöründeki dosyaları `ios/App/App/public/` klasörüne kopyalar
- ✅ Capacitor yapılandırmalarını günceller
- ✅ Plugin'leri sync eder
- ⚠️ Ancak **build yapmaz**, sadece dosyaları hazırlar

### 2. Build Script'i (Windows'ta Çalışır)
```bash
npm run mobile:build
# veya
npm run build && npx cap sync ios
```

## 🚀 Windows'tan iOS Build - 3 Yöntem

### Yöntem 1: GitHub Actions (ÖNERİLEN - ÜCRETSİZ)

Zaten hazır! `.github/workflows/ios-build.yml` dosyası mevcut.

**Kullanım:**
1. Değişiklikleri commit edin:
```bash
git add .
git commit -m "iOS build için hazır"
git push
```

2. GitHub'da:
   - Repository → **Actions** sekmesi
   - **iOS Build** workflow'unu seçin
   - **Run workflow** butonuna tıklayın
   - Build tamamlandıktan sonra **artifact** olarak indirin

**Avantajlar:**
- ✅ Ücretsiz (public repo için)
- ✅ macOS runner'ları kullanır
- ✅ Otomatik build
- ✅ Artifact olarak indirilebilir

### Yöntem 2: Codemagic (ÜCRETSİZ PLAN VAR)

Codemagic, Capacitor projeleri için özel olarak tasarlanmış bir CI/CD servisi.

**Kurulum:**
1. https://codemagic.io adresine gidin
2. GitHub hesabınızla giriş yapın
3. Repository'nizi bağlayın
4. Capacitor template'i seçin
5. Otomatik yapılandırılır!

**Avantajlar:**
- ✅ Capacitor için optimize edilmiş
- ✅ Ücretsiz plan (500 build dakikası/ay)
- ✅ TestFlight'a otomatik upload
- ✅ Windows'tan tam kontrol

### Yöntem 3: Bitrise (ÜCRETSİZ PLAN VAR)

**Kurulum:**
1. https://bitrise.io adresine gidin
2. GitHub hesabınızla giriş yapın
3. Repository'nizi bağlayın
4. iOS workflow'u seçin

**Avantajlar:**
- ✅ Ücretsiz plan (200 build/ay)
- ✅ Kolay yapılandırma
- ✅ TestFlight entegrasyonu

## 📋 Windows'ta Yapılacaklar Listesi

### Adım 1: Projeyi Hazırla (Windows'ta)
```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Web build
npm run build

# 3. iOS sync (Windows'ta çalışır!)
npx cap sync ios

# 4. Commit ve push
git add .
git commit -m "iOS build hazır"
git push
```

### Adım 2: GitHub Actions ile Build (Otomatik)
1. GitHub → Actions → iOS Build → Run workflow
2. Build tamamlanınca artifact indir

### Adım 3: macOS'ta Final Build (İsteğe Bağlı)
Eğer macOS erişiminiz varsa:
```bash
# macOS'ta:
cd ios/App
pod install
cd ../..
npx cap open ios
# Xcode'da build edin
```

## 🔧 Windows'ta Test Etme

### Capacitor Sync Test
```bash
# Windows'ta çalışır
npm run build
npx cap sync ios

# Kontrol et
dir ios\App\App\public
```

### Build Script Test
```bash
# Windows'ta çalışır
npm run mobile:build
```

## 📱 iOS Build Sonrası

### GitHub Actions Artifact İndirme
1. GitHub → Actions → Son build'e tıklayın
2. **Artifacts** bölümüne gidin
3. **ios-build** artifact'ını indirin
4. `.ipa` veya `.xcarchive` dosyasını alın

### TestFlight'a Yükleme
1. macOS'ta Xcode'u açın
2. Archive'i import edin
3. App Store Connect'e upload edin

## 💡 Pratik İpuçları

### 1. Otomatik Sync Script (Windows)
`build-ios-sync.bat` dosyası oluşturun:
```batch
@echo off
echo Building web app...
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%

echo Syncing iOS...
call npx cap sync ios
if %errorlevel% neq 0 exit /b %errorlevel%

echo Done! Ready for GitHub Actions build.
pause
```

### 2. GitHub Actions Workflow Kullanımı
```bash
# Her push'ta otomatik build
git push

# Manuel build için
# GitHub → Actions → iOS Build → Run workflow
```

### 3. Codemagic Yapılandırması
`codemagic.yaml` dosyası oluşturun:
```yaml
workflows:
  ios-workflow:
    name: iOS Workflow
    max_build_duration: 120
    instance_type: mac_mini_m1
    integrations:
      app_store_connect: codemagic
    environment:
      groups:
        - app_store_credentials
      vars:
        XCODE_WORKSPACE: "ios/App/App.xcworkspace"
        XCODE_SCHEME: "App"
        BUNDLE_ID: "com.esnaftaucuz.app"
    scripts:
      - name: Install dependencies
        script: |
          npm install
      - name: Build web
        script: |
          npm run build
      - name: Install CocoaPods
        script: |
          cd ios/App
          pod install
      - name: Sync Capacitor
        script: |
          npx cap sync ios
      - name: Build iOS
        script: |
          xcodebuild build \
            -workspace "$XCODE_WORKSPACE" \
            -scheme "$XCODE_SCHEME" \
            -configuration Release \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO
    artifacts:
      - build/ios/ipa/*.ipa
      - /tmp/xcodebuild_logs/*.log
```

## 🎯 Özet

**Windows'ta Yapabilecekleriniz:**
- ✅ `npm run build` - Web build
- ✅ `npx cap sync ios` - iOS dosyalarını sync et
- ✅ `git push` - GitHub'a push et
- ✅ GitHub Actions ile otomatik build

**Windows'ta Yapamayacaklarınız:**
- ❌ `npx cap open ios` - Xcode açılamaz
- ❌ `pod install` - CocoaPods Windows'ta çalışmaz
- ❌ Xcode build - macOS gereklidir

**Çözüm:**
- ✅ GitHub Actions (ÜCRETSİZ)
- ✅ Codemagic (Ücretsiz plan)
- ✅ Bitrise (Ücretsiz plan)

## 📞 Destek

Sorularınız için:
- [Capacitor Docs](https://capacitorjs.com/docs)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Codemagic Docs](https://docs.codemagic.io)

