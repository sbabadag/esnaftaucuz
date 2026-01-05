# Codemagic Environment Variables Yapılandırması

## 🔴 Sorun: iOS Build'de `https://placeholder.supabase.co` Hatası

iOS build'de Supabase environment variable'ları yüklenmiyor, bu yüzden placeholder client oluşturuluyor.

## ✅ Çözüm: Codemagic'te Environment Variables Ekleyin

### 1. Codemagic Dashboard'a Gidin

1. [Codemagic Dashboard](https://codemagic.io/apps) → Projenizi seçin
2. **Settings** → **Environment variables** sekmesine gidin

### 2. Environment Variables Ekleyin

Aşağıdaki environment variable'ları **encrypted** olarak ekleyin:

#### VITE_SUPABASE_URL
- **Name:** `VITE_SUPABASE_URL`
- **Value:** `https://xmskjcdwmwlcmjexnnxw.supabase.co` (Supabase projenizin URL'i)
- **Group:** (Boş bırakabilirsiniz)
- **Secure:** ✅ **Encrypted** olarak işaretleyin

#### VITE_SUPABASE_ANON_KEY
- **Name:** `VITE_SUPABASE_ANON_KEY`
- **Value:** Supabase projenizin anon key'i (Supabase Dashboard → Settings → API)
- **Group:** (Boş bırakabilirsiniz)
- **Secure:** ✅ **Encrypted** olarak işaretleyin

### 3. Environment Variables Nasıl Bulunur?

#### Supabase Dashboard'dan:

1. [Supabase Dashboard](https://app.supabase.com) → Projenizi seçin
2. **Settings** → **API** sekmesine gidin
3. **Project URL:** `VITE_SUPABASE_URL` için kullanın
4. **anon/public key:** `VITE_SUPABASE_ANON_KEY` için kullanın

### 4. Codemagic'te Environment Variables Ekleme Adımları

1. **Codemagic Dashboard** → Projenizi seçin
2. **Settings** → **Environment variables** sekmesine gidin
3. **Add variable** butonuna tıklayın
4. **Name:** `VITE_SUPABASE_URL`
5. **Value:** `https://xmskjcdwmwlcmjexnnxw.supabase.co`
6. **Secure:** ✅ İşaretleyin (encrypted)
7. **Save** butonuna tıklayın
8. Aynı adımları `VITE_SUPABASE_ANON_KEY` için tekrarlayın

### 5. Build'i Test Edin

1. Codemagic'te yeni build başlatın
2. Build loglarını kontrol edin:
   - `VITE_SUPABASE_URL is set: YES` görünmeli
   - `VITE_SUPABASE_ANON_KEY is set: YES` görünmeli
3. Build başarılı olmalı
4. IPA dosyasını indirin ve test edin

## 🔍 Kontrol Listesi

- [ ] Codemagic Dashboard'a giriş yaptınız
- [ ] Settings → Environment variables sekmesine gittiniz
- [ ] `VITE_SUPABASE_URL` eklediniz (encrypted)
- [ ] `VITE_SUPABASE_ANON_KEY` eklediniz (encrypted)
- [ ] Yeni build başlattınız
- [ ] Build loglarında environment variable'lar görünüyor
- [ ] iOS build'de Google login çalışıyor

## 🐛 Sorun Giderme

### Environment Variables Görünmüyor

**Kontrol:**
- Codemagic Dashboard → Settings → Environment variables
- Variable'ların **encrypted** olarak işaretlendiğinden emin olun
- Variable isimlerinin tam olarak `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` olduğundan emin olun

### Build'de Hala Placeholder URL Görünüyor

**Kontrol:**
- Build loglarında `VITE_SUPABASE_URL is set: YES` görünüyor mu?
- Environment variable'ların doğru projeye eklendiğinden emin olun
- Yeni build başlatın (eski build'ler cached olabilir)

### Google Login Hala Çalışmıyor

**Kontrol:**
- Supabase Dashboard → Authentication → URL Configuration
- `com.esnaftaucuz.app://` redirect URL'i ekli mi?
- Google Cloud Console'da Supabase callback URL'i ekli mi?

## 📋 Environment Variables Özeti

| Variable Name | Value | Secure | Açıklama |
|--------------|-------|--------|----------|
| `VITE_SUPABASE_URL` | `https://xmskjcdwmwlcmjexnnxw.supabase.co` | ✅ Yes | Supabase proje URL'i |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | ✅ Yes | Supabase anon key |

## ✅ Sonraki Adımlar

1. **Codemagic'te Environment Variables Ekleyin:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. **Yeni Build Başlatın:**
   - Codemagic'te yeni build başlatın
   - Build loglarını kontrol edin

3. **Test Edin:**
   - IPA dosyasını indirin
   - Sideloadly ile iPhone'a yükleyin
   - Google login'i test edin

## 💡 Notlar

- Environment variable'lar **encrypted** olarak saklanmalı
- Variable isimleri **tam olarak** `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` olmalı
- Build loglarında environment variable'ların set edildiğini kontrol edin
- Yeni build başlatmadan önce environment variable'ların eklendiğinden emin olun

## 🔗 Faydalı Linkler

- [Codemagic Environment Variables](https://docs.codemagic.io/yaml/environment-variables/)
- [Supabase Dashboard](https://app.supabase.com)
- [Supabase API Settings](https://app.supabase.com/project/_/settings/api)

