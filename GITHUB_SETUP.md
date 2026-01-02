# 🚀 GitHub Repository Setup

## ✅ Yapılan İşlemler

1. ✅ Git repository başlatıldı
2. ✅ Remote repository eklendi: `https://github.com/sbabadag/esnaftaucuz.git`
3. ✅ Tüm dosyalar commit edildi
4. ✅ README.md güncellendi (Supabase bilgileri eklendi)
5. ✅ .gitignore güncellendi

## 📤 GitHub'a Push Etme

### İlk Push (Master Branch)

```bash
git branch -M main
git push -u origin main
```

### Veya Master Branch'i Kullanmak İsterseniz

```bash
git push -u origin master
```

## 📝 Commit Mesajı

```
Initial commit: esnaftaucuz - Price sharing app with Supabase integration
```

## 🔒 Önemli Notlar

1. **Environment Variables**: `.env` dosyaları `.gitignore`'da, GitHub'a push edilmeyecek
2. **Node Modules**: `node_modules/` klasörü ignore edildi
3. **Build Files**: `dist/` ve `build/` klasörleri ignore edildi
4. **Android/iOS**: Native projeler ignore edildi (Capacitor sync ile oluşturulur)

## 📋 Sonraki Adımlar

1. GitHub'a push yapın
2. Repository'de `.env.example` dosyası oluşturun (opsiyonel)
3. GitHub Actions veya CI/CD kurulumu yapabilirsiniz
4. README.md'deki setup talimatlarını güncelleyin

## 🔐 Environment Variables Template

`.env.example` dosyası oluşturabilirsiniz:

```env
# Supabase
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Backend (Scripts için)
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
PEXELS_API_KEY=your-pexels-api-key
```

