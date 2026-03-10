# Environment Variables Template

Bu dosyayı `.env` olarak kopyalayın ve gerçek değerlerinizi girin.

## Gerekli Değişkenler

```env
# Google Maps API Key (Geocoding ve Places için gerekli)
# Anahtarınızı buradan alın: https://console.cloud.google.com/
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Supabase Yapılandırması (Gerekli)
# Bu değerleri Supabase proje ayarlarınızdan alın
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

## Opsiyonel Değişkenler

```env
# Backend API URL (Sadece ayrı bir backend'iniz varsa)
# Production için HTTPS URL kullanın
# VITE_API_URL=https://api.esnaftaucuz.com/api

# Capacitor Development Server URL (Sadece geliştirme için)
# Hot reload için yerel geliştirme sunucusu URL'si
# Format: http://YOUR_LOCAL_IP:5173
# CAPACITOR_SERVER_URL=http://192.168.1.100:5173

# Web Push (Firebase Cloud Messaging - tarayici bildirimi icin)
# Firebase Console > Project settings > Web app config
# ve Cloud Messaging > Web Push certificates bolumunden alin.
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# VITE_FIREBASE_STORAGE_BUCKET=...
# VITE_FIREBASE_MESSAGING_SENDER_ID=...
# VITE_FIREBASE_APP_ID=...
# VITE_FIREBASE_WEB_PUSH_VAPID_KEY=...
```

## Önemli Notlar

1. **Production Build**: Production build'de `.env.production` dosyası kullanılır
2. **Git**: `.env` dosyası `.gitignore`'da olduğu için Git'e commit edilmez
3. **Güvenlik**: API key'lerinizi asla Git'e commit etmeyin
4. **Development**: Development'ta fallback key kullanılabilir (sadece localhost için)

## Production Build İçin

Production build için `.env.production` dosyası oluşturun:

```env
VITE_GOOGLE_MAPS_API_KEY=your-production-api-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_API_URL=https://api.esnaftaucuz.com/api
```

Build komutu:
```bash
npm run build
```
