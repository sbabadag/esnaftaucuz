# Codemagic'te Environment Variables Ekleme - Adım Adım Kılavuz

## 🔴 Sorun: Build Loglarında "NO ❌" Görünüyor

Build loglarınızda şunu görüyorsunuz:
```
VITE_SUPABASE_URL is set: NO ❌
VITE_SUPABASE_ANON_KEY is set: NO ❌
```

Bu, environment variable'ların Codemagic'te eklenmediği anlamına gelir.

## ✅ Çözüm: Environment Variables Ekleyin

### Adım 1: Codemagic Dashboard'a Gidin

1. [Codemagic Dashboard](https://codemagic.io/apps) açın
2. Giriş yapın
3. Projenizi seçin (esnaftaucuz)

### Adım 2: Settings Sekmesine Gidin

1. Sol menüden **"Applications"** tıklayın
2. Projenizi bulun ve tıklayın
3. Üst menüden **"Settings"** sekmesine tıklayın
4. Sol menüden **"Environment variables"** sekmesine tıklayın

### Adım 3: İlk Environment Variable'ı Ekleyin (VITE_SUPABASE_URL)

1. **"+ Add variable"** veya **"Add variable"** butonuna tıklayın
2. **Variable name:** `VITE_SUPABASE_URL` yazın (tam olarak bu şekilde)
3. **Variable value:** `https://xmskjcdwmwlcmjexnnxw.supabase.co` yazın
4. **Secure/Encrypted:** ✅ İşaretleyin (checkbox'ı işaretleyin)
5. **Save** veya **Add** butonuna tıklayın

### Adım 4: İkinci Environment Variable'ı Ekleyin (VITE_SUPABASE_ANON_KEY)

1. Tekrar **"+ Add variable"** butonuna tıklayın
2. **Variable name:** `VITE_SUPABASE_ANON_KEY` yazın (tam olarak bu şekilde)
3. **Variable value:** Supabase anon key'inizi yapıştırın
   - Supabase Dashboard → Settings → API → anon/public key
   - Çok uzun bir string olacak (200+ karakter)
   - `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` gibi görünür
4. **Secure/Encrypted:** ✅ İşaretleyin (checkbox'ı işaretleyin)
5. **Save** veya **Add** butonuna tıklayın

### Adım 5: Supabase Anon Key'i Nasıl Bulunur?

1. [Supabase Dashboard](https://app.supabase.com) açın
2. Projenizi seçin
3. Sol menüden **"Settings"** (⚙️) tıklayın
4. **"API"** sekmesine tıklayın
5. **"Project URL"** altında:
   - **anon/public key** değerini kopyalayın
   - Bu çok uzun bir string (200+ karakter)
   - Tüm key'i kopyalayın (baştan sona)

### Adım 6: Environment Variables Kontrol Edin

Settings → Environment variables sayfasında şunları görmelisiniz:

| Variable Name | Secure | Value Preview |
|--------------|--------|---------------|
| `VITE_SUPABASE_URL` | ✅ Yes | `https://xmskjcdwmwlcmjexnnxw...` |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | `eyJhbGciOiJIUzI1NiIs...` |

### Adım 7: Yeni Build Başlatın

1. Codemagic Dashboard → **"Builds"** sekmesine gidin
2. **"Start new build"** veya **"Build"** butonuna tıklayın
3. Branch: **main** seçin
4. **"Start build"** butonuna tıklayın

### Adım 8: Build Loglarını Kontrol Edin

Build başladıktan sonra, **"Build web"** adımının loglarında şunları görmelisiniz:

```
🔍 Checking environment variables...
VITE_SUPABASE_URL is set: YES ✅
VITE_SUPABASE_ANON_KEY is set: YES ✅
✅ Environment variables are set, starting build...
VITE_SUPABASE_URL: https://xmskjcdwmwlcmjexnnxw...
VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIs...
```

## ⚠️ ÖNEMLİ: Variable İsimleri

Variable isimleri **tam olarak** şöyle olmalı:
- ✅ `VITE_SUPABASE_URL` (doğru)
- ✅ `VITE_SUPABASE_ANON_KEY` (doğru)

**YANLIŞ ÖRNEKLER:**
- ❌ `SUPABASE_URL` (VITE_ prefix eksik)
- ❌ `vite_supabase_url` (küçük harf)
- ❌ `VITE_SUPABASE_URL_` (trailing underscore)
- ❌ `VITE_SUPABASE_URL ` (trailing space)

## ⚠️ ÖNEMLİ: Variable Değerleri

### VITE_SUPABASE_URL
- ✅ `https://xmskjcdwmwlcmjexnnxw.supabase.co` (doğru)
- ❌ `https://xmskjcdwmwlcmjexnnxw.supabase.co/` (trailing slash)
- ❌ `http://xmskjcdwmwlcmjexnnxw.supabase.co` (http yerine https)
- ❌ ` xmskjcdwmwlcmjexnnxw.supabase.co` (leading space)

### VITE_SUPABASE_ANON_KEY
- ✅ Tüm key'i kopyalayın (200+ karakter)
- ❌ Key'in sadece bir kısmını kopyalamayın
- ❌ Boşluk veya satır sonu eklemeyin

## 🐛 Sorun Giderme

### "Variable zaten var ama hala NO ❌ görünüyor"

**Çözüm:**
1. Variable'ı silin
2. Yeniden ekleyin (isim ve değer tam olarak doğru olmalı)
3. Yeni build başlatın

### "Variable ekledim ama build hala başarısız"

**Kontrol:**
1. Variable isimlerinin tam olarak doğru olduğundan emin olun
2. Variable değerlerinin doğru olduğundan emin olun
3. **Secure/Encrypted** checkbox'ının işaretli olduğundan emin olun
4. Yeni build başlatın (eski build'ler cached olabilir)

### "Supabase anon key'i bulamıyorum"

**Adımlar:**
1. [Supabase Dashboard](https://app.supabase.com) → Projenizi seçin
2. Sol menüden **Settings** (⚙️) tıklayın
3. **API** sekmesine tıklayın
4. **Project API keys** bölümünde:
   - **anon/public** key'i kopyalayın
   - Bu çok uzun bir string (200+ karakter)
   - `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ile başlar

## 📋 Kontrol Listesi

- [ ] Codemagic Dashboard'a giriş yaptım
- [ ] Settings → Environment variables sekmesine gittim
- [ ] `VITE_SUPABASE_URL` variable'ını ekledim (encrypted)
- [ ] `VITE_SUPABASE_ANON_KEY` variable'ını ekledim (encrypted)
- [ ] Variable isimleri tam olarak doğru
- [ ] Variable değerleri doğru (URL https:// ile başlıyor, key tam)
- [ ] Yeni build başlattım
- [ ] Build loglarında `YES ✅` görünüyor
- [ ] Build başarılı

## ✅ Başarı Kriterleri

Build başarılı olduğunda:
- ✅ Build loglarında `VITE_SUPABASE_URL is set: YES ✅` görünmeli
- ✅ Build loglarında `VITE_SUPABASE_ANON_KEY is set: YES ✅` görünmeli
- ✅ Build başarılı olmalı
- ✅ IPA dosyası oluşturulmalı
- ✅ IPA dosyasında placeholder URL olmamalı

## 🔗 Faydalı Linkler

- [Codemagic Environment Variables Docs](https://docs.codemagic.io/yaml/environment-variables/)
- [Supabase Dashboard](https://app.supabase.com)
- [Supabase API Settings](https://app.supabase.com/project/_/settings/api)

