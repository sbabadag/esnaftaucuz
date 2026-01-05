# Sideloadly iPhone Bağlantı Sorunları - Sorun Giderme

## 🔴 Sideloadly iPhone'u Görmüyor

Sideloadly iPhone'unuzu görmüyorsa, aşağıdaki adımları sırayla deneyin:

## ✅ Adım 1: Temel Kontroller

### 1. iPhone Kilitli mi?
- iPhone'unuzun **kilitli olmadığından** emin olun
- Ekranı açın ve kilidi açın

### 2. USB Kablosu
- **Orijinal Apple kablosu** kullanın (mümkünse)
- Veya **kaliteli bir USB kablosu** kullanın
- Farklı bir USB kablosu deneyin

### 3. USB Portu
- **USB 2.0 veya 3.0 portu** kullanın
- Farklı bir USB portu deneyin
- **USB hub kullanmayın** (direkt PC'ye bağlayın)

## ✅ Adım 2: iPhone Ayarları

### 1. "Trust This Computer" Onayı

**İlk bağlantıda:**
1. iPhone'u USB ile PC'ye bağlayın
2. iPhone'da **"Trust This Computer"** mesajı çıkacak
3. **"Trust"** butonuna tıklayın
4. iPhone şifrenizi girin

**Eğer mesaj çıkmadıysa:**
1. iPhone'u çıkarıp tekrar takın
2. Settings → General → Reset → Reset Location & Privacy
3. Tekrar bağlayın ve "Trust" onayını verin

### 2. Developer Mode

**Developer Mode açık olmalı:**
1. Settings → Privacy & Security → Developer Mode
2. **Developer Mode** açık olmalı
3. Açık değilse açın ve iPhone'u **yeniden başlatın**

### 3. Screen Time / Restrictions

**Screen Time kapatın:**
1. Settings → Screen Time
2. Screen Time'i geçici olarak kapatın
3. Veya Restrictions'ı kontrol edin

## ✅ Adım 3: Windows Ayarları

### 1. iTunes / Apple Mobile Device Support

**iTunes yüklü olmalı:**
1. **iTunes** yükleyin: https://www.apple.com/itunes/
2. Veya **Apple Mobile Device Support** yükleyin
3. Yükledikten sonra **PC'yi yeniden başlatın**

**Alternatif:**
- **iTunes** yerine **Apple Mobile Device Support** yeterli olabilir
- Windows Store'dan **iTunes** indirebilirsiniz

### 2. USB Sürücüleri

**Apple USB sürücüleri:**
1. Device Manager'ı açın (Win + X → Device Manager)
2. iPhone'u bağlayın
3. **"Portable Devices"** veya **"Universal Serial Bus controllers"** altında iPhone görünüyor mu?
4. Görünmüyorsa veya sarı ünlem işareti varsa:
   - Sağ tık → Update driver
   - "Browse my computer for drivers" seçin
   - iTunes klasöründeki sürücüleri seçin

### 3. Windows Services

**Apple Mobile Device Service çalışıyor mu?**
1. Win + R → `services.msc`
2. **Apple Mobile Device Service** bulun
3. **Running** durumunda olmalı
4. Değilse → Sağ tık → Start

## ✅ Adım 4: Sideloadly Ayarları

### 1. Sideloadly'yi Yeniden Başlat

1. Sideloadly'yi **tamamen kapatın**
2. **Yönetici olarak çalıştırın** (sağ tık → Run as administrator)
3. Tekrar deneyin

### 2. Sideloadly Sürümü

**En son sürümü kullanın:**
1. https://sideloadly.io adresinden **en son sürümü** indirin
2. Eski sürümü kaldırın
3. Yeni sürümü yükleyin

### 3. Sideloadly Ayarları

**Sideloadly'de:**
1. **Settings** veya **Preferences** açın
2. **Device detection** ayarlarını kontrol edin
3. **Auto-detect device** aktif olmalı

## ✅ Adım 5: Alternatif Yöntemler

### 1. AltStore Deneyin

**Sideloadly çalışmıyorsa:**
1. https://altstore.io adresinden **AltStore** indirin
2. AltServer'ı çalıştırın
3. iPhone'u bağlayın
4. AltStore'u iPhone'a yükleyin

### 2. 3uTools Deneyin

**Alternatif araç:**
1. https://www.3utools.com adresinden **3uTools** indirin
2. iPhone'u bağlayın
3. **Apps** sekmesinden IPA yükleyin

⚠️ **Dikkat:** 3uTools Çin yapımı bir araç, gizlilik endişeleri olabilir.

### 3. Xcode (macOS'ta)

**macOS erişiminiz varsa:**
1. Xcode'u açın
2. iPhone'u bağlayın
3. Xcode'da cihazınızı seçin
4. Build & Run yapın

## ✅ Adım 6: Gelişmiş Sorun Giderme

### 1. Windows Event Viewer

**Hataları kontrol edin:**
1. Win + X → Event Viewer
2. Windows Logs → System
3. iPhone bağladığınızda hataları kontrol edin

### 2. USB Debugging (Android değil, iOS)

**iOS'ta USB debugging yok**, ancak:
- Developer Mode açık olmalı
- Trust onayı verilmiş olmalı

### 3. Windows Defender / Antivirus

**Antivirus engelliyor olabilir:**
1. Windows Defender'ı geçici olarak kapatın
2. Veya Sideloadly'yi **exception list**'e ekleyin

### 4. USB Selective Suspend

**USB güç yönetimi:**
1. Control Panel → Power Options
2. Change plan settings → Change advanced power settings
3. USB settings → USB selective suspend setting → **Disabled**

## 📋 Hızlı Kontrol Listesi

- [ ] iPhone kilitli değil
- [ ] USB kablosu çalışıyor
- [ ] "Trust This Computer" onayı verildi
- [ ] Developer Mode açık
- [ ] iTunes / Apple Mobile Device Support yüklü
- [ ] PC yeniden başlatıldı
- [ ] Sideloadly yönetici olarak çalıştırıldı
- [ ] En son Sideloadly sürümü kullanılıyor
- [ ] Apple Mobile Device Service çalışıyor

## 🔧 Yaygın Hata Mesajları

### "No device detected"
- iPhone'u çıkarıp tekrar takın
- "Trust This Computer" onayını verin
- iTunes yüklü olduğundan emin olun

### "Device not trusted"
- iPhone'da Settings → General → Reset → Reset Location & Privacy
- Tekrar bağlayın ve "Trust" onayını verin

### "USB connection failed"
- Farklı USB kablosu deneyin
- Farklı USB portu deneyin
- PC'yi yeniden başlatın

### "Developer Mode is disabled"
- Settings → Privacy & Security → Developer Mode → Açık
- iPhone'u yeniden başlatın

## 💡 İpuçları

1. **İlk Bağlantı:**
   - iPhone'u bağlayın
   - "Trust This Computer" onayını verin
   - iPhone şifresini girin
   - Sideloadly'yi açın

2. **Sıralama Önemli:**
   - Önce iPhone'u bağlayın
   - Sonra Sideloadly'yi açın

3. **Yönetici Hakları:**
   - Sideloadly'yi **her zaman yönetici olarak** çalıştırın

4. **iTunes Gerekli:**
   - Windows'ta iPhone bağlantısı için iTunes **mutlaka** gerekli
   - Sadece Apple Mobile Device Support yeterli olmayabilir

## 🔗 Faydalı Linkler

- [Sideloadly](https://sideloadly.io)
- [iTunes](https://www.apple.com/itunes/)
- [AltStore](https://altstore.io)

## ✅ Sonuç

**En yaygın çözüm:**
1. iTunes yükleyin
2. PC'yi yeniden başlatın
3. iPhone'u bağlayın ve "Trust" onayını verin
4. Sideloadly'yi yönetici olarak çalıştırın

Hala çalışmıyorsa, hangi adımda takıldığınızı ve hata mesajını paylaşın!

