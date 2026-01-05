# 🔥 Capacitor Live Reload Kurulumu

Cihazda hot reload için aşağıdaki adımları izleyin:

## 1. Local IP Adresinizi Bulun

### Windows:
```powershell
ipconfig
```
`IPv4 Address` değerini bulun (örn: `192.168.1.100`)

### Mac/Linux:
```bash
ifconfig | grep "inet "
```
veya
```bash
ip addr show | grep "inet "
```

## 2. Capacitor Config'i Güncelleyin

`capacitor.config.ts` dosyasını açın ve development modunda `server` ayarını ekleyin:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.esnaftaucuz.app',
  appName: 'esnaftaucuz',
  webDir: 'dist',
  // Development: Uncomment and replace YOUR_LOCAL_IP with your IP
  server: {
    url: 'http://YOUR_LOCAL_IP:5173', // Örn: 'http://192.168.1.100:5173'
    cleartext: true
  },
  plugins: {
    // ... existing plugins
  },
};

export default config;
```

## 3. Vite Dev Server'ı Başlatın

```bash
npm run dev
```

Vite server'ı `0.0.0.0:5173` adresinde başlayacak (network üzerinden erişilebilir).

## 4. Android'de Live Reload ile Çalıştırın

### Yöntem 1: Capacitor CLI ile (Önerilen)
```bash
# Terminal 1: Vite dev server
npm run dev

# Terminal 2: Android'de live reload ile çalıştır
npx cap run android --livereload --external
```

### Yöntem 2: Manuel
1. `npm run dev` ile Vite server'ı başlatın
2. `capacitor.config.ts`'de `server.url` ayarını yapın
3. `npx cap sync android` çalıştırın
4. Android Studio'da uygulamayı çalıştırın

## 5. iOS'te Live Reload ile Çalıştırın

```bash
# Terminal 1: Vite dev server
npm run dev

# Terminal 2: iOS'te live reload ile çalıştır
npx cap run ios --livereload --external
```

## ⚠️ Önemli Notlar

1. **Aynı WiFi Ağı**: Bilgisayarınız ve cihazınız aynı WiFi ağında olmalı
2. **Firewall**: Windows Firewall Vite server'ına izin vermeli
3. **IP Değişirse**: WiFi değiştirirseniz veya IP değişirse `capacitor.config.ts`'i güncelleyin
4. **Production Build**: Production build için `server` ayarını kaldırın veya comment out edin

## 🔧 Troubleshooting

### Cihaz bağlanamıyor:
- IP adresini kontrol edin
- Firewall ayarlarını kontrol edin
- Aynı WiFi ağında olduğunuzdan emin olun
- `cleartext: true` ayarının olduğundan emin olun

### Hot reload çalışmıyor:
- Vite dev server'ın çalıştığından emin olun
- `npx cap sync` çalıştırın
- Uygulamayı yeniden başlatın

## 📱 Production Build

Production build için `server` ayarını kaldırın:

```typescript
const config: CapacitorConfig = {
  // ...
  // server: { ... } // Comment out or remove
};
```

Sonra:
```bash
npm run build
npx cap sync
```

