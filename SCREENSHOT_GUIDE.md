# 📱 Telefon Ekran Görüntüleri Hazırlama Rehberi

Google Play Store için telefon ekran görüntüleri hazırlama adımları.

## 📋 Gereksinimler

- **Adet:** 2-8 adet (önerilen: 4-8 adet)
- **Boyut:** Her kenarı minimum 1,080 piksel (önerilen: 1080 x 1920 piksel)
- **Oran:** 16:9 veya 9:16 en boy oranı
- **Format:** PNG veya JPEG
- **Boyut:** Her dosya en fazla 8 MB

## 🎯 Hangi Ekranlardan Screenshot Alınmalı?

### Önerilen Ekranlar (Sırayla):

1. **Ana Ekran (Hero Section)**
   - Hero section ile ana ekran
   - Arama çubuğu
   - Ürün kartları
   - Konum bilgisi

2. **Ürün Detay Sayfası**
   - Ürün detay ekranı
   - Fiyat listesi
   - Konum bilgisi
   - Fotoğraflar

3. **Harita Ekranı**
   - Harita görünümü
   - Fiyat marker'ları
   - Konum gösterimi

4. **Favoriler Ekranı**
   - Favori ürünler listesi
   - Beğenilen ürünler

5. **Profil Ekranı**
   - Kullanıcı profili
   - Ayarlar
   - Menü öğeleri

6. **Fiyat Ekleme Ekranı**
   - Fiyat ekleme formu
   - Fotoğraf yükleme
   - Konum seçimi

7. **Esnaf Dükkanı** (eğer esnaf kullanıcıysa)
   - Esnaf dükkanı ekranı
   - Ürün listesi

8. **Bildirimler Ekranı**
   - Bildirimler listesi
   - Fiyat düşüş bildirimleri

## 📸 Screenshot Alma Yöntemleri

### Yöntem 1: Android Studio Emulator (Önerilen)

1. **Android Studio'yu açın:**
   ```bash
   npx cap open android
   ```

2. **Emulator'ü başlatın:**
   - Android Studio → Device Manager
   - Bir emulator seçin (Pixel 5 veya benzeri)
   - Play butonuna tıklayın

3. **Uygulamayı çalıştırın:**
   - Android Studio'da Run butonuna tıklayın
   - VEYA: `npx cap run android`

4. **Screenshot alın:**
   - Emulator toolbar'da kamera ikonuna tıklayın
   - VEYA: Emulator'de Ctrl+S (Windows) veya Cmd+S (Mac)
   - Screenshot otomatik olarak kaydedilir

