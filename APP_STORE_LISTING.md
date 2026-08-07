# App Store Connect — Yayın Hazırlığı (v1.0)

Bu dosyadaki metinleri App Store Connect → **Distribution → iOS App Version 1.0** alanlarına yapıştırın.
Dil seçici: **Turkish**.

## Eksikler (ekran görüntünüzdeki hatalar)

| Gereksinim | Ne yapmalı |
|---|---|
| Primary Category | App Information → **Shopping** (veya **Lifestyle**) |
| iPhone 6.5" screenshots | En az 1–3 adet (1242×2688 veya 1284×2778) |
| iPad 13" screenshots | En az 1 adet **veya** uygulamayı yalnızca iPhone yapıp yeni build yükleyin |
| Description | Aşağıdaki Türkçe açıklama |
| Keywords | Aşağıdaki anahtar kelimeler |
| Support URL | `https://www.esnaftaucuz.com/support.html` |
| Copyright | `2026 Selahattin Babadağ` |
| Contact Information | Ad: Selahattin Babadağ · E-posta: `admin@selahattinbabadag.com` · Telefon: Apple hesabınızdaki |

İsteğe bağlı ama önerilir:
- Privacy Policy URL (App Privacy / App Information): `https://www.esnaftaucuz.com/privacy-policy.html`
- Marketing URL: `https://www.esnaftaucuz.com`

---

## Primary Category

- **Primary:** Shopping  
- **Secondary (opsiyonel):** Lifestyle  

(App Store Connect → sol menü **App Information**)

---

## Turkish — Description (kopyala)

```
Esnaftaucuz — mahallenin en uygun fiyatlarını bulmanızı sağlayan yerel fiyat uygulaması.

Öne çıkan özellikler:
• Mahalle mahalle, market market fiyat karşılaştırması
• Fotoğraflı fiyat paylaşımları ve topluluk doğrulaması
• Google hesabı ile kolay giriş
• Konum bazlı keşif ve harita görünümü
• Fiyat düşüş bildirimleri
• Koyu mod ve Türkçe / English dil desteği

Neden Esnaftaucuz?
Alışverişten önce en iyi fiyatı bulun. Gerçek kullanıcıların paylaştığı fotoğraflı fiyatlarla güncel ve güvenilir bilgiye ulaşın; mahallenizdeki uygun fiyatları harita üzerinden keşfedin.
```

---

## Turkish — Keywords (max 100 karakter, virgülle)

```
fiyat,karşılaştırma,ucuz,market,mahalle,yerel,alışveriş,fiyat takip,en ucuz,harita
```

(97 karakter — App Store limiti 100)

---

## URLs

| Alan | Değer |
|---|---|
| Support URL | https://www.esnaftaucuz.com/support.html |
| Marketing URL | https://www.esnaftaucuz.com |
| Privacy Policy | https://www.esnaftaucuz.com/privacy-policy.html |

---

## Copyright

```
2026 Selahattin Babadağ
```

---

## App Review — Contact Information

- **First name:** Selahattin  
- **Last name:** Babadağ  
- **Phone:** kendi cep numaranız (uluslararası format, örn. +90…)  
- **Email:** admin@selahattinbabadag.com  

### Sign-in (gerekirse)

Uygulama Google ile giriş istiyorsa App Review için bir test hesabı notu ekleyin:

```
Google Sign-In kullanılmaktadır. Misafir/guest moda izin veriliyorsa Reviewer onu kullanabilir.
Tam özellik testi için lütfen sağlanan test Google hesabını kullanın: [TEST_EMAIL]
```

---

## Screenshots — hazır dosyalar

Konum: `store-assets/app-store/`

### iPhone 6.5" (1284 × 2778) — `iphone-6.5/`
1. `01-onboarding-look.png` — Alışverişten önce bak  
2. `02-onboarding-community.png` — Halktan halka fiyat  
3. `03-onboarding-nearby.png` — Sana yakın en ucuz  
4. `04-login.png` — Giriş ekranı  
5. `05-explore.png` — Keşfet (ana ekran)  
6. `06-profile.png` — Profil  

App Store Connect → **iPhone 6.5" Display** → bu klasörden en az **3** görsel yükleyin (önerilen sıra: 05, 04, 01, 03, 06).

### iPad 13" (2048 × 2732) — `ipad-13/`
Aynı 6 ekranın iPad boyutları (`ipad-01-…` … `ipad-06-…`).  
**iPad 13" Display** alanına en az 1–3 adet yükleyin (önerilen: `ipad-05-explore`, `ipad-04-login`, `ipad-01-onboarding-look`).

> Not: Web’den yakalanıp App Store boyutuna ölçeklendi. Gerçek cihazda native screenshot daha iyidir; yayın için bu set yeterli olmalı.

---

## Build

Version 1.0 sayfasında **Build → Add Build** ile TestFlight’taki son başarılı build’i seçin.
Build yoksa önce Codemagic iOS workflow’unun App Store Connect’e upload ettiğinden emin olun.

---

## Yayın öncesi kontrol listesi

- [ ] Primary category seçildi
- [ ] TR Description / Keywords / Support URL / Copyright kaydedildi
- [ ] Contact Information dolduruldu
- [ ] iPhone 6.5" screenshots yüklendi
- [ ] iPad 13" screenshots **veya** iPhone-only build
- [ ] Build eklendi
- [ ] App Privacy soruları tamamlandı (App Privacy sekmesi)
- [ ] Age Rating tamamlandı
- [ ] **Add for Review** aktif oldu
