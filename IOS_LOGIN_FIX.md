# iOS Login Sorunları ve Çözümler

## 🔴 Sorun: iOS'ta Email ve Google Login Çalışmıyor

## ✅ Yapılan Düzeltmeler

### 1. Info.plist'e URL Scheme Eklendi

iOS deep linking için `CFBundleURLTypes` eklendi:
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

### 2. Email Login Timeout Eklendi

iOS'ta network timeout sorunları için:
- 30 saniye timeout eklendi
- Daha iyi error handling
- Network hatalarını yakalama

### 3. Google OAuth Timeout Eklendi

iOS'ta OAuth timeout sorunları için:
- 30 saniye timeout eklendi
- Daha iyi error mesajları
- URL format düzeltmeleri

### 4. Deep Link Handler İyileştirildi

iOS'ta OAuth callback için:
- URL format düzeltmeleri
- Daha iyi logging
- Hata yakalama

## 📋 Supabase Yapılandırması

### Supabase Dashboard

1. **Authentication → URL Configuration:**
   - **Site URL:** `com.esnaftaucuz.app://` (veya mevcut web URL'inizi koruyun)
   - **Redirect URLs** listesine ekleyin:
     - `com.esnaftaucuz.app://` ✅ (iOS için gerekli)
     - `com.esnaftaucuz.app://**` ✅ (iOS için gerekli)
   
   **ÖNEMLİ:** Custom URL scheme'ler Supabase'de eklenebilir, ancak Google Cloud Console'da eklenemez. Supabase, OAuth callback'i alır ve iOS uygulamanıza yönlendirir.

### Google Cloud Console

1. **APIs & Services → Credentials:**
   - OAuth 2.0 Client ID'nizi seçin
   - **Authorized redirect URIs:**
     - `https://xmskjcdwmwlcmjexnnxw.supabase.co/auth/v1/callback` ✅ (Zaten ekli)
     - ❌ **`com.esnaftaucuz.app://` EKLEMEYİN** - Google Cloud Console custom URL scheme'leri kabul etmez!
   
   **ÖNEMLİ:** Google Cloud Console'da sadece Supabase callback URL'i olmalı. Custom URL scheme'ler Google Cloud Console'da desteklenmez. Supabase, OAuth callback'i alır ve kendi redirect URL'lerine yönlendirir.

## 🔧 Test Adımları

### 1. Email Login Test

1. Uygulamayı açın
2. Email ve şifre girin
3. "Giriş Yap" butonuna tıklayın
4. Console loglarını kontrol edin:
   - `🔐 Starting email login...`
   - `✅ Login successful, fetching profile...`

### 2. Google Login Test

1. Uygulamayı açın
2. "Google ile Giriş Yap" butonuna tıklayın
3. Google login sayfası açılmalı
4. Giriş yaptıktan sonra uygulamaya geri dönmeli
5. Console loglarını kontrol edin:
   - `🔐 Starting Google OAuth...`
   - `📱 iOS detected, using custom URL scheme:`
   - `🔗 App opened with URL:`

## 🐛 Sorun Giderme

### Email Login Çalışmıyor

**Kontrol Listesi:**
- [ ] Internet bağlantısı var mı?
- [ ] Supabase URL ve key doğru mu?
- [ ] Console'da hata var mı?
- [ ] Timeout mesajı alıyor musunuz?

**Çözümler:**
1. Internet bağlantınızı kontrol edin
2. Console loglarını kontrol edin
3. Supabase dashboard'da authentication ayarlarını kontrol edin

### Google Login Çalışmıyor

**Kontrol Listesi:**
- [ ] Info.plist'te URL scheme var mı?
- [ ] Supabase'de redirect URL ekli mi?
- [ ] Google Cloud Console'da redirect URI ekli mi?
- [ ] Console'da OAuth hataları var mı?

**Çözümler:**
1. Info.plist'i kontrol edin (URL scheme ekli olmalı)
2. Supabase dashboard'da redirect URL'leri kontrol edin
3. Google Cloud Console'da redirect URI'leri kontrol edin
4. Console loglarını kontrol edin

### Deep Link Çalışmıyor

**Kontrol Listesi:**
- [ ] Info.plist'te `CFBundleURLTypes` var mı?
- [ ] URL scheme doğru mu? (`com.esnaftaucuz.app`)
- [ ] AppDelegate'te URL handling var mı?

**Çözümler:**
1. Info.plist'i kontrol edin
2. Xcode'da URL scheme'i kontrol edin
3. AppDelegate.swift'i kontrol edin

## 📱 iOS Yapılandırma Kontrol Listesi

- [x] Info.plist'te URL scheme eklendi
- [x] Email login timeout eklendi
- [x] Google OAuth timeout eklendi
- [x] Deep link handler iyileştirildi
- [ ] Supabase redirect URL eklendi
- [ ] Google Cloud Console redirect URI eklendi

## 🔗 Faydalı Linkler

- [Supabase iOS Auth](https://supabase.com/docs/guides/auth/native-mobile)
- [Capacitor Deep Links](https://capacitorjs.com/docs/guides/deep-links)
- [iOS URL Schemes](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)

## ✅ Sonraki Adımlar

1. **Yeni Build:**
   - Codemagic'te yeni build başlatın
   - IPA dosyasını indirin
   - Sideloadly ile yükleyin

2. **Supabase Yapılandırması:**
   - Supabase dashboard'da redirect URL ekleyin
   - Google Cloud Console'da redirect URI ekleyin

3. **Test:**
   - Email login test edin
   - Google login test edin
   - Console loglarını kontrol edin

## 💡 Notlar

- iOS'ta OAuth için URL scheme **mutlaka** gerekli
- Supabase ve Google Cloud Console'da redirect URL'ler **eşleşmeli**
- Network timeout'lar iOS'ta daha sık görülür, bu yüzden timeout'lar eklendi

