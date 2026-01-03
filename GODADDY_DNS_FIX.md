# 🔧 GoDaddy DNS Düzeltme - Acil

## ✅ İyi Haber

CNAME kaydı doğru görünüyor:
- **Name:** `www`
- **Value:** `sbabadag.github.io.` ✅

## ❌ Sorun

Root domain (`@`) için **çakışma** var:
- 4 adet A kaydı (GitHub Pages IP'leri) ✅
- 1 adet A kaydı ("WebsiteBuilder Site") ❌

Bu çakışma DNS çözümlemesini bozuyor.

## 🔧 Çözüm: "WebsiteBuilder Site" A Kaydını Silin

### Adım 1: WebsiteBuilder Site Kaydını Bulun

GoDaddy DNS Management sayfasında:
- **Type:** A
- **Name:** `@`
- **Value:** `WebsiteBuilder Site`
- **TTL:** 1 Saat

### Adım 2: Kaydı Silin

1. Bu kaydın yanındaki **çöp kutusu ikonu** (Sil) butonuna tıklayın
2. Onaylayın
3. **Save** veya kaydetme işlemini tamamlayın

### Adım 3: Sadece GitHub Pages A Kayıtları Kalmalı

Kalan A kayıtları şöyle olmalı:

```
Type: A
Name: @
Value: 185.199.108.153
TTL: 600 saniye

Type: A
Name: @
Value: 185.199.109.153
TTL: 600 saniye

Type: A
Name: @
Value: 185.199.110.153
TTL: 600 saniye

Type: A
Name: @
Value: 185.199.111.153
TTL: 600 saniye
```

## ✅ Sonuç

DNS kayıtları şöyle olmalı:

### www.esnaftaucuz.com için:
```
Type: CNAME
Name: www
Value: sbabadag.github.io.
TTL: 1 Saat
```

### esnaftaucuz.com (root) için:
```
Type: A
Name: @
Value: 185.199.108.153 (4 adet - her IP için ayrı kayıt)
TTL: 600 saniye
```

## ⏱️ Sonraki Adımlar

1. "WebsiteBuilder Site" A kaydını silin
2. 10-15 dakika bekleyin (DNS propagation)
3. GitHub'da **Settings → Pages → "Check again"** butonuna tıklayın
4. DNS check başarılı olmalı (yeşil tik)

## 🔍 Kontrol

DNS kayıtlarını kontrol etmek için:

1. [DNS Checker](https://dnschecker.org)
2. Domain: `www.esnaftaucuz.com`
3. Type: `CNAME`
4. Sonuç: `sbabadag.github.io` görünmeli

---

**Önemli:** "WebsiteBuilder Site" kaydını silmeden DNS çözümlemesi çalışmayacak!




