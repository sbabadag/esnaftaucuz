# Esnaf aboneliği — Google Play’de takılma / “Processing”

Uygulama artık yerel **`GooglePlayBilling`** eklentisi ile [Play Billing Library 7](https://developer.android.com/google/play/billing) kullanıyor. Aşağıdakiler hâlâ Google tarafında yapılandırma gerektirir.

## 1) Play Console’da abonelik

- **Ürün kimlikleri** kodla aynı olmalı (varsayılan: `merchant_basic_monthly`, `merchant_basic_yearly`).
- Abonelik **yayında** olmalı; en az bir **base plan** + **teklif (offer)** tanımlı olmalı.
- İsterseniz `.env` ile değiştirin: `VITE_GOOGLE_PLAY_SUBS_PRODUCT_ID_MONTHLY`, `VITE_GOOGLE_PLAY_SUBS_PRODUCT_ID_YEARLY`.

## 2) Uygulama paketi

- `applicationId` = **`com.esnaftaucuz.app`** Play’deki uygulama ile aynı olmalı.
- **USB ile yüklenen debug APK** bazen ödemeyi tamamlamaz veya “Processing”de kalır. Güvenilir test:
  - **Dahili test / kapalı test** kanalına yüklenmiş sürümü Play’den indirin, veya
  - Aynı imza + Play’e yüklenmiş bir sürümle test edin.

## 3) Test hesabı

- Play Console → **Ayarlar** → **Lisans testi**: Gmail hesabınızı ekleyin.
- Emülatörde **Google Play Store yüklü** sistem görüntüsü kullanın; cihazda Play’e giriş yapılmış olsun.

## 4) Sunucu (Supabase)

- `merchant-subscription-google-confirm` edge function ortamında `GOOGLE_PLAY_PACKAGE_NAME`, servis hesabı ve ürün ID env’leri tanımlı olmalı (`supabase/functions/merchant-subscription-google-confirm/index.ts`).

## 5) Hâlâ takılıyorsa

- Play Store uygulamasını güncelleyin, önbelleği temizleyin veya gerçek cihazda deneyin.
- `adb logcat` ile `BillingClient` / `GooglePlay` etiketli satırlara bakın.
