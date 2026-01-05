# Google Cloud Console iOS OAuth Yapılandırması

## ⚠️ ÖNEMLİ: Google Cloud Console Custom URL Scheme Kabul Etmez!

Google Cloud Console'da **custom URL scheme'ler** (`com.esnaftaucuz.app://`) eklenemez. Google Cloud Console sadece `http://` veya `https://` scheme'lerini kabul eder.

## ✅ Doğru Yapılandırma

### Google Cloud Console

**Authorized redirect URIs:**
- ✅ `https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback` (Zaten ekli)
- ❌ `com.esnaftaucuz.app://` **EKLEMEYİN** - Hata verecektir!

**Neden?**
- Google Cloud Console custom URL scheme'leri desteklemez
- Supabase, OAuth callback'i alır ve kendi redirect URL'lerine yönlendirir
- Supabase'de iOS redirect URL'i yapılandırılmalı

### Supabase Dashboard

**Authentication → URL Configuration:**
- **Site URL:** Mevcut web URL'inizi koruyun (örn: `https://www.esnaftaucuz.com`)
- **Redirect URLs** listesine ekleyin:
  - ✅ `com.esnaftaucuz.app://` (iOS için)
  - ✅ `com.esnaftaucuz.app://**` (iOS için)

## 🔄 OAuth Akışı

1. **Kullanıcı Google Login'e tıklar**
2. **Uygulama Supabase'e OAuth isteği gönderir**
3. **Supabase Google'a yönlendirir** (Google Cloud Console callback URL'i kullanır)
4. **Google kullanıcıyı doğrular**
5. **Google, Supabase callback URL'ine yönlendirir** (`https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback`)
6. **Supabase, iOS uygulamasına yönlendirir** (`com.esnaftaucuz.app://`)
7. **iOS uygulaması deep link'i yakalar ve oturum oluşturur**

## 📋 Yapılandırma Kontrol Listesi

### Google Cloud Console
- [x] `https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback` ekli
- [ ] `com.esnaftaucuz.app://` **EKLEMEYİN** (Hata verecektir!)

### Supabase Dashboard
- [ ] `com.esnaftaucuz.app://` redirect URL eklendi
- [ ] `com.esnaftaucuz.app://**` redirect URL eklendi

## 🐛 Hata: "Invalid Redirect: must use either http or https as the scheme"

**Sorun:** Google Cloud Console'da `com.esnaftaucuz.app://` eklemeye çalışıyorsunuz.

**Çözüm:** 
1. Google Cloud Console'da `com.esnaftaucuz.app://` URI'sini **SİLİN**
2. Sadece Supabase callback URL'ini tutun: `https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback`
3. Supabase Dashboard'da `com.esnaftaucuz.app://` redirect URL'ini ekleyin

## ✅ Doğru Yapılandırma Özeti

**Google Cloud Console:**
```
Authorized redirect URIs:
- https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback
```

**Supabase Dashboard:**
```
Redirect URLs:
- https://www.esnaftaucuz.com/**
- com.esnaftaucuz.app://
- com.esnaftaucuz.app://**
```

## 💡 Neden Bu Şekilde?

1. **Google Cloud Console:** Sadece web URL'leri (`http://`, `https://`) kabul eder
2. **Supabase:** OAuth callback'i alır ve hem web hem de mobile redirect URL'lerine yönlendirebilir
3. **iOS:** Custom URL scheme (`com.esnaftaucuz.app://`) ile deep link'i yakalar

## 🔗 Faydalı Linkler

- [Supabase OAuth Redirect URLs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [iOS URL Schemes](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)

## ✅ Sonraki Adımlar

1. **Google Cloud Console'da:**
   - `com.esnaftaucuz.app://` URI'sini silin (eğer eklediyseniz)
   - Sadece Supabase callback URL'ini tutun

2. **Supabase Dashboard'da:**
   - `com.esnaftaucuz.app://` redirect URL'ini ekleyin
   - `com.esnaftaucuz.app://**` redirect URL'ini ekleyin

3. **Test:**
   - Yeni build yapın
   - Google login'i test edin

