# Codemagic Environment Variables Hızlı Çözüm

## 🔴 Sorun: Hala Placeholder URL Görünüyor

Eğer Codemagic'te environment variable'ları eklediyseniz ama hala `https://placeholder.supabase.co` görünüyorsa, aşağıdaki adımları izleyin:

## ✅ Hızlı Çözüm Adımları

### 1. Codemagic Dashboard'da Kontrol Edin

1. [Codemagic Dashboard](https://codemagic.io/apps) → Projenizi seçin
2. **Settings** → **Environment variables** sekmesine gidin
3. Aşağıdaki variable'ların **tam olarak** eklendiğinden emin olun:
   - `VITE_SUPABASE_URL` (encrypted)
   - `VITE_SUPABASE_ANON_KEY` (encrypted)

### 2. Variable İsimlerini Kontrol Edin

**ÖNEMLİ:** Variable isimleri **tam olarak** şöyle olmalı:
- ✅ `VITE_SUPABASE_URL` (doğru)
- ❌ `SUPABASE_URL` (yanlış - VITE_ prefix eksik)
- ❌ `vite_supabase_url` (yanlış - küçük harf)
- ❌ `VITE_SUPABASE_URL_` (yanlış - trailing underscore)

### 3. Variable Değerlerini Kontrol Edin

#### VITE_SUPABASE_URL
- **Değer:** `https://xmskjcdwmwlcmjexnnxw.supabase.co`
- **ÖNEMLİ:** 
  - `https://` ile başlamalı
  - Trailing slash (`/`) olmamalı
  - Boşluk olmamalı

#### VITE_SUPABASE_ANON_KEY
- **Değer:** Supabase anon key (uzun bir string, `eyJhbGc...` ile başlar)
- **ÖNEMLİ:**
  - Tüm key'i kopyalayın (çok uzun olabilir)
  - Boşluk olmamalı
  - Satır sonu olmamalı

### 4. Build Loglarını Kontrol Edin

Yeni build başlattığınızda, build loglarında şunları görmelisiniz:

```
🔍 Checking environment variables...
VITE_SUPABASE_URL is set: YES ✅
VITE_SUPABASE_ANON_KEY is set: YES ✅
✅ Environment variables are set, starting build...
VITE_SUPABASE_URL: https://xmskjcdwmwlcmjexnnxw...
VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIs...
```

Eğer `NO ❌` görüyorsanız, environment variable'lar eklenmemiş demektir.

### 5. Build'i Yeniden Başlatın

1. Codemagic'te **yeni build başlatın**
2. Build loglarını kontrol edin
3. Environment variable'ların set edildiğini doğrulayın

## 🐛 Sorun Giderme

### "VITE_SUPABASE_URL is set: NO ❌"

**Çözüm:**
1. Codemagic Dashboard → Settings → Environment variables
2. `VITE_SUPABASE_URL` variable'ının var olduğundan emin olun
3. Variable isminin tam olarak `VITE_SUPABASE_URL` olduğundan emin olun
4. Variable'ın **encrypted** olarak işaretlendiğinden emin olun
5. Yeni build başlatın

### "Build output still contains placeholder URL!"

**Çözüm:**
1. Environment variable'ların build sırasında set edildiğini kontrol edin
2. Build loglarında `VITE_SUPABASE_URL is set: YES ✅` görünmeli
3. Eğer görünmüyorsa, variable'ları silip yeniden ekleyin
4. Yeni build başlatın

### "ERROR: Environment variables are missing!"

**Çözüm:**
1. Codemagic Dashboard → Settings → Environment variables
2. Her iki variable'ı da eklediğinizden emin olun
3. Variable isimlerinin doğru olduğundan emin olun
4. Yeni build başlatın

## 📋 Kontrol Listesi

- [ ] Codemagic Dashboard'a giriş yaptınız
- [ ] Settings → Environment variables sekmesine gittiniz
- [ ] `VITE_SUPABASE_URL` variable'ı var (encrypted)
- [ ] `VITE_SUPABASE_ANON_KEY` variable'ı var (encrypted)
- [ ] Variable isimleri tam olarak doğru (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Variable değerleri doğru (URL `https://` ile başlıyor, key tam)
- [ ] Yeni build başlattınız
- [ ] Build loglarında `YES ✅` görünüyor
- [ ] Build başarılı
- [ ] IPA dosyasında placeholder URL yok

## 🔍 Supabase Anon Key Nasıl Bulunur?

1. [Supabase Dashboard](https://app.supabase.com) → Projenizi seçin
2. **Settings** → **API** sekmesine gidin
3. **Project URL:** `VITE_SUPABASE_URL` için kullanın
4. **anon/public key:** `VITE_SUPABASE_ANON_KEY` için kullanın
   - Key çok uzun olabilir (200+ karakter)
   - Tüm key'i kopyalayın
   - `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` gibi görünür

## ✅ Sonraki Adımlar

1. **Codemagic'te Environment Variables Kontrol Edin:**
   - Variable isimlerinin doğru olduğundan emin olun
   - Variable değerlerinin doğru olduğundan emin olun

2. **Yeni Build Başlatın:**
   - Codemagic'te yeni build başlatın
   - Build loglarını kontrol edin

3. **Test Edin:**
   - IPA dosyasını indirin
   - Sideloadly ile iPhone'a yükleyin
   - Google login'i test edin
   - Console loglarında `✅ Supabase client initialized` görünmeli

## 💡 İpuçları

- Environment variable'lar **case-sensitive** (büyük/küçük harf duyarlı)
- Variable isimlerinde **boşluk** olmamalı
- Variable değerlerinde **trailing slash** olmamalı
- Build loglarını **her zaman** kontrol edin
- Eğer hala çalışmıyorsa, variable'ları **silip yeniden ekleyin**

