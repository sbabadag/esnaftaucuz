# Codemagic iOS Build Kurulum Rehberi

## 🚀 Codemagic Nedir?

Codemagic, Capacitor ve React Native projeleri için özel olarak tasarlanmış bir CI/CD servisidir. iOS build için çok daha kolay ve güvenilirdir.

## ✅ Avantajlar

- ✅ **Ücretsiz Plan:** 500 build dakikası/ay
- ✅ **Capacitor Optimize:** Capacitor projeleri için özel template
- ✅ **Otomatik Signing:** Apple Developer hesabı ile otomatik imzalama
- ✅ **TestFlight Upload:** Otomatik TestFlight'a yükleme
- ✅ **Kolay Kurulum:** GitHub bağlantısı ile 5 dakikada kurulum

## 📋 Kurulum Adımları

### Adım 1: Codemagic Hesabı Oluştur

1. **Codemagic'e Git:**
   - https://codemagic.io adresine gidin
   - **"Start building for free"** butonuna tıklayın

2. **GitHub ile Giriş:**
   - **"Sign in with GitHub"** butonuna tıklayın
   - GitHub hesabınızla giriş yapın
   - Codemagic'e repository erişim izni verin

### Adım 2: Repository Bağla

1. **Repository Seç:**
   - Codemagic dashboard'da **"Add application"** butonuna tıklayın
   - **GitHub** seçin
   - `sbabadag/esnaftaucuz` repository'sini seçin
   - **"Next: Select a workflow"** butonuna tıklayın

2. **Workflow Seç:**
   - **"Configure workflow"** seçeneğini seçin
   - **"Capacitor"** template'ini seçin
   - **"Next"** butonuna tıklayın

### Adım 3: Yapılandırma Dosyası

Projenizde zaten `codemagic.yaml` dosyası var! Codemagic otomatik olarak algılayacak.

**Eğer algılamazsa:**
1. Codemagic'te **"Configuration"** sekmesine gidin
2. **"Use configuration file"** seçeneğini seçin
3. `codemagic.yaml` dosyasının yolu: **Root directory**

### Adım 4: Apple Developer Hesabı (İsteğe Bağlı)

**Test için (Ücretsiz):**
- Apple ID ile 7 günlük imzalama yapılabilir
- Codemagic otomatik olarak yönetir

**App Store/TestFlight için:**
1. **App Store Connect API Key Oluştur:**
   - https://appstoreconnect.apple.com → **Users and Access** → **Keys**
   - **+** butonuna tıklayın
   - Key adı: `Codemagic iOS`
   - **App Manager** rolü seçin
   - Key'i indirin (`.p8` dosyası)

2. **Codemagic'e Ekle:**
   - Codemagic → **Teams** → **Code signing identities**
   - **Add credentials** → **App Store Connect API key**
   - Key ID, Issuer ID ve `.p8` dosyasını yükleyin

3. **Environment Group Oluştur:**
   - Codemagic → **Teams** → **Environment variables**
   - **Add group** → `app_store_credentials`
   - API key bilgilerini ekleyin

### Adım 5: İlk Build

1. **Build Başlat:**
   - Codemagic dashboard'da **"Start new build"** butonuna tıklayın
   - Branch: `main` seçin
   - Workflow: `ios-workflow` seçin
   - **"Start new build"** butonuna tıklayın

2. **Build İzle:**
   - Build loglarını canlı olarak izleyebilirsiniz
   - Build tamamlanınca `.ipa` dosyası indirilebilir

## 📱 iPhone'a Yükleme

### Yöntem 1: Codemagic'ten İndir + Sideloadly

1. **IPA İndir:**
   - Codemagic → Build → **Artifacts**
   - `.ipa` dosyasını indirin

2. **Sideloadly ile Yükle:**
   - Sideloadly'yi açın (https://sideloadly.io)
   - iPhone'unuzu USB ile bağlayın
   - `.ipa` dosyasını seçin
   - Apple ID ile giriş yapın
   - **Start** butonuna tıklayın

### Yöntem 2: TestFlight (Apple Developer Hesabı ile)

