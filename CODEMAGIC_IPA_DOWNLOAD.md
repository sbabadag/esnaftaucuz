# Codemagic'ten IPA Dosyası İndirme Rehberi

## 📱 IPA Dosyası Nerede?

Codemagic build tamamlandıktan sonra, IPA dosyası **Artifacts** bölümünde bulunur.

## 🚀 Adım Adım İndirme

### 1. Build Sayfasına Git

1. **Codemagic Dashboard:**
   - https://codemagic.io adresine gidin
   - **Builds** sekmesine tıklayın
   - Build'inize tıklayın (örn: `695b9a068ba2e0f9708ae279`)

### 2. Artifacts Bölümünü Bul

Build sayfasında sol panelde **"Artifacts"** bölümünü görürsünüz:

```
Artifacts:
- esnaftaucuz_2_artifacts.zip [8.97 MB]
```

### 3. Artifact'ı İndir

**Yöntem 1: ZIP Dosyası İndir (ÖNERİLEN)**
1. **Artifacts** bölümünde `.zip` dosyasına tıklayın
2. ZIP dosyası indirilecek
3. ZIP'i açın
4. İçinde `.ipa` dosyasını bulacaksınız

**Yöntem 2: Doğrudan IPA İndir**
1. Build sayfasında sağ üstte **"Download artifacts"** butonuna tıklayın
2. Veya **Artifacts** bölümünde dosya listesini genişletin
3. `.ipa` dosyasını doğrudan indirin

## 📂 IPA Dosyası Konumu

### ZIP İçinde
```
esnaftaucuz_2_artifacts.zip
  └── build/
      └── ios/
          └── ipa/
              └── esnaftaucuz.ipa  ← Bu dosya
```

### Doğrudan Artifact
Bazen IPA dosyası doğrudan artifacts listesinde görünebilir:
```
Artifacts:
- esnaftaucuz.ipa [X MB]
```

## 🔍 IPA Dosyası Bulunamıyorsa

### 1. Build Durumunu Kontrol Et

**Build başarılı mı?**
- Status: `publishing` veya `success` olmalı
- Eğer `failed` ise, build başarısız olmuştur

### 2. Artifacts Bölümünü Kontrol Et

**Artifacts görünmüyor mu?**
- Build tamamlanmasını bekleyin
- Sayfayı yenileyin (F5)
- **"Download artifacts"** butonuna tıklayın

### 3. Build Loglarını Kontrol Et

**IPA oluşturuldu mu?**
1. Build sayfasında **"Build ipa for distribution"** adımına tıklayın
2. Logları kontrol edin
3. `ipa` veya `archive` kelimelerini arayın

### 4. Yapılandırmayı Kontrol Et

`codemagic.yaml` dosyasında `artifacts` bölümü doğru mu?

```yaml
artifacts:
  - build/ios/ipa/*.ipa  # IPA dosyası burada
  - $CM_BUILD_DIR/build/*.xcarchive
```

## 💡 İpuçları

### 1. Hızlı Erişim
- Build sayfasında **"Download artifacts"** butonuna tıklayın
- Tüm artifacts tek seferde indirilir

### 2. Email Bildirimi
`codemagic.yaml` dosyasında email bildirimi aktifse:
- Build tamamlanınca email alırsınız
- Email'de artifact link'i olabilir

### 3. Build ID ile Erişim
Build ID'sini biliyorsanız:
```
https://codemagic.io/app/[APP_ID]/build/[BUILD_ID]
```

## 📱 IPA Dosyasını İndirdikten Sonra

### 1. ZIP'i Aç
- Windows'ta ZIP'i sağ tık → **Extract All**
- `.ipa` dosyasını bulun

### 2. Sideloadly ile Yükle
1. Sideloadly'yi açın
2. iPhone'u USB ile bağlayın
3. IPA File → İndirdiğiniz `.ipa` dosyasını seçin
4. Start butonuna tıklayın

## 🎯 Hızlı Kontrol Listesi

- [ ] Build durumu: `publishing` veya `success`
- [ ] Artifacts bölümü görünüyor
- [ ] ZIP dosyası veya IPA dosyası listede
- [ ] İndirme butonuna tıklandı
- [ ] ZIP açıldı ve IPA bulundu

## 🔗 Faydalı Linkler

- [Codemagic Artifacts Docs](https://docs.codemagic.io/building/artifacts/)
- [Sideloadly](https://sideloadly.io)

## ✅ Özet

**IPA dosyası nerede?**
- ✅ Codemagic → Build → **Artifacts** bölümünde
- ✅ ZIP dosyası içinde: `build/ios/ipa/*.ipa`
- ✅ Veya doğrudan artifacts listesinde

**Nasıl indirilir?**
1. Build sayfasında **Artifacts** bölümüne git
2. ZIP dosyasına tıkla veya **"Download artifacts"** butonuna tıkla
3. ZIP'i aç ve `.ipa` dosyasını bul

IPA dosyasını buldunuz mu? Sorun olursa haber verin! 🚀

