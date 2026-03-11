# Mobile OAuth Checklist (Android + Supabase + Google)

Bu dokuman, Android cihazda Google login akisinin sorunsuz calismasi icin gerekli ayarlari tek yerde toplar.

## 1) Uygulama Deep Link (Android)

- `android/app/src/main/AndroidManifest.xml` dosyasinda `MainActivity` altinda OAuth callback intent-filter olmali:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.esnaftaucuz.app" />
</intent-filter>
```

- `android:launchMode="singleTask"` kalmali (callback ayni activity'ye donebilsin).

## 2) Supabase Auth Redirect URLs

Supabase Dashboard -> `Authentication` -> `URL Configuration`:

- `com.esnaftaucuz.app://auth/callback`
- `com.esnaftaucuz.app://`

Gerekirse web callback URL'lerini de koruyun (web ortami icin).

## 3) Uygulama OAuth Baslatma (Mobile)

- Native ortamda `signInWithOAuth` cagrisi `skipBrowserRedirect: true` ile baslatilmali.
- Mobilde `redirectTo` icin asagidaki adaylar denenmeli:
  - `com.esnaftaucuz.app://auth/callback`
  - `com.esnaftaucuz.app://`
- OAuth URL'si native browser ile acilmali (`@capacitor/browser`).

## 4) Callback Yakalama (App)

- `@capacitor/app` ile `appUrlOpen` dinlenmeli.
- `CapacitorApp.getLaunchUrl()` ile cold-start callback durumu da yakalanmali.
- Callback URL'sinden `code` alinip `supabase.auth.exchangeCodeForSession(code)` cagrilmali.
- Basarili oturumdan sonra URL temizlenmeli ve uygulama ana rota'ya donmeli.

## 5) Environment Variables (Zorunlu)

Kok dizinde `.env`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-or-publishable-key>
```

Not: Bu degerler eksikse uygulama fallback'e dusup `placeholder.supabase.co` benzeri DNS hatalari uretebilir.

## 6) Cihazda Hizli Test Akisi

1. USB debugging acik, cihaz `adb devices` ile `device` durumunda gorunmeli.
2. `npm run dev:android` ile uygulama cihaza deploy edilmeli.
3. Google login denenmeli:
   - Browser acilir
   - Hesap secimi tamamlanir
   - Uygulama geri acilir
   - Oturum aktif olur

## 7) Sik Sorunlar

- **Son asamada takilma:** Intent-filter veya Supabase Redirect URL eksik.
- **DNS `placeholder.supabase.co`:** `.env` icinde Supabase degiskenleri yok.
- **`unauthorized` cihaz:** Telefonda USB debugging onayi verilmemis.
- **Port cakismasi (`5173`):** Eski Vite sureclerini kapatip tekrar baslatin.