1. **Codemagic Yapılandırması:**
   - `codemagic.yaml` dosyasında `app_store_credentials` group'unu aktif edin
   - App Store Connect API key ekleyin

2. **Otomatik Upload:**
   - Build tamamlanınca otomatik olarak TestFlight'a yüklenir
   - App Store Connect'te TestFlight sekmesinden test edebilirsiniz

## 🔧 Yapılandırma Dosyası Açıklaması

`codemagic.yaml` dosyası şunları içerir:

```yaml
workflows:
  ios-workflow:
    name: iOS Workflow
    max_build_duration: 120  # 2 dakika
    instance_type: mac_mini_m1  # M1 Mac (hızlı)
    environment:
      vars:
        XCODE_WORKSPACE: "ios/App/App.xcworkspace"
        XCODE_SCHEME: "App"
        BUNDLE_ID: "com.esnaftaucuz.app"
    scripts:
      - Install dependencies
      - Build web
      - Install CocoaPods
      - Sync Capacitor
      - Build iOS Archive
    artifacts:
      - build/ios/ipa/*.ipa  # IPA dosyası
      - *.xcarchive  # Archive dosyası
```

## 💡 İpuçları

### 1. Build Hızlandırma
- `instance_type: mac_mini_m1` kullanın (M1 Mac daha hızlı)
- Cache kullanın (Codemagic otomatik yönetir)

### 2. Email Bildirimleri
`codemagic.yaml` dosyasında email adresinizi güncelleyin:
```yaml
publishing:
  email:
    recipients:
      - your-email@example.com  # Buraya email'inizi yazın
```

### 3. Otomatik Build
- **GitHub webhook** ile otomatik build yapılabilir
- Codemagic → **Settings** → **Build triggers**
- **"Build on push"** aktif edin

### 4. Branch Seçimi
Her build'de hangi branch'in build edileceğini seçebilirsiniz:
- Codemagic → **Start new build** → Branch seçin

## 🐛 Sorun Giderme

### Build Başarısız Olursa

1. **Logları Kontrol Et:**
   - Codemagic → Build → **Logs**
   - Hata mesajlarını okuyun

2. **Yaygın Hatalar:**

   **CocoaPods Hatası:**
   ```bash
   cd ios/App
   pod deintegrate
   pod install
   ```

   **Signing Hatası:**
   - Apple Developer hesabınızı kontrol edin
   - App Store Connect API key'inizi kontrol edin

   **Build Timeout:**
   - `max_build_duration` değerini artırın (örn: 180)

### IPA Dosyası Bulunamıyorsa

1. **Artifacts Kontrol:**
   - Codemagic → Build → **Artifacts**
   - `.ipa` dosyasının oluştuğundan emin olun

2. **Yapılandırma Kontrol:**
   - `codemagic.yaml` dosyasında `artifacts` bölümünü kontrol edin

## 📊 Build İstatistikleri

Codemagic dashboard'da şunları görebilirsiniz:
- Build geçmişi
- Build süreleri
- Başarı/başarısızlık oranları
- Artifact'lar

## 🔗 Faydalı Linkler

- [Codemagic Docs](https://docs.codemagic.io)
- [Codemagic Capacitor Guide](https://docs.codemagic.io/getting-started/capacitor/)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Sideloadly](https://sideloadly.io)

## ✅ Hızlı Başlangıç Checklist

- [ ] Codemagic hesabı oluştur (GitHub ile)
- [ ] Repository bağla
- [ ] `codemagic.yaml` dosyasını kontrol et
- [ ] İlk build'i başlat
- [ ] `.ipa` dosyasını indir
- [ ] Sideloadly ile iPhone'a yükle

## 🎯 Sonraki Adımlar

1. **İlk Build:** Codemagic'te ilk build'i başlatın
2. **Test:** `.ipa` dosyasını indirip Sideloadly ile yükleyin
3. **Otomatikleştir:** GitHub webhook ile otomatik build yapın
4. **TestFlight:** Apple Developer hesabı ile TestFlight'a yükleyin

Başarılar! 🚀




