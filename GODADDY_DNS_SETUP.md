# 🔧 GoDaddy DNS Ayarları - Adım Adım Rehber

## ❌ Mevcut Sorun

GitHub Pages'de şu hata görünüyor:
> "Domain does not resolve to the GitHub Pages server"

Bu, GoDaddy'de DNS kayıtlarının henüz doğru yapılandırılmadığı anlamına gelir.

## ✅ Çözüm: GoDaddy DNS Ayarları

### Adım 1: GoDaddy'ye Giriş

1. [GoDaddy.com](https://www.godaddy.com) → **Sign In**
2. **My Products** → **All Products and Services**
3. Domain'inizi bulun: `esnaftaucuz.com`
4. **DNS** butonuna tıklayın (veya **Manage DNS**)

### Adım 2: Mevcut DNS Kayıtlarını Kontrol Etme

1. DNS Management sayfasında mevcut kayıtları görün
2. `www` için CNAME kaydı var mı kontrol edin
3. Varsa, değerini kontrol edin (yanlışsa düzeltin)
4. Yoksa, yeni kayıt ekleyin

### Adım 3: CNAME Kaydı Ekleme/Düzenleme

#### Yeni CNAME Kaydı Ekleme:

1. **Add** veya **Add Record** butonuna tıklayın
2. **Type:** `CNAME` seçin
3. **Name/Host:** `www` yazın
   - **Not:** Sadece `www` yazın, `www.esnaftaucuz.com` değil
4. **Value/Points to:** `sbabadag.github.io` yazın
   - **Not:** Sonunda `/` olmamalı, sadece `sbabadag.github.io`
5. **TTL:** `600` (veya varsayılan değer)
6. **Save** veya **Add Record** butonuna tıklayın

#### Mevcut CNAME Kaydını Düzenleme:

1. `www` için mevcut CNAME kaydını bulun
2. **Edit** (kalem ikonu) butonuna tıklayın
3. **Value/Points to:** `sbabadag.github.io` olarak güncelleyin
4. **Save** butonuna tıklayın

### Adım 4: DNS Kayıt Kontrolü

Doğru kayıt şöyle görünmeli:

```
Type: CNAME
Name: www
Value: sbabadag.github.io
TTL: 600
```

## ⏱️ DNS Propagation Süresi

DNS değişiklikleri yayılmak için zaman alır:

- **Minimum:** 5-10 dakika
- **Ortalama:** 1-2 saat
- **Maksimum:** 48 saat

## ✅ DNS Kontrolü

### Online DNS Checker Kullanma

1. [DNS Checker](https://dnschecker.org) sitesine gidin
2. Domain: `www.esnaftaucuz.com` yazın
3. Type: `CNAME` seçin
4. **Search** butonuna tıklayın
5. Sonuç: `sbabadag.github.io` görünmeli

### Terminal ile Kontrol

**Windows PowerShell:**
```powershell
nslookup www.esnaftaucuz.com
```

**Beklenen sonuç:**
```
Name:    sbabadag.github.io
Address: [GitHub Pages IP adresi]
```

## 🔄 GitHub'da DNS Kontrolü

1. Repository → **Settings** → **Pages**
2. Custom domain bölümünde **"Check again"** butonuna tıklayın
3. Birkaç dakika bekleyin
4. DNS check başarılı olmalı (yeşil tik)

## 🐛 Yaygın Hatalar

### Hata 1: "Name already exists"
- **Sebep:** `www` için zaten bir CNAME kaydı var
- **Çözüm:** Mevcut kaydı düzenleyin, yeni kayıt eklemeyin

### Hata 2: "Invalid value"
- **Sebep:** Value alanında yanlış format
- **Çözüm:** Sadece `sbabadag.github.io` yazın (http:// veya / olmadan)

### Hata 3: DNS check hala başarısız
- **Sebep:** DNS propagation henüz tamamlanmamış
- **Çözüm:** 1-2 saat bekleyin, sonra tekrar kontrol edin

### Hata 4: "Points to wrong address"
- **Sebep:** CNAME değeri yanlış
- **Çözüm:** `sbabadag.github.io` olduğundan emin olun (repository adınızla eşleşmeli)

## 📋 Kontrol Listesi

- [ ] GoDaddy'de DNS Management sayfasına gidildi
- [ ] `www` için CNAME kaydı eklendi/düzenlendi
- [ ] CNAME Value: `sbabadag.github.io` olarak ayarlandı
- [ ] DNS kaydı kaydedildi
- [ ] DNS Checker ile kontrol edildi (sonuç: `sbabadag.github.io`)
- [ ] GitHub'da "Check again" butonuna tıklandı
- [ ] DNS check başarılı oldu (yeşil tik)

## 💡 İpuçları

1. **DNS kaydını ekledikten sonra** 10-15 dakika bekleyin
2. **GitHub'da "Check again"** butonuna tıklayın
3. **DNS Checker** ile global olarak kontrol edin
4. **TTL değerini** düşük tutun (600) - daha hızlı propagation için

## 🔍 Detaylı DNS Kayıt Örneği

GoDaddy DNS Management sayfasında şöyle görünmeli:

```
┌──────────┬──────┬──────────────────────┬─────┐
│ Type     │ Name │ Value                │ TTL │
├──────────┼──────┼──────────────────────┼─────┤
│ CNAME    │ www  │ sbabadag.github.io   │ 600 │
└──────────┴──────┴──────────────────────┴─────┘
```

## 📞 Hala Sorun Varsa

1. GoDaddy Support ile iletişime geçin
2. DNS kayıtlarının doğru olduğundan emin olun
3. 24 saat bekleyin (maksimum propagation süresi)
4. GitHub Support'a başvurun

---

**Önemli:** DNS değişiklikleri anında etkili olmaz. Lütfen 1-2 saat bekleyin ve tekrar kontrol edin.








