# Windows'tan iPhone'a IPA Yükleme Rehberi

## 📱 Windows'tan iPhone'a IPA Yükleme Yöntemleri

VNC kullanılamaz çünkü VNC uzaktan masaüstü protokolüdür, iOS uygulama yükleme için kullanılmaz.

## 🚀 Yöntem 1: Sideloadly (ÖNERİLEN - En Kolay)

### Kurulum
1. **Sideloadly İndir:**
   - https://sideloadly.io adresine gidin
   - Windows için `.exe` dosyasını indirin
   - Kurulum yapın

### Kullanım
1. **Codemagic'ten IPA İndir:**
   - Codemagic → Build → **Artifacts**
   - `.ipa` dosyasını indirin

2. **iPhone'u Bağla:**
   - iPhone'unuzu USB kablosu ile Windows PC'ye bağlayın
   - iPhone'da **"Trust This Computer"** onayını verin
   - **Developer Mode** açık olmalı:
     - Settings → Privacy & Security → Developer Mode → Açık

3. **Sideloadly ile Yükle:**
   - Sideloadly'yi açın
   - **Apple ID** ile giriş yapın
   - **IPA File** butonuna tıklayın
   - Codemagic'ten indirdiğiniz `.ipa` dosyasını seçin
   - **Start** butonuna tıklayın
   - Yükleme tamamlanınca iPhone'da uygulamayı açın

4. **iPhone'da Güven:**
   - Settings → General → VPN & Device Management
   - Developer App → **Trust**

### Avantajlar
- ✅ Windows'ta çalışır
- ✅ Ücretsiz
- ✅ Kolay kullanım
- ✅ USB ile hızlı yükleme

## 🚀 Yöntem 2: AltStore (Alternatif)

### Kurulum
1. **AltStore İndir:**
   - https://altstore.io adresine gidin
   - Windows için `.exe` dosyasını indirin

2. **AltServer Kurulumu:**
   - AltServer'ı çalıştırın
   - iPhone'unuzu USB ile bağlayın
   - AltStore'u iPhone'a yükleyin

### Kullanım
1. **IPA Yükle:**
   - AltStore'u iPhone'da açın
   - **My Apps** → **+** butonuna tıklayın
   - Codemagic'ten indirdiğiniz `.ipa` dosyasını seçin
   - Yükleme tamamlanınca uygulamayı açın

### Avantajlar
- ✅ Windows'ta çalışır
- ✅ Ücretsiz
- ✅ WiFi ile yeniden imzalama (USB gerekmez)

## 🚀 Yöntem 3: 3uTools (Çin Yapımı, Dikkatli Kullanın)

### Kurulum
1. **3uTools İndir:**
   - https://www.3utools.com adresine gidin
   - Windows için `.exe` dosyasını indirin

### Kullanım
1. **iPhone'u Bağla:**
   - iPhone'unuzu USB ile bağlayın
   - 3uTools otomatik algılar

2. **IPA Yükle:**
   - **Apps** sekmesine gidin
   - **Install IPA** butonuna tıklayın
   - Codemagic'ten indirdiğiniz `.ipa` dosyasını seçin
   - Yükleme tamamlanınca uygulamayı açın

### ⚠️ Dikkat
- Çin yapımı bir araç, gizlilik endişeleri olabilir
- Sadece güvenilir kaynaklardan indirin

## 🚀 Yöntem 4: Web Tabanlı Yükleme (Enterprise Sertifikası Gerekir)

### Gereksinimler
- Apple Developer Enterprise Program ($299/yıl)
- Web sunucusu
- HTTPS sertifikası

### Kurulum
1. **Web Sunucusu Hazırla:**
   - `.ipa` dosyasını web sunucusuna yükleyin
   - `manifest.plist` dosyası oluşturun

2. **iPhone'da Yükle:**
   - Safari'de manifest URL'sini açın
   - "Install" butonuna tıklayın

### Avantajlar
- ✅ USB gerekmez
- ✅ Her yerden yüklenebilir
- ❌ Enterprise sertifikası gerektirir (pahalı)

