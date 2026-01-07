# Google Play Store Görselleri Oluşturma

Bu rehber, Google Play Store için gerekli görselleri oluşturmanıza yardımcı olur.

## 🚀 Hızlı Başlangıç

### 1. HTML Şablonunu Açın

Tarayıcıda şu dosyayı açın:
```
public/generate-assets.html
```

VEYA doğrudan GitHub Pages'de:
```
https://www.esnaftaucuz.com/generate-assets.html
```

### 2. Görselleri İndirin

#### App Icon (512x512)
1. Sayfadaki kare görseli (512x512) bulun
2. Chrome DevTools kullanarak:
   - F12 tuşuna basın
   - Elements sekmesinde `#appIcon` elementini bulun
   - Sağ tıklayın → "Capture node screenshot"
   - PNG olarak kaydedin

#### Feature Graphic (1024x500)
1. Sayfadaki yatay görseli (1024x500) bulun
2. Chrome DevTools kullanarak:
   - F12 tuşuna basın
   - Elements sekmesinde `#featureGraphic` elementini bulun
   - Sağ tıklayın → "Capture node screenshot"
   - PNG olarak kaydedin

## 🛠️ Alternatif Yöntemler

### Yöntem 1: Online HTML to Image Araçları

1. **htmlcsstoimage.com** kullanın:
   - https://htmlcsstoimage.com
   - `generate-assets.html` dosyasının içeriğini kopyalayın
   - PNG olarak indirin

2. **Screenshot API** kullanın:
   - https://screenshotapi.net
   - URL'yi girin ve PNG indirin

### Yöntem 2: Manuel Ekran Görüntüsü

1. Tarayıcıda sayfayı açın
2. Zoom seviyesini %100 yapın
3. Windows'ta:
   - Shift + Win + S (Snipping Tool)
   - Görseli seçin ve kaydedin
4. Boyutları kontrol edin (512x512 ve 1024x500)

### Yöntem 3: Canva ile Düzenleme

1. Canva'da yeni tasarım oluşturun:
   - App Icon: 512x512
   - Feature Graphic: 1024x500
2. HTML'deki tasarımı referans alarak Canva'da yeniden oluşturun
3. PNG olarak indirin

## 📐 Boyut Kontrolü

İndirdiğiniz görsellerin boyutlarını kontrol edin:

### App Icon
- ✅ 512 x 512 piksel
- ✅ PNG format
- ✅ Şeffaf arka plan YOK (dolu renk)

### Feature Graphic
- ✅ 1024 x 500 piksel
- ✅ PNG veya JPG format
- ✅ Yatay format

## 🎨 Tasarım Özelleştirme

`generate-assets.html` dosyasını düzenleyerek tasarımı özelleştirebilirsiniz:

- **Renkler:** CSS'de `#16a34a` ve `#059669` renklerini değiştirin
- **Metinler:** HTML'de "esnaftaucuz" ve "En iyi fiyatları keşfet" metinlerini değiştirin
- **Logo:** Emoji yerine gerçek logo ekleyebilirsiniz

## 📤 Google Play Console'a Yükleme

1. [Main Store Listing](https://play.google.com/console/u/1/developers/4789360790412857496/app/4973869149358833768/main-store-listing) sayfasına gidin
2. **App Icon** bölümüne 512x512 PNG'yi yükleyin
3. **Feature Graphic** bölümüne 1024x500 PNG'yi yükleyin
4. **Kaydet** butonuna tıklayın

## ✅ Kontrol Listesi

- [ ] App Icon: 512x512 PNG hazır
- [ ] Feature Graphic: 1024x500 PNG hazır
- [ ] Boyutlar doğru kontrol edildi
- [ ] Google Play Console'a yüklendi

## 🐛 Sorun Giderme

### Görsel boyutu yanlış
- Chrome DevTools'da zoom seviyesini %100 yapın
- "Capture node screenshot" kullanın (manuel ekran görüntüsü değil)

### Görsel bulanık
- Tarayıcı zoom seviyesini %100 yapın
- Yüksek çözünürlüklü ekran kullanın

### PNG indirilemiyor
- Chrome DevTools → Elements → Element seç → Sağ tık → "Capture node screenshot"
- Veya online araç kullanın (htmlcsstoimage.com)

## 📚 Kaynaklar

- [Google Play Store Asset Guidelines](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Chrome DevTools Screenshot Guide](https://developer.chrome.com/docs/devtools/shortcuts/)

