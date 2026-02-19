# AAB Dosyasını Buluta Yükleme Rehberi

## 📦 AAB Dosyası Bilgileri

**Konum:** `android/app/build/outputs/bundle/release/app-release.aab`
**Boyut:** 4.89 MB
**Version:** 1.0.2 (versionCode: 3)
**Oluşturulma:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## ☁️ Bulut Yükleme Seçenekleri

### Seçenek 1: Google Drive (Önerilen)

1. **Google Drive'a gidin:** https://drive.google.com
2. **"Yeni"** → **"Dosya yükle"** tıklayın
3. Şu dosyayı seçin:
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```
4. Dosya yüklendikten sonra:
   - Sağ tıklayın → **"Bağlantıyı al"**
   - **"Herkesin görüntüleyebileceği"** veya **"Bağlantısı olan herkes"** seçin
   - Bağlantıyı kopyalayın

### Seçenek 2: Dropbox

1. **Dropbox'a gidin:** https://www.dropbox.com
2. Dosyayı sürükleyip bırakın veya **"Yükle"** butonuna tıklayın
3. Dosya yüklendikten sonra:
   - Sağ tıklayın → **"Paylaş"** → **"Bağlantı oluştur"**
   - Bağlantıyı kopyalayın

### Seçenek 3: OneDrive

1. **OneDrive'a gidin:** https://onedrive.live.com
2. Dosyayı sürükleyip bırakın
3. Dosya yüklendikten sonra:
   - Sağ tıklayın → **"Paylaş"** → **"Bağlantı oluştur"**
   - Bağlantıyı kopyalayın

### Seçenek 4: GitHub Releases (Geliştiriciler için)

1. GitHub repository'nize gidin
2. **"Releases"** → **"Draft a new release"**
3. **Tag:** `v1.0.2-closed-test`
4. **Title:** `Closed Beta v1.0.2`
5. **Attach binaries:** AAB dosyasını ekleyin
6. **"Publish release"** tıklayın

## 📤 Google Play Console'a Yükleme

### 1. Google Play Console'a Giriş

1. [Google Play Console](https://play.google.com/console) açın
2. **"esnaftaucuz"** uygulamasını seçin

### 2. Kapalı Test Sayfasına Gidin

1. Sol menüden: **"Test edin ve yayınlayın"** → **"Test etme"** → **"Kapalı test"**
2. **"Sürüm oluştur"** veya **"Yeni sürüm oluştur"** tıklayın

### 3. AAB Dosyasını Yükleyin

**Yöntem A: Doğrudan Yükleme (Önerilen)**
1. **"Uygulama paketleri"** bölümünde:
   - AAB dosyasını sürükleyip bırakın
   - VEYA **"↑ Yükle"** butonuna tıklayıp dosyayı seçin
   - Dosya: `android/app/build/outputs/bundle/release/app-release.aab`

**Yöntem B: Buluttan İndirip Yükleme**
1. Buluta yüklediğiniz AAB dosyasını indirin
2. Google Play Console'da yükleyin

### 4. Sürüm Bilgileri

1. **Sürüm adı:** `v1.0.2 (Closed Test)` veya `1.0.2`
2. **Sürüm notları:**
   ```
   Kapalı Test Sürümü v1.0.2
   
   Yeni Özellikler:
   - "Bugün En Çok Bakılanlar" bölümü en üste taşındı
   - UI iyileştirmeleri
   - Performans optimizasyonları
   
   Hata Düzeltmeleri:
   - Gerçek zamanlı güncellemeler iyileştirildi
   - Edge-to-edge display desteği eklendi
   ```

### 5. Yayınlama

1. **"İleri"** butonuna tıklayın
2. Önizlemeyi kontrol edin
3. **"Sürümü yayınla"** veya **"Onayla"** tıklayın
4. Google onayı bekleyin (1-3 saat)

## ✅ Kontrol Listesi

- [x] Production build oluşturuldu
- [x] Capacitor sync yapıldı
- [x] Signed AAB oluşturuldu (4.89 MB)
- [ ] AAB dosyası buluta yüklendi
- [ ] Google Play Console'da kapalı test sayfasına gidildi
- [ ] Yeni sürüm oluşturuldu
- [ ] AAB dosyası yüklendi
- [ ] Sürüm bilgileri girildi
- [ ] Sürüm yayınlandı
- [ ] Test kullanıcıları eklendi

## 📝 Notlar

- **AAB Dosyası:** `android/app/build/outputs/bundle/release/app-release.aab`
- **Version Code:** 3
- **Version Name:** 1.0.2
- **Keystore:** `android/app/esnaftaucuz-release-key`

## 🔗 Hızlı Linkler

- [Google Play Console](https://play.google.com/console)
- [Google Drive](https://drive.google.com)
- [Dropbox](https://www.dropbox.com)
