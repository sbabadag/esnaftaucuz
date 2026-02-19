# Google Play Console - Gizlilik Politikası URL'si

Google Play Console, uygulamanız için erişilebilir bir Gizlilik Politikası URL'si gerektirir.

## 📋 Seçenekler

### Seçenek 1: Kendi Domain'inizde Hosting (Önerilen)

Eğer `selahattinbabadag.com` veya `esnaftaucuz.com` domain'iniz varsa:

1. **Privacy Policy HTML dosyasını yükleyin:**
   - `privacy-policy.html` dosyasını web sunucunuza yükleyin
   - URL: `https://selahattinbabadag.com/privacy-policy.html`
   - VEYA: `https://www.esnaftaucuz.com/privacy-policy.html`

2. **Google Play Console'da kullanın:**
   - URL: `https://selahattinbabadag.com/privacy-policy.html`

### Seçenek 2: GitHub Pages (Ücretsiz)

1. **Repository oluşturun veya mevcut repo'yu kullanın:**
   ```bash
   # Yeni bir repository oluşturun (örnek: privacy-policy)
   # veya mevcut bir repository'ye ekleyin
   ```

2. **privacy-policy.html dosyasını yükleyin:**
   - GitHub repository'nize `privacy-policy.html` dosyasını ekleyin
   - GitHub Pages'i etkinleştirin: **Settings** → **Pages** → **Source: main branch**

3. **URL:**
   - `https://kullaniciadi.github.io/privacy-policy.html`
   - VEYA custom domain kullanıyorsanız: `https://www.esnaftaucuz.com/privacy-policy.html`

### Seçenek 3: Google Sites (Ücretsiz ve Hızlı)

1. [Google Sites](https://sites.google.com) açın
2. Yeni site oluşturun
3. `privacy-policy.html` içeriğini kopyalayıp yapıştırın
4. Yayınlayın
5. URL: `https://sites.google.com/view/esnaftaucuz-privacy-policy`

### Seçenek 4: Netlify/Vercel (Ücretsiz)

1. **Netlify:**
   - [Netlify](https://www.netlify.com) hesabı oluşturun
   - `privacy-policy.html` dosyasını yükleyin
   - URL: `https://esnaftaucuz-privacy.netlify.app`

2. **Vercel:**
   - [Vercel](https://vercel.com) hesabı oluşturun
   - `privacy-policy.html` dosyasını yükleyin
   - URL: `https://esnaftaucuz-privacy.vercel.app`

## 🚀 Hızlı Çözüm: GitHub Pages

En hızlı ve ücretsiz çözüm GitHub Pages kullanmak:

### Adımlar:

1. **GitHub'da yeni repository oluşturun:**
   - Repository adı: `esnaftaucuz-privacy` (veya istediğiniz isim)
   - Public olmalı

2. **privacy-policy.html dosyasını yükleyin:**
   ```bash
   # Repository'yi klonlayın
   git clone https://github.com/kullaniciadi/esnaftaucuz-privacy.git
   cd esnaftaucuz-privacy
   
   # Dosyayı kopyalayın
   cp ../privacy-policy.html .
   
   # Commit ve push
   git add privacy-policy.html
   git commit -m "Add privacy policy"
   git push
   ```

3. **GitHub Pages'i etkinleştirin:**
   - Repository → **Settings** → **Pages**
   - **Source:** `main` branch seçin
   - **Save**

4. **URL'yi kullanın:**
   - `https://kullaniciadi.github.io/esnaftaucuz-privacy/privacy-policy.html`
   - VEYA `index.html` olarak adlandırırsanız: `https://kullaniciadi.github.io/esnaftaucuz-privacy/`

## 📝 Google Play Console'da Kullanım

1. Google Play Console → **Uygulama içeriği** → **Gizlilik politikası**
2. **"Gizlilik politikası URL'si"** alanına URL'yi girin:
   - Örnek: `https://selahattinbabadag.com/privacy-policy.html`
   - Örnek: `https://kullaniciadi.github.io/esnaftaucuz-privacy/privacy-policy.html`
3. **"Kaydet"** butonuna tıklayın

## ✅ Kontrol Listesi

- [ ] Privacy policy HTML dosyası oluşturuldu (`privacy-policy.html`)
- [ ] Dosya bir web sunucusuna yüklendi
- [ ] URL erişilebilir (tarayıcıda açılıyor)
- [ ] HTTPS kullanılıyor (Google Play gerektirir)
- [ ] Google Play Console'da URL girildi

## 🔒 Önemli Notlar

1. **HTTPS Zorunlu:** Google Play sadece HTTPS URL'lerini kabul eder
2. **Erişilebilir Olmalı:** URL herkese açık olmalı (login gerektirmemeli)
3. **Türkçe İçerik:** Uygulamanız Türkçe ise, privacy policy de Türkçe olmalı
4. **Güncel Tutun:** Privacy policy'yi güncellediğinizde, Google Play Console'daki URL'yi de güncelleyin

## 📞 Yardım

Hangi hosting seçeneğini kullanacağınızı belirlemenize yardımcı olabilirim. Hangi domain/hosting servisiniz var?


