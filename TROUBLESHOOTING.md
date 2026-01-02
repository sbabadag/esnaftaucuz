# 🐛 Sorun Giderme Rehberi

## ❌ "Failed to fetch" Hatası

### Olası Nedenler:

1. **Backend çalışmıyor**
2. **Yanlış API URL**
3. **CORS sorunu**
4. **Network bağlantı sorunu**

### Çözüm Adımları:

#### 1. Backend'in Çalıştığını Kontrol Edin

**Backend'i başlatın:**
```bash
cd backend
npm run dev
```

**Kontrol edin:**
- Terminal'de "🚀 Server running on port 5000" mesajını görmelisiniz
- Tarayıcıda `http://localhost:5000/api/health` adresine gidin
- "ok" yanıtı almalısınız

#### 2. API URL'i Kontrol Edin

**Web için (.env dosyası):**
```env
VITE_API_URL=http://localhost:5000/api
```

**Mobil cihaz için (.env dosyası):**
```env
VITE_API_URL=http://192.168.3.13:5000/api
```

**Not:** IP adresiniz farklı olabilir. Kontrol edin:
```bash
npm run get-ip
```

#### 3. CORS Sorunu

Backend'de CORS zaten açık, ama kontrol edin:
- `backend/server.ts` dosyasında `app.use(cors({ origin: true }))` olmalı

#### 4. Network Bağlantısı

**Mobil cihazda:**
- Cihaz ve bilgisayar aynı WiFi ağında olmalı
- Firewall port 5000'i engelliyor olabilir

**Windows Firewall:**
1. Windows Defender Firewall'ı açın
2. "Gelen kuralları" seçin
3. Port 5000 için kural ekleyin

#### 5. Browser Console Kontrolü

Tarayıcı konsolunda (F12) şunları kontrol edin:
- Network sekmesinde istek görünüyor mu?
- Hangi URL'e istek gidiyor?
- CORS hatası var mı?

### Hızlı Test

**Backend test:**
```bash
curl http://localhost:5000/api/health
```

**Frontend'den test:**
Tarayıcı konsolunda:
```javascript
fetch('http://localhost:5000/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

### Mobil Cihazda Test

**Android Studio Logcat:**
- "Failed to fetch" veya "Network" hatalarını arayın
- API URL'in doğru olduğunu kontrol edin

**Capacitor Config:**
`capacitor.config.ts` dosyasında:
```typescript
server: {
  url: 'http://192.168.3.13:5000',  // IP'nizi kullanın
  cleartext: true,  // HTTP için gerekli
}
```

## ✅ Çalışma Kontrol Listesi

- [ ] Backend çalışıyor (`cd backend && npm run dev`)
- [ ] MongoDB çalışıyor
- [ ] API health check çalışıyor (`/api/health`)
- [ ] `.env` dosyasında doğru API URL var
- [ ] Frontend yeniden başlatıldı (`.env` değişikliklerinden sonra)
- [ ] Mobil cihaz aynı WiFi'de
- [ ] Firewall port 5000'i engellemiyor
- [ ] Browser console'da hata yok

## 🔧 Hata Mesajları

### "Backend'e bağlanılamıyor"
- Backend çalışmıyor → `cd backend && npm run dev`
- Yanlış URL → `.env` dosyasını kontrol edin

### "CORS policy"
- Backend CORS ayarlarını kontrol edin
- `origin: true` olmalı

### "Network request failed"
- WiFi bağlantısını kontrol edin
- IP adresini doğrulayın
- Firewall ayarlarını kontrol edin

### "Invalid email or password"
- Bu normal bir hata (yanlış bilgi)
- Backend çalışıyor demektir ✅

## 📞 Daha Fazla Yardım

1. Browser console'u açın (F12)
2. Network sekmesine bakın
3. Hata mesajını okuyun
4. Backend terminal loglarını kontrol edin