## 🚀 Yöntem 5: Codemagic OTA Updates (Sadece Güncelleme)

Codemagic'in kendi OTA (Over-The-Air) update özelliği var, ancak bu sadece **mevcut uygulamayı güncellemek** için kullanılır, ilk yükleme için değil.

### Kullanım
1. **Codemagic'te OTA Aktif Et:**
   - Codemagic → **OTA Updates** sekmesi
   - OTA'yı aktif edin

2. **İlk Yükleme:**
   - İlk yükleme için yine Sideloadly/AltStore gerekir
   - Sonraki güncellemeler OTA ile yapılabilir

## 📋 Hızlı Karşılaştırma

| Yöntem | Windows | Ücretsiz | USB Gerekir | Kolaylık |
|--------|---------|----------|-------------|----------|
| **Sideloadly** | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **AltStore** | ✅ | ✅ | İlk kurulum | ⭐⭐⭐⭐ |
| **3uTools** | ✅ | ✅ | ✅ | ⭐⭐⭐ |
| **Web Tabanlı** | ✅ | ❌ ($299/yıl) | ❌ | ⭐⭐ |
| **OTA Updates** | ✅ | ✅ | İlk yükleme | ⭐⭐⭐ |

## 🎯 Önerilen Yöntem: Sideloadly

**Neden Sideloadly?**
- ✅ En kolay ve hızlı
- ✅ Windows'ta mükemmel çalışır
- ✅ Ücretsiz
- ✅ Güvenilir
- ✅ USB ile direkt yükleme

## 📝 Adım Adım: Sideloadly ile Yükleme

### 1. Codemagic'ten IPA İndir
```
Codemagic → Build → Artifacts → .ipa dosyasını indir
```

### 2. Sideloadly Kurulumu
```
1. https://sideloadly.io → Download
2. .exe dosyasını çalıştır
3. Kurulumu tamamla
```

### 3. iPhone Hazırlığı
```
1. Settings → Privacy & Security → Developer Mode → Açık
2. iPhone'u USB ile Windows PC'ye bağla
3. "Trust This Computer" onayını ver
```

### 4. Yükleme
```
1. Sideloadly'yi aç
2. Apple ID ile giriş yap
3. IPA File → Codemagic'ten indirdiğiniz .ipa dosyasını seç
4. Start butonuna tıkla
5. Yükleme tamamlanınca iPhone'da uygulamayı aç
```

### 5. Güven
```
Settings → General → VPN & Device Management
Developer App → Trust
```

## ⚠️ Önemli Notlar

### Sertifika Süresi
- **Ücretsiz Apple ID:** 7 gün
- **Developer Program:** 1 yıl
- Süre dolunca yeniden yüklemeniz gerekir

### App-Specific Password
2FA aktifse, Sideloadly için app-specific password gerekir:
1. https://appleid.apple.com → **Sign-In and Security**
2. **App-Specific Passwords** → **Generate**
3. Bu şifreyi Sideloadly'de kullanın

### Developer Mode
iPhone'da Developer Mode mutlaka açık olmalı:
- Settings → Privacy & Security → Developer Mode
- Açık değilse açın ve iPhone'u yeniden başlatın

## 🔗 Faydalı Linkler

- [Sideloadly](https://sideloadly.io)
- [AltStore](https://altstore.io)
- [3uTools](https://www.3utools.com)
- [Codemagic OTA](https://docs.codemagic.io/distribution/ota-updates/)

## 💡 İpuçları

1. **Hızlı Yükleme:** USB 3.0 kullanın (daha hızlı)
2. **Güvenlik:** Sadece güvenilir kaynaklardan IPA indirin
3. **Yedekleme:** IPA dosyalarını yedekleyin
4. **Otomatikleştirme:** Codemagic'ten otomatik email bildirimi alın

## ✅ Sonuç

**En pratik çözüm:** Codemagic'ten IPA indir → Sideloadly ile iPhone'a yükle

VNC kullanılamaz, ancak Sideloadly ile Windows'tan iPhone'a kolayca yükleyebilirsiniz! 🚀

