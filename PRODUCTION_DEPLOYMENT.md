# 🚀 Production Deployment Rehberi

Bu rehber, uygulamayı Android Store'a yayınlamak için gerekli production ayarlarını açıklar.

## 📋 İçindekiler

1. [Backend Deployment](#backend-deployment)
2. [Frontend Configuration](#frontend-configuration)
3. [Environment Variables](#environment-variables)
4. [Android Build Configuration](#android-build-configuration)
5. [HTTPS Gereksinimleri](#https-gereksinimleri)
6. [Deployment Seçenekleri](#deployment-seçenekleri)

---

## 🖥️ Backend Deployment

### Seçenek 1: VPS (DigitalOcean, AWS EC2, vb.)

**Adımlar:**

1. **VPS'e bağlanın:**
   ```bash
   ssh user@your-server-ip
   ```

2. **Node.js ve npm kurulumu:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Projeyi yükleyin:**
   ```bash
   git clone https://github.com/yourusername/esnaftaucuz.git
   cd esnaftaucuz/backend
   npm install
   ```

4. **Environment variables ayarlayın:**
   ```bash
   nano .env
   ```
   
   Production `.env` içeriği:
   ```env
   NODE_ENV=production
   PORT=5000
   
   # Supabase (aynı kalabilir)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   
   # Pexels API (opsiyonel)
   PEXELS_API_KEY=your-pexels-key
   ```

5. **PM2 ile çalıştırın (process manager):**
   ```bash
   npm install -g pm2
   pm2 start server.ts --name esnaftaucuz-backend --interpreter tsx
   pm2 save
   pm2 startup
   ```

6. **Nginx reverse proxy kurulumu:**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/esnaftaucuz
   ```
   
   Nginx config:
   ```nginx
   server {
       listen 80;
       server_name api.esnaftaucuz.com;  # veya IP adresiniz
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   ```bash
   sudo ln -s /etc/nginx/sites-available/esnaftaucuz /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **SSL sertifikası (Let's Encrypt):**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.esnaftaucuz.com
   ```

### Seçenek 2: Railway / Render / Heroku

**Railway:**
1. Railway.app'e giriş yapın
2. "New Project" → "Deploy from GitHub"
3. Backend klasörünü seçin
4. Environment variables ekleyin
5. Deploy edin

**Render:**
1. Render.com'a giriş yapın
2. "New Web Service" → GitHub repo seçin
3. Build command: `cd backend && npm install && npm run build`
4. Start command: `cd backend && npm start`
5. Environment variables ekleyin

---

## 📱 Frontend Configuration

### 1. Production Environment Variables

Root dizinde `.env.production` dosyası oluşturun:

```env
VITE_API_URL=https://api.esnaftaucuz.com/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. API URL Detection Güncellemesi

`app/services/api.ts` dosyasında production kontrolü ekleyin:

```typescript
const getApiUrl = (): string => {
  // Production: Always use VITE_API_URL if set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Development fallback
  if (import.meta.env.MODE === 'development') {
    // ... existing development logic
  }
  
  // Production fallback (should not reach here if VITE_API_URL is set)
  console.error('⚠️ VITE_API_URL not set in production!');
  return 'https://api.esnaftaucuz.com/api'; // Fallback production URL
};
```

### 3. Build for Production

```bash
npm run build
```

Bu komut `dist/` klasörü oluşturur.

---

## 🤖 Android Build Configuration

### 1. Capacitor Configuration

`capacitor.config.ts` dosyasını production için güncelleyin:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.esnaftaucuz.app',
  appName: 'esnaftaucuz',
  webDir: 'dist',
  server: {
    // Production: Remove or comment out local server config
    // url: 'http://192.168.3.13:5173',
    // cleartext: true
  },
  plugins: {
    Camera: {
      permissions: {
        camera: 'esnaftaucuz needs access to your camera to take photos of prices.',
        photos: 'esnaftaucuz needs access to your photos to select price images.',
      },
    },
    Geolocation: {
      permissions: {
        location: 'esnaftaucuz, sana en yakın fiyatları gösterebilmek için konumuna ihtiyaç duyuyor.',
      },
    },
  },
};

export default config;
```

### 2. Android Build

```bash
# Build frontend
npm run build

# Sync with Capacitor
npx cap sync android

# Open Android Studio
npx cap open android
```

### 3. Android Studio'da Production Build

1. **Build** → **Generate Signed Bundle / APK**
2. **Android App Bundle** seçin
3. Keystore oluşturun veya mevcut keystore'u kullanın
4. **Release** build variant seçin
5. Build edin

### 4. Android Network Security Config

`android/app/src/main/res/xml/network_security_config.xml` dosyasını production için güncelleyin:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Production: Only allow HTTPS -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    
    <!-- Development: Allow HTTP for localhost (only for debug builds) -->
    <debug-overrides>
        <domain-config cleartextTrafficPermitted="true">
            <domain includeSubdomains="true">localhost</domain>
            <domain includeSubdomains="true">10.0.2.2</domain>
        </domain-config>
    </debug-overrides>
</network-security-config>
```

### 5. AndroidManifest.xml

`android/app/src/main/AndroidManifest.xml` dosyasında:

```xml
<application
    ...
    android:usesCleartextTraffic="false"  <!-- Production: false -->
    android:networkSecurityConfig="@xml/network_security_config">
```

---

## 🔐 HTTPS Gereksinimleri

**ÖNEMLİ:** Android Store (Google Play) production uygulamalar için HTTPS zorunludur!

### Backend HTTPS

1. **Nginx + Let's Encrypt** (önerilen)
2. **Cloudflare** (ücretsiz SSL)
3. **AWS CloudFront** + ACM
4. **Railway/Render** (otomatik HTTPS)

### Frontend HTTPS

- Production build'de tüm API çağrıları HTTPS olmalı
- `VITE_API_URL` mutlaka `https://` ile başlamalı

---

## 📦 Deployment Seçenekleri

### 1. **Railway** (Önerilen - Kolay)
- ✅ Otomatik HTTPS
- ✅ Environment variables yönetimi
- ✅ GitHub entegrasyonu
- ✅ Ücretsiz tier mevcut
- 💰 Fiyat: $5-20/ay

### 2. **Render**
- ✅ Otomatik HTTPS
- ✅ Kolay kurulum
- ✅ Ücretsiz tier mevcut
- ⚠️ Free tier'da uyku modu
- 💰 Fiyat: $7-25/ay

### 3. **DigitalOcean Droplet**
- ✅ Tam kontrol
- ✅ Ölçeklenebilir
- ⚠️ Manuel kurulum gerekli
- 💰 Fiyat: $6-12/ay

### 4. **AWS EC2**
- ✅ Güçlü ve ölçeklenebilir
- ⚠️ Karmaşık kurulum
- 💰 Fiyat: $10-50/ay

### 5. **Heroku**
- ✅ Kolay kurulum
- ⚠️ Pahalı
- ⚠️ Free tier kaldırıldı
- 💰 Fiyat: $7-25/ay

---

## 🔄 Deployment Checklist

### Backend
- [ ] VPS/Cloud service seçildi
- [ ] Backend deploy edildi
- [ ] HTTPS sertifikası kuruldu
- [ ] Environment variables ayarlandı
- [ ] PM2 veya benzeri process manager kuruldu
- [ ] Health check endpoint test edildi
- [ ] CORS ayarları production için güncellendi

### Frontend
- [ ] `.env.production` dosyası oluşturuldu
- [ ] `VITE_API_URL` production URL'e ayarlandı
- [ ] Production build alındı (`npm run build`)
- [ ] Build test edildi

### Android
- [ ] `capacitor.config.ts` production için güncellendi
- [ ] `network_security_config.xml` production için güncellendi
- [ ] `AndroidManifest.xml` cleartext traffic kapalı
- [ ] Release build alındı
- [ ] APK/AAB test edildi
- [ ] Google Play Console'a yüklendi

---

## 🧪 Test Checklist

### Backend
- [ ] Health check: `https://api.esnaftaucuz.com/api/health`
- [ ] Authentication endpoints çalışıyor
- [ ] Database bağlantısı çalışıyor
- [ ] File uploads çalışıyor

### Frontend
- [ ] API çağrıları HTTPS üzerinden çalışıyor
- [ ] Authentication çalışıyor
- [ ] Tüm sayfalar yükleniyor
- [ ] Mobile responsive çalışıyor

### Android
- [ ] Uygulama açılıyor
- [ ] Backend'e bağlanıyor
- [ ] Authentication çalışıyor
- [ ] Tüm özellikler test edildi

---

## 📞 Sorun Giderme

### Backend'e bağlanamıyor
1. Backend URL'ini kontrol edin
2. HTTPS sertifikasını kontrol edin
3. CORS ayarlarını kontrol edin
4. Firewall kurallarını kontrol edin

### Android'de "Network Security" hatası
1. `network_security_config.xml` dosyasını kontrol edin
2. `AndroidManifest.xml`'de `usesCleartextTraffic="false"` olduğundan emin olun
3. API URL'inin `https://` ile başladığından emin olun

### Environment variables yüklenmiyor
1. `.env.production` dosyasının root dizinde olduğundan emin olun
2. `VITE_` prefix'inin olduğundan emin olun
3. Build'i yeniden alın

---

## 📚 Ek Kaynaklar

- [Railway Deployment Guide](https://docs.railway.app/)
- [Render Deployment Guide](https://render.com/docs)
- [Capacitor Production Guide](https://capacitorjs.com/docs/guides/deploying)
- [Android Network Security](https://developer.android.com/training/articles/security-config)

---

## 💡 Öneriler

1. **Staging Environment:** Production'a geçmeden önce staging environment oluşturun
2. **Monitoring:** PM2, Sentry, veya benzeri monitoring tool'ları kullanın
3. **Backup:** Database backup'ları düzenli alın
4. **Logging:** Production loglarını takip edin
5. **CDN:** Statik dosyalar için CDN kullanın (opsiyonel)

---

**Son Güncelleme:** 2024








