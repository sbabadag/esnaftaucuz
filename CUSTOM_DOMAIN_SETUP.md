# 🌐 Custom Domain Setup - GoDaddy to GitHub Pages

## 📋 Genel Bakış

`www.esnaftaucuz.com` domain'ini GitHub Pages'e yönlendirmek için hem GitHub hem de GoDaddy'de ayarlar yapmanız gerekiyor.

## 🔧 Adım 1: GitHub Pages'de Custom Domain Ayarlama

### 1.1 Repository Settings

1. GitHub Repository → **Settings** → **Pages**
2. **Custom domain** bölümüne gidin
3. Domain'i girin: `www.esnaftaucuz.com`
4. **Save** butonuna tıklayın

### 1.2 CNAME Dosyası Oluşturma

GitHub otomatik olarak `CNAME` dosyası oluşturacak, ancak manuel de oluşturabilirsiniz:

**Dosya:** `public/CNAME` veya `static/CNAME`

**İçerik:**
```
www.esnaftaucuz.com
```

**Not:** Eğer `public` veya `static` klasörü yoksa, root'ta `CNAME` dosyası oluşturun ve build sırasında `dist/` klasörüne kopyalanacak şekilde ayarlayın.

## 🔧 Adım 2: GoDaddy DNS Ayarları

### 2.1 GoDaddy'ye Giriş

1. [GoDaddy.com](https://www.godaddy.com) → Giriş yapın
2. **My Products** → **DNS** → Domain'inizi seçin
3. **DNS Management** veya **Manage DNS** butonuna tıklayın

### 2.2 DNS Kayıtları Ekleme

#### Seçenek 1: CNAME Record (Önerilen - www için)

1. **Add** veya **Add Record** butonuna tıklayın
2. **Type:** `CNAME` seçin
3. **Name/Host:** `www` (veya `www.esnaftaucuz.com`)
4. **Value/Points to:** `sbabadag.github.io`
5. **TTL:** `600` (veya varsayılan)
6. **Save** butonuna tıklayın

#### Seçenek 2: A Record (Root domain için - esnaftaucuz.com)

Eğer `esnaftaucuz.com` (www olmadan) da çalışmasını istiyorsanız:

1. **Add Record** butonuna tıklayın
2. **Type:** `A` seçin
3. **Name/Host:** `@` (veya boş bırakın - root domain için)
4. **Value/Points to:** GitHub Pages IP adresleri:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
5. Her IP için ayrı A record ekleyin (4 adet)
6. **TTL:** `600`
7. **Save**

**Not:** Root domain için A record'lar ekledikten sonra, GitHub Pages'de de `esnaftaucuz.com` (www olmadan) ekleyebilirsiniz.

## 🔧 Adım 3: Vite Config Güncelleme

Custom domain kullanırken base path'i kaldırmalıyız:

```typescript
// vite.config.ts
export default defineConfig({
  base: process.env.GITHUB_ACTIONS && !process.env.CUSTOM_DOMAIN 
    ? '/esnaftaucuz/' 
    : '/',
  // ... diğer ayarlar
})
```

Veya daha basit:
```typescript
base: '/', // Custom domain için root path
```

## 🔧 Adım 4: GitHub Actions Workflow Güncelleme

Workflow'u custom domain için güncelleyin:

```yaml
- name: Build
  run: npm run build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL || '' }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY || '' }}
    NODE_ENV: production
    CUSTOM_DOMAIN: 'true' # Custom domain kullanıldığını belirtir
```

## ⏱️ DNS Propagation Süresi

DNS değişiklikleri genellikle:
- **Minimum:** 5-10 dakika
- **Ortalama:** 1-2 saat
- **Maksimum:** 48 saat

## ✅ Kontrol Etme

### 1. DNS Kontrolü

Terminal'de kontrol edin:
```bash
# Windows PowerShell
nslookup www.esnaftaucuz.com

# Veya online DNS checker kullanın
# https://dnschecker.org
```

**Beklenen sonuç:**
- CNAME: `sbabadag.github.io`
- Veya A Record: GitHub Pages IP'leri

### 2. GitHub Pages Kontrolü

1. Repository → Settings → Pages
2. **Custom domain** bölümünde domain görünmeli
3. **DNS check** başarılı olmalı (yeşil tik)

### 3. SSL Sertifikası

GitHub Pages otomatik olarak SSL sertifikası sağlar:
- **Enforce HTTPS** seçeneğini işaretleyin
- Birkaç dakika içinde SSL aktif olur

## 🔒 HTTPS Ayarları

1. Repository → Settings → Pages
2. **Enforce HTTPS** seçeneğini işaretleyin
3. SSL sertifikası otomatik olarak sağlanır (Let's Encrypt)

## 📝 DNS Kayıt Özeti

### www.esnaftaucuz.com için:
```
Type: CNAME
Name: www
Value: sbabadag.github.io
TTL: 600
```

### esnaftaucuz.com (root) için:
```
Type: A
Name: @
Value: 185.199.108.153
TTL: 600

Type: A
Name: @
Value: 185.199.109.153
TTL: 600

Type: A
Name: @
Value: 185.199.110.153
TTL: 600

Type: A
Name: @
Value: 185.199.111.153
TTL: 600
```

## 🐛 Sorun Giderme

### "DNS check failed"
- DNS kayıtlarının doğru eklendiğinden emin olun
- Propagation süresini bekleyin (1-2 saat)
- DNS checker ile kontrol edin: https://dnschecker.org

### "Site not found" veya 404
- GitHub Pages'de custom domain ayarlandığından emin olun
- `CNAME` dosyasının doğru olduğundan emin olun
- Base path'in `/` olduğundan emin olun (custom domain için)

### SSL Sertifikası Çalışmıyor
- "Enforce HTTPS" seçeneğini işaretleyin
- Birkaç saat bekleyin (SSL sertifikası oluşturulması zaman alabilir)

### www ve non-www Yönlendirme

Eğer hem `www.esnaftaucuz.com` hem de `esnaftaucuz.com` çalışmasını istiyorsanız:

1. GitHub Pages'de her iki domain'i de ekleyin
2. GoDaddy'de hem CNAME (www) hem de A record (root) ekleyin
3. Veya GoDaddy'de URL redirect kullanarak `esnaftaucuz.com` → `www.esnaftaucuz.com` yönlendirmesi yapın

## 📚 Kaynaklar

- [GitHub Pages Custom Domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [GoDaddy DNS Management](https://www.godaddy.com/help/manage-dns-records-680)
- [DNS Checker](https://dnschecker.org)

