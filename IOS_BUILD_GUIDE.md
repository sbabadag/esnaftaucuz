# iOS Derleme Rehberi

## 📱 iOS Platform Durumu

✅ **iOS platformu zaten eklenmiş ve yapılandırılmış!**

Projenizde:
- `ios/` klasörü mevcut
- `@capacitor/ios` paketi yüklü
- Podfile yapılandırılmış
- Gerekli Capacitor plugin'leri eklenmiş

## ⚠️ Windows'ta iOS Derleme

**Windows'ta doğrudan iOS derlemesi yapılamaz.** iOS derlemesi için **macOS** ve **Xcode** gereklidir.

## 🖥️ Gereksinimler

### 1. macOS
- macOS 10.15 (Catalina) veya üzeri
- En az 8GB RAM (16GB önerilir)
- En az 20GB boş disk alanı

### 2. Xcode
- App Store'dan ücretsiz indirilebilir
- En son sürümü önerilir (Xcode 15+)
- Command Line Tools: `xcode-select --install`

### 3. Apple Developer Hesabı
- **Test için:** Ücretsiz (7 günlük sınırlı imzalama)
- **App Store/TestFlight için:** Yıllık $99 (Apple Developer Program)

## 🚀 iOS Derleme Adımları

### 1. Projeyi macOS'a Taşıyın

```bash
# Projeyi klonlayın veya kopyalayın
git clone <repository-url>
cd Mahallem

# Bağımlılıkları yükleyin
npm install
```

### 2. iOS Bağımlılıklarını Yükleyin

```bash
# CocoaPods yüklü olmalı (macOS'ta genellikle yüklü)
sudo gem install cocoapods

# iOS bağımlılıklarını yükle
cd ios/App
pod install
cd ../..
```

### 3. Projeyi Build Edin ve Sync Edin

```bash
# Web build
npm run build

# Capacitor sync
npx cap sync ios
```

### 4. Xcode'da Açın

```bash
# Xcode'u aç
npx cap open ios
```

veya

```bash
npm run mobile:ios
```

### 5. Xcode'da Yapılandırma

1. **Signing & Capabilities:**
   - Target: `App` seçin
   - "Signing & Capabilities" sekmesine gidin
   - "Automatically manage signing" işaretleyin
   - Team seçin (Apple Developer hesabınız)

2. **Bundle Identifier:**
   - `com.esnaftaucuz.app` (zaten yapılandırılmış)

3. **Info.plist İzinleri:**
   - Camera: ✅ Yapılandırılmış
   - Location: ✅ Yapılandırılmış
   - Photo Library: ✅ Yapılandırılmış

### 6. Simulator'da Test

1. Xcode'da üst kısımdan bir iOS Simulator seçin
2. ▶️ (Play) butonuna tıklayın
3. Uygulama simulator'da açılacak

### 7. Gerçek Cihazda Test

1. iPhone'unuzu USB ile Mac'e bağlayın
2. Xcode'da cihazınızı seçin
3. "Trust This Computer" onayını verin (iPhone'da)
4. ▶️ (Play) butonuna tıklayın
5. iPhone'da: Settings → General → VPN & Device Management → Developer App → Trust

### 8. Production Build (App Store/TestFlight)

1. **Archive Oluştur:**
   - Xcode: Product → Archive
   - Archive tamamlandıktan sonra Organizer açılır

2. **App Store'a Yükle:**
   - "Distribute App" butonuna tıklayın
   - "App Store Connect" seçin
   - "Upload" seçin
   - Sonraki adımları takip edin

3. **TestFlight:**
   - App Store Connect'te uygulamanızı yükleyin
   - TestFlight sekmesine gidin
   - Beta testers ekleyin

## 🔄 Alternatif Çözümler (Windows'ta)

### 1. macOS Virtual Machine (VM)
- **VMware** veya **VirtualBox** kullanarak macOS VM oluşturun
- ⚠️ Apple'ın lisans sözleşmesi gereği yalnızca Apple donanımında macOS çalıştırılabilir
- ⚠️ Yasal olmayabilir

### 2. Bulut macOS Servisleri
- **MacStadium** (ücretli)
- **MacinCloud** (ücretli)
- **AWS EC2 Mac instances** (ücretli)

### 3. CI/CD Servisleri
- **GitHub Actions** (macOS runner'ları var)
- **Codemagic** (iOS build desteği)
- **Bitrise** (iOS build desteği)
- **AppCircle** (iOS build desteği)

### 4. GitHub Actions ile Otomatik Build

`.github/workflows/ios-build.yml` dosyası oluşturun:

```yaml
name: iOS Build

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: macos-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build web
      run: npm run build
    
    - name: Install CocoaPods
      run: |
        sudo gem install cocoapods
        cd ios/App
        pod install
        cd ../..
    
    - name: Sync Capacitor
      run: npx cap sync ios
    
    - name: Build iOS
      run: |
        cd ios/App
        xcodebuild -workspace App.xcworkspace \
          -scheme App \
          -configuration Release \
          -archivePath build/App.xcarchive \
          archive
```

## 📋 iOS Yapılandırma Kontrol Listesi

- [x] iOS platformu eklendi
- [x] Capacitor iOS paketi yüklü
- [x] Podfile yapılandırılmış
- [x] Camera izinleri yapılandırılmış
- [x] Geolocation izinleri yapılandırılmış
- [x] Bundle ID: `com.esnaftaucuz.app`
- [ ] Apple Developer hesabı (App Store için)
- [ ] Xcode yüklü (macOS'ta)
- [ ] CocoaPods yüklü (macOS'ta)

## 🔧 Sorun Giderme

### Pod Install Hatası
```bash
cd ios/App
pod deintegrate
pod install
```

### Xcode Cache Temizleme
```bash
# Xcode'da: Product → Clean Build Folder (Shift+Cmd+K)
# Veya terminal:
rm -rf ~/Library/Developer/Xcode/DerivedData
```

### Capacitor Sync Hatası
```bash
npm run build
npx cap sync ios --force
```

## 📱 TestFlight Yayınlama

1. **App Store Connect'te Uygulama Oluştur:**
   - https://appstoreconnect.apple.com
   - "My Apps" → "+" → "New App"
   - Bilgileri doldurun

2. **Archive ve Upload:**
   - Xcode'da Product → Archive
   - Organizer'da "Distribute App"
   - "App Store Connect" → "Upload"

3. **TestFlight'ta Test:**
   - App Store Connect → TestFlight
   - Internal Testing veya External Testing ekleyin

## 💡 Öneriler

1. **İlk Build:** Simulator'da test edin (daha hızlı)
2. **Gerçek Cihaz:** Önemli özellikleri test edin (kamera, konum)
3. **TestFlight:** Beta testers ekleyin
4. **App Store:** Production release için App Store Review Guidelines'a uyun

## 📞 Destek

iOS derleme ile ilgili sorunlar için:
- [Capacitor iOS Docs](https://capacitorjs.com/docs/ios)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Xcode Help](https://developer.apple.com/xcode/)

