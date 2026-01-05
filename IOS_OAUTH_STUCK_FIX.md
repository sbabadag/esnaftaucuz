# iOS Google OAuth Takılma Sorunu - Çözüm

## 🔴 Sorun: Google Login Supabase Sayfasında Takılıyor

OAuth akışı Supabase callback sayfasında (`https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback`) takılıyor ve uygulamaya geri dönmüyor.

## ✅ Yapılan Düzeltmeler

### 1. Supabase Callback Sayfası Algılama

`app/App.tsx` dosyasına şu özellikler eklendi:

- **Mount olduğunda kontrol:** Uygulama açıldığında mevcut URL'yi kontrol eder
- **App state değişikliği:** Uygulama foreground'a döndüğünde kontrol eder
- **Periyodik kontrol:** Her saniye kontrol eder (sayfa görünürken)
- **Deep link handler:** Deep link geldiğinde OAuth code'unu yakalar

### 2. OAuth Code Exchange

OAuth code exchange işlemi tek bir fonksiyona taşındı (`handleOAuthCode`) ve tüm kaynaklardan (deep link, current URL, app state) çağrılıyor.

## 🔧 Supabase Dashboard Yapılandırması

**KRİTİK:** Supabase Dashboard'da redirect URL'lerin doğru yapılandırıldığından emin olun!

### Adım 1: Supabase Dashboard'a Gidin

1. [Supabase Dashboard](https://app.supabase.com) → Projenizi seçin
2. **Authentication** → **URL Configuration** menüsüne gidin

### Adım 2: Redirect URLs Kontrolü

**Redirect URLs** listesinde şunlar olmalı:

```
com.esnaftaucuz.app://
com.esnaftaucuz.app://**
```

**Eğer yoksa:**
1. "Add URL" butonuna tıklayın
2. `com.esnaftaucuz.app://` ekleyin
3. "Add URL" butonuna tekrar tıklayın
4. `com.esnaftaucuz.app://**` ekleyin
5. "Save" butonuna tıklayın

### Adım 3: Site URL Kontrolü

**Site URL** alanı:
- Web için: `https://www.esnaftaucuz.com` (veya mevcut web URL'iniz)
- Mobile için: `com.esnaftaucuz.app://` **EKLEMEYİN** - Site URL web URL'i olmalı!

**ÖNEMLİ:** Site URL web URL'i olmalı, custom URL scheme değil!

## 🔍 Sorun Giderme

### 1. Console Loglarını Kontrol Edin

iOS'ta Xcode Console'da şu logları arayın:

```
🔐 Starting Google OAuth...
📱 Mobile detected, using custom URL scheme: com.esnaftaucuz.app://
🔍 Checking current URL for OAuth callback: ...
🔍 Detected Supabase callback page
🔐 Found OAuth code in current URL
✅ Code exchanged for session successfully
```

### 2. Supabase Redirect URL'leri Kontrol Edin

**Supabase Dashboard → Authentication → URL Configuration** sayfasında:

- [ ] `com.esnaftaucuz.app://` redirect URL ekli mi?
- [ ] `com.esnaftaucuz.app://**` redirect URL ekli mi?
- [ ] Site URL web URL'i mi? (custom URL scheme değil)

### 3. Google Cloud Console Kontrolü

**Google Cloud Console → APIs & Services → Credentials:**

- [ ] `https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback` ekli mi?
- [ ] `com.esnaftaucuz.app://` **EKLEMEYİN** - Google Cloud Console custom URL scheme'leri kabul etmez!

### 4. Info.plist Kontrolü

`ios/App/App/Info.plist` dosyasında `CFBundleURLTypes` olmalı:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.esnaftaucuz.app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.esnaftaucuz.app</string>
        </array>
    </dict>
</array>
```

## 🧪 Test Adımları

1. **Yeni build yapın** (Codemagic'te)
2. **Uygulamayı açın**
3. **"Google ile Giriş Yap" butonuna tıklayın**
4. **Google login sayfasında giriş yapın**
5. **Supabase callback sayfasına yönlendirileceksiniz**
6. **Uygulama otomatik olarak OAuth code'unu yakalayıp oturum oluşturmalı**

## 📋 Kontrol Listesi

- [ ] Supabase Dashboard'da `com.esnaftaucuz.app://` redirect URL ekli
- [ ] Supabase Dashboard'da `com.esnaftaucuz.app://**` redirect URL ekli
- [ ] Google Cloud Console'da Supabase callback URL ekli
- [ ] Info.plist'te URL scheme tanımlı
- [ ] Yeni build yapıldı
- [ ] Console loglarında OAuth code yakalanıyor mu?

## 🐛 Hala Çalışmıyorsa

1. **Console loglarını kontrol edin:**
   - `🔍 Checking current URL for OAuth callback:` logunu görüyor musunuz?
   - `🔍 Detected Supabase callback page` logunu görüyor musunuz?
   - `🔐 Found OAuth code in current URL` logunu görüyor musunuz?

2. **Supabase Dashboard'da redirect URL'leri tekrar kontrol edin:**
   - URL'ler tam olarak `com.esnaftaucuz.app://` ve `com.esnaftaucuz.app://**` olmalı
   - Başında/sonunda boşluk olmamalı
   - Büyük/küçük harf duyarlı

3. **Yeni build yapın ve tekrar test edin**

## 💡 Notlar

- OAuth akışı şu şekilde çalışır:
  1. Uygulama → Supabase OAuth URL'i
  2. Supabase → Google login sayfası
  3. Google → Supabase callback URL'i (`https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback`)
  4. Supabase → Uygulama (`com.esnaftaucuz.app://?code=...`)
  5. Uygulama → OAuth code'unu exchange eder ve oturum oluşturur

- Eğer adım 4'te Supabase uygulamaya yönlendirmiyorsa, redirect URL'ler yanlış yapılandırılmış demektir.

