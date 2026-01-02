# OAuth Redirect URL Yapılandırması

## 📋 Gereksinimler

Google OAuth'un çalışması için hem **Supabase** hem de **Google Cloud Console**'da redirect URL'lerin doğru yapılandırılması gerekiyor.

## 🔧 Development (localhost:5173)

### Supabase Dashboard
1. Supabase Dashboard → Authentication → URL Configuration
2. **Site URL:** `http://localhost:5173`
3. **Redirect URLs** listesine ekleyin:
   - `http://localhost:5173/`
   - `http://localhost:5173/**`

### Google Cloud Console
1. Google Cloud Console → APIs & Services → Credentials
2. OAuth 2.0 Client ID'nizi seçin
3. **Authorized redirect URIs** listesine ekleyin:
   ```
   https://[YOUR_SUPABASE_PROJECT].supabase.co/auth/v1/callback
   ```
   ⚠️ **ÖNEMLİ:** Google Cloud Console'da Supabase'in callback URL'sini eklemeniz yeterli. Supabase, kendi redirect URL'lerini yönetir.

## 🌐 Production (www.esnaftaucuz.com)

### Supabase Dashboard
1. Supabase Dashboard → Authentication → URL Configuration
2. **Site URL:** `https://www.esnaftaucuz.com`
3. **Redirect URLs** listesine ekleyin:
   - `https://www.esnaftaucuz.com/`
   - `https://www.esnaftaucuz.com/**`

### Google Cloud Console
- **Ek bir işlem gerekmez!** 
- Supabase callback URL'i zaten ekli olduğu için production domain'i otomatik olarak çalışır.

## 📱 Mobile (com.esnaftaucuz.app://)

### Supabase Dashboard
1. **Redirect URLs** listesine ekleyin:
   - `com.esnaftaucuz.app://`

### Google Cloud Console
1. **Authorized redirect URIs** listesine ekleyin:
   ```
   com.esnaftaucuz.app://
   ```

## ✅ Kontrol Listesi

- [ ] Supabase Site URL: `http://localhost:5173` (development)
- [ ] Supabase Site URL: `https://www.esnaftaucuz.com` (production)
- [ ] Supabase Redirect URLs: `http://localhost:5173/**` (development)
- [ ] Supabase Redirect URLs: `https://www.esnaftaucuz.com/**` (production)
- [ ] Supabase Redirect URLs: `com.esnaftaucuz.app://` (mobile)
- [ ] Google Cloud Console: Supabase callback URL eklendi
- [ ] Google Cloud Console: `com.esnaftaucuz.app://` eklendi (mobile için)

## 🔍 Test

### Development (localhost:5173)
```bash
npm run dev
```
Tarayıcıda `http://localhost:5173` açın ve Google login'i test edin.

### Production
1. GitHub Pages'de deploy edilmiş siteyi açın: `https://www.esnaftaucuz.com`
2. Google login'i test edin.

### Mobile
1. Android/iOS uygulamasını build edin
2. Google login'i test edin.

## 🐛 Sorun Giderme

### "redirect_uri_mismatch" Hatası
- Google Cloud Console'da Supabase callback URL'inin doğru eklendiğinden emin olun
- URL'lerin tam olarak eşleştiğinden emin olun (trailing slash, http vs https)

### Development'ta Çalışmıyor
- Supabase Dashboard'da Site URL'in `http://localhost:5173` olduğundan emin olun
- Redirect URLs listesinde `http://localhost:5173/**` olduğundan emin olun

### Production'da Çalışmıyor
- Supabase Dashboard'da Site URL'in `https://www.esnaftaucuz.com` olduğundan emin olun
- Redirect URLs listesinde `https://www.esnaftaucuz.com/**` olduğundan emin olun
- HTTPS kullanıldığından emin olun (GitHub Pages otomatik sağlar)



