# 🚀 GitHub Pages Deployment Guide

## ✅ Yapılan İşlemler

1. ✅ GitHub Actions workflow oluşturuldu (`.github/workflows/deploy.yml`)
2. ✅ `vite.config.ts` güncellendi (base path: `/esnaftaucuz/`)
3. ✅ `package.json`'a deploy script eklendi

## 📋 GitHub Repository Ayarları

### 1. GitHub Secrets Ekleme

Repository Settings → Secrets and variables → Actions → New repository secret

Şu secret'ları ekleyin:
- `VITE_SUPABASE_URL` - Supabase project URL'iniz
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key'iniz

### 2. GitHub Pages Ayarları

1. Repository Settings → Pages
2. Source: **GitHub Actions** seçin
3. Save

## 🔄 Otomatik Deployment

Her `main` branch'e push yaptığınızda otomatik olarak:
1. Build yapılacak
2. GitHub Pages'e deploy edilecek

## 🌐 Site URL

Deployment tamamlandıktan sonra siteniz şu adreste olacak:
**https://sbabadag.github.io/esnaftaucuz/**

## 📝 Manuel Deployment (Opsiyonel)

Eğer manuel deploy yapmak isterseniz:

```bash
npm install -g gh-pages
npm run deploy
```

## ⚙️ Environment Variables

GitHub Actions workflow'unda build sırasında environment variables kullanılır:
- `VITE_SUPABASE_URL` - GitHub Secrets'den alınır
- `VITE_SUPABASE_ANON_KEY` - GitHub Secrets'den alınır

## 🔍 Deployment Durumu

Deployment durumunu kontrol etmek için:
1. Repository → Actions sekmesine gidin
2. Son deployment'ı kontrol edin
3. Hatalar varsa log'ları inceleyin

## 🐛 Sorun Giderme

### Build Hatası
- GitHub Secrets'lerin doğru eklendiğinden emin olun
- Actions log'larını kontrol edin

### 404 Hatası
- `vite.config.ts`'deki `base` path'in doğru olduğundan emin olun
- Repository adı ile eşleşmeli: `/esnaftaucuz/`

### Environment Variables Eksik
- GitHub Secrets'e tüm gerekli değişkenleri ekleyin
- Workflow dosyasında environment variables tanımlı olduğundan emin olun

## 📚 Daha Fazla Bilgi

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#github-pages)