5. **Screenshot konumu:**
   - Windows: `C:\Users\[KullanıcıAdı]\AppData\Local\Android\Sdk\emulator\screenshots\`
   - Mac: `~/Library/Android/sdk/emulator/screenshots/`

### Yöntem 2: Gerçek Android Cihaz

1. **USB Debugging'i etkinleştirin:**
   - Telefon Ayarları → Geliştirici Seçenekleri → USB Debugging

2. **Telefonu bilgisayara bağlayın**

3. **ADB ile screenshot alın:**
   ```bash
   # Tek screenshot
   adb shell screencap -p /sdcard/screenshot.png
   adb pull /sdcard/screenshot.png
   
   # Veya direkt olarak
   adb exec-out screencap -p > screenshot.png
   ```

4. **Veya telefon üzerinden:**
   - Power + Volume Down tuşlarına basın
   - Screenshot galeriye kaydedilir

### Yöntem 3: Chrome DevTools (Web için)

1. **Uygulamayı Chrome'da açın:**
   ```
   http://localhost:5173
   ```

2. **DevTools'u açın:** F12

3. **Device Toolbar'ı açın:** Ctrl+Shift+M

4. **Cihaz seçin:**
   - iPhone 12 Pro (390 x 844)
   - Pixel 5 (393 x 851)
   - Veya özel boyut: 1080 x 1920

5. **Screenshot alın:**
   - Ctrl+Shift+P → "Capture screenshot"
   - VEYA: DevTools → ⋮ menü → "Capture screenshot"

## 🎨 Screenshot Düzenleme (Opsiyonel)

### Gerekirse Düzenleyin:

1. **Kenarları temizleyin:**
   - Status bar'ı kaldırın (opsiyonel)
   - Navigation bar'ı kaldırın (opsiyonel)

2. **Çerçeve ekleyin:**
   - Canva veya Figma kullanarak telefon çerçevesi ekleyin
   - Daha profesyonel görünüm için

3. **Boyut kontrolü:**
   - 1080 x 1920 piksel olduğundan emin olun
   - Gerekirse yeniden boyutlandırın

### Ücretsiz Düzenleme Araçları:

- **Canva:** https://www.canva.com
- **Photopea:** https://www.photopea.com (online Photoshop)
- **GIMP:** https://www.gimp.org (ücretsiz)

## 📐 Boyut Kontrolü ve Optimizasyon

### Screenshot Boyutunu Kontrol Edin:

**Windows:**
- Dosyaya sağ tıklayın → Properties → Details
- Width ve Height değerlerini kontrol edin

**Mac:**
- Dosyayı seçin → Get Info
- Dimensions değerini kontrol edin

### Dosya Boyutunu Küçültün (8 MB'dan fazlaysa):

1. **Online araçlar:**
   - https://tinypng.com (PNG sıkıştırma)
   - https://compressor.io (JPEG/PNG sıkıştırma)

2. **Manuel:**
   - JPEG formatına çevirin (PNG'den daha küçük)
   - Kalite: %85-90 (görsel kaliteyi korur)

## ✅ Kontrol Listesi

Screenshot'ları yüklemeden önce:

- [ ] Minimum 2, önerilen 4-8 screenshot hazır
- [ ] Her screenshot 1080x1920 piksel (veya 1920x1080)
- [ ] PNG veya JPEG formatında
- [ ] Her dosya 8 MB'dan küçük
- [ ] Farklı ekranlardan screenshot'lar var
- [ ] Uygulamanın özelliklerini gösteriyor
- [ ] Metinler okunabilir
- [ ] Görseller net ve kaliteli

## 📤 Google Play Console'a Yükleme

1. **Main Store Listing sayfasına gidin:**
   - https://play.google.com/console/u/1/developers/4789360790412857496/app/4973869149358833768/main-store-listing

2. **"Telefon ekran görüntüleri" bölümünü bulun**

3. **"Öğe ekle" butonuna tıklayın**

4. **Screenshot'ları yükleyin:**
   - 2-8 adet screenshot seçin
   - Sıralamayı düzenleyin (ilk screenshot en önemli)

5. **Kaydedin**

## 🎯 Önerilen Screenshot Sırası

1. **Ana Ekran** (İlk görsel - en önemli)
2. **Ürün Detay**
3. **Harita**
4. **Favoriler**
5. **Profil**
6. **Fiyat Ekleme**
7. **Esnaf Dükkanı** (varsa)
8. **Bildirimler**

## 💡 İpuçları

1. **İlk screenshot en önemli:** Kullanıcılar ilk screenshot'a bakarak karar verir
2. **Farklı özellikler gösterin:** Her screenshot farklı bir özelliği vurgulamalı
3. **Metinler okunabilir olmalı:** Küçük yazılar okunamazsa screenshot'u değiştirin
4. **Güncel içerik:** Gerçek, güncel verilerle screenshot alın
5. **Tutarlılık:** Tüm screenshot'larda aynı tema/stil kullanın

## 🚀 Hızlı Başlangıç

1. Android Studio'yu açın
2. Emulator'ü başlatın
3. Uygulamayı çalıştırın
4. Her ekrandan screenshot alın (minimum 4 adet)
5. Boyutları kontrol edin (1080x1920)
6. Google Play Console'a yükleyin

Hazır olduğunuzda screenshot'ları Google Play Console'a yükleyebilirsiniz!


