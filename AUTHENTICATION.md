# 🔐 Authentication Sistemi

## ✅ Eklenen Özellikler

### 1. Email/Şifre ile Kayıt
- ✅ Kullanıcı adı, email ve şifre ile kayıt
- ✅ Email formatı kontrolü
- ✅ Şifre uzunluk kontrolü (min 6 karakter)
- ✅ Şifre hash'leme (bcrypt)
- ✅ Duplicate email kontrolü

### 2. Email/Şifre ile Giriş
- ✅ Email ve şifre ile giriş
- ✅ Şifre doğrulama
- ✅ Hata mesajları (Türkçe)

### 3. Google OAuth
- ✅ Google ile giriş/kayıt
- ✅ Mevcut kullanıcı kontrolü
- ✅ Otomatik kayıt (ilk girişte)

### 4. Misafir Girişi
- ✅ İzin olmadan kullanım
- ✅ Geçici hesap oluşturma

## 📋 API Endpoints

### POST /api/auth/register
**Kayıt ol**
```json
{
  "email": "kullanici@example.com",
  "password": "sifre123",
  "name": "Kullanıcı Adı"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "Kullanıcı Adı",
    "email": "kullanici@example.com",
    "level": "Yeni",
    "points": 0,
    "contributions": { "shares": 0, "verifications": 0 }
  }
}
```

### POST /api/auth/login
**Giriş yap**
```json
{
  "email": "kullanici@example.com",
  "password": "sifre123"
}
```

**Response:** (aynı register gibi)

### POST /api/auth/google
**Google ile giriş**
```json
{
  "email": "user@gmail.com",
  "name": "Google User",
  "avatar": "https://...",
  "googleId": "google_id_123"
}
```

### POST /api/auth/guest
**Misafir girişi**
```json
{}
```

## 🎨 Frontend Özellikleri

### LoginScreen
- ✅ Email/şifre formu
- ✅ Google login butonu
- ✅ Kayıt/Giriş modu değiştirme
- ✅ Şifre göster/gizle
- ✅ Form validasyonu
- ✅ Loading durumları
- ✅ Türkçe hata mesajları

### Özellikler
- **Email validasyonu**: Geçerli email formatı kontrolü
- **Şifre validasyonu**: Minimum 6 karakter
- **Şifre göster/gizle**: Göz ikonu ile toggle
- **Mod değiştirme**: "Kayıt ol" / "Giriş yap" arasında geçiş
- **Google OAuth**: Google ile tek tıkla giriş
- **Misafir modu**: İzin olmadan kullanım

## 🔒 Güvenlik

- ✅ Şifreler bcrypt ile hash'leniyor (salt rounds: 10)
- ✅ JWT token authentication
- ✅ Password field varsayılan olarak döndürülmüyor
- ✅ Email unique kontrolü
- ✅ Input validasyonu (frontend + backend)

## 📱 Kullanım

### Kayıt Ol
1. Login ekranında "Kayıt ol" moduna geç
2. Ad, email ve şifre gir
3. "Kayıt Ol" butonuna tıkla
4. Otomatik giriş yapılır

### Giriş Yap
1. Email ve şifre gir
2. "Giriş Yap" butonuna tıkla
3. Ana ekrana yönlendirilirsin

### Google ile Giriş
1. "Google ile Giriş Yap" butonuna tıkla
2. (Production'da Google OAuth popup açılır)
3. Otomatik kayıt/giriş yapılır

## 🚀 Production İçin Notlar

### Google OAuth
Şu anda simüle edilmiş. Production için:
1. Google Cloud Console'da OAuth client oluştur
2. Frontend'de Google OAuth library kullan
3. Backend'de token doğrulama yap

### Şifre Sıfırlama
İleride eklenebilir:
- `/api/auth/forgot-password`
- `/api/auth/reset-password`

### Email Doğrulama
İleride eklenebilir:
- Kayıt sonrası email gönder
- Email doğrulama linki

## 🐛 Hata Mesajları

- "Email, password, and name are required" - Eksik alan
- "Invalid email format" - Geçersiz email
- "Password must be at least 6 characters" - Kısa şifre
- "User with this email already exists" - Email zaten kayıtlı
- "Invalid email or password" - Yanlış bilgi
- "Please use Google login for this account" - Google hesabı

## ✅ Test

1. **Kayıt ol:**
   - Email: test@example.com
   - Şifre: test123
   - Ad: Test User

2. **Giriş yap:**
   - Aynı email ve şifre ile

3. **Google login:**
   - Butona tıkla (şu anda simüle)

4. **Misafir:**
   - "Misafir Olarak Devam Et" butonuna tıkla

