# 🔧 GitHub Pages Deployment Sorun Giderme

## ❌ Workflow Başarısız Oluyor

### 1. GitHub Secrets Kontrolü

**Sorun:** Environment variables eksik olabilir.

**Çözüm:**
1. Repository Settings → Secrets and variables → Actions
2. Şu secret'ları ekleyin:
   - `VITE_SUPABASE_URL` - Supabase project URL'iniz
   - `VITE_SUPABASE_ANON_KEY` - Supabase anon key'iniz

**Not:** Secrets eksik olsa bile build çalışacak (boş string kullanılacak), ancak uygulama çalışmayabilir.

### 2. GitHub Pages Ayarları

**Sorun:** GitHub Pages etkinleştirilmemiş olabilir.

**Çözüm:**
1. Repository Settings → Pages
2. Source: **GitHub Actions** seçin
3. Save butonuna tıklayın

### 3. Workflow Log'larını Kontrol Etme

**Sorun:** Hata mesajını görmek için log'lara bakmanız gerekir.

**Çözüm:**
1. Repository → Actions sekmesine gidin
2. Başarısız workflow'u tıklayın
3. "Build" job'unu tıklayın
4. Hata mesajlarını okuyun

### 4. Yaygın Hatalar

#### "Error: Missing required environment variable"
- **Sebep:** GitHub Secrets eksik
- **Çözüm:** Secrets'leri ekleyin (yukarıdaki adım 1)

#### "Error: Build failed"
- **Sebep:** Build sırasında hata
- **Çözüm:** Log'ları kontrol edin, muhtemelen dependency hatası

#### "Error: Pages build failed"
- **Sebep:** GitHub Pages ayarları yanlış
- **Çözüm:** Settings → Pages → Source: GitHub Actions

#### "404 Not Found" (Site açıldığında)
- **Sebep:** Base path yanlış
- **Çözüm:** `vite.config.ts`'deki `base` path'i kontrol edin: `/esnaftaucuz/`

### 5. Manuel Test

Workflow'u manuel olarak test etmek için:

1. Repository → Actions
2. "Deploy to GitHub Pages" workflow'unu seçin
3. "Run workflow" butonuna tıklayın
4. Branch: `main` seçin
5. "Run workflow" butonuna tıklayın

### 6. Build'i Lokal Olarak Test Etme

```bash
# Environment variables ile build
VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key npm run build

# Build başarılı olursa, dist klasörünü kontrol edin
ls dist/
```

### 7. Workflow'u Yeniden Çalıştırma

1. Repository → Actions
2. Başarısız workflow'u tıklayın
3. Sağ üstte "Re-run jobs" butonuna tıklayın
4. "Re-run all jobs" seçin

## ✅ Başarılı Deployment Kontrolü

Deployment başarılı olduğunda:
1. Repository → Settings → Pages
2. "Your site is live at" mesajını göreceksiniz
3. URL: `https://sbabadag.github.io/esnaftaucuz/`

## 📝 Checklist

- [ ] GitHub Secrets eklendi (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] GitHub Pages etkinleştirildi (Settings → Pages → Source: GitHub Actions)
- [ ] Workflow dosyası doğru (`.github/workflows/deploy.yml`)
- [ ] `vite.config.ts`'de `base: '/esnaftaucuz/'` ayarlı
- [ ] Build lokal olarak çalışıyor (`npm run build`)
- [ ] Workflow log'larında hata yok

## 🔍 Detaylı Log Kontrolü

Workflow log'larında şunları arayın:
- ✅ "Build" step'i başarılı mı?
- ✅ "Upload artifact" step'i başarılı mı?
- ✅ "Deploy to GitHub Pages" step'i başarılı mı?
- ❌ Hangi step'te hata var?
- ❌ Hata mesajı ne diyor?

## 💡 İpuçları

1. **İlk deployment biraz zaman alabilir** (5-10 dakika)
2. **Secrets ekledikten sonra** workflow'u yeniden çalıştırın
3. **GitHub Pages ayarlarını** mutlaka yapın (Settings → Pages)
4. **Base path** repository adı ile eşleşmeli: `/esnaftaucuz/`





