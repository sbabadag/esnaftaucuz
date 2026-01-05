# Codemagic Environment Variables Group Yapılandırması

## 🔴 Sorun: Grup İçinde Variable'lar Var Ama Build'de Yüklenmiyor

Codemagic'te environment variable'ları bir grup içine eklediyseniz (örn: "2" veya "supabase_env_vars"), workflow'da bu grubu referans etmeniz gerekiyor.

## ✅ Çözüm: Workflow'da Grubu Referans Edin

### Adım 1: Grup Adınızı Bulun

1. Codemagic Dashboard → Settings → Environment variables
2. Variable'larınızın hangi grupta olduğunu kontrol edin
3. Grup adını not edin (örn: "2", "supabase_env_vars", "env_vars")

### Adım 2: codemagic.yaml Dosyasını Güncelleyin

`codemagic.yaml` dosyasında `groups` satırını aktif edin:

```yaml
environment:
  groups:
    - supabase_env_vars  # Grup adınızı buraya yazın
  vars:
    XCODE_WORKSPACE: "ios/App/App.xcworkspace"
    # ... diğer vars
```

**ÖNEMLİ:** Grup adı tam olarak Codemagic'teki grup adıyla eşleşmeli.

### Adım 3: Grup Adı Örnekleri

Eğer grup adınız:
- **"2"** ise → `groups: - "2"`
- **"supabase_env_vars"** ise → `groups: - supabase_env_vars`
- **"env_vars"** ise → `groups: - env_vars`

### Adım 4: Yeni Build Başlatın

1. Değişiklikleri commit edin ve push edin
2. Codemagic'te yeni build başlatın
3. Build loglarında environment variable'ların yüklendiğini kontrol edin

## 🔍 Grup Adını Nasıl Bulurum?

### Yöntem 1: Codemagic Dashboard

1. Codemagic Dashboard → Settings → Environment variables
2. Variable'larınızın yanında grup adını görebilirsiniz
3. Grup adı genellikle variable listesinin üstünde veya yanında görünür

### Yöntem 2: Variable Detayları

1. Herhangi bir variable'a tıklayın
2. Variable detaylarında "Group" bilgisi görünür

## 📋 Yapılandırma Örnekleri

### Örnek 1: Grup Adı "2"

```yaml
environment:
  groups:
    - "2"
  vars:
    XCODE_WORKSPACE: "ios/App/App.xcworkspace"
```

### Örnek 2: Grup Adı "supabase_env_vars"

```yaml
environment:
  groups:
    - supabase_env_vars
  vars:
    XCODE_WORKSPACE: "ios/App/App.xcworkspace"
```

### Örnek 3: Birden Fazla Grup

```yaml
environment:
  groups:
    - supabase_env_vars
    - app_store_credentials
  vars:
    XCODE_WORKSPACE: "ios/App/App.xcworkspace"
```

## ⚠️ ÖNEMLİ: Grup Adı Eşleşmeli

- Grup adı **tam olarak** Codemagic'teki grup adıyla eşleşmeli
- Büyük/küçük harf duyarlı olabilir
- Boşluk varsa tırnak içine alın: `"my group"`

## 🐛 Sorun Giderme

### "Build hala environment variable'ları görmüyor"

**Kontrol:**
1. Grup adının `codemagic.yaml`'da doğru yazıldığından emin olun
2. Codemagic Dashboard'da grup adını kontrol edin
3. Variable'ların gerçekten o grupta olduğundan emin olun
4. Yeni build başlatın

### "Grup adını bulamıyorum"

**Çözüm:**
1. Codemagic Dashboard → Settings → Environment variables
2. Variable'larınızı kontrol edin
3. Eğer grup yoksa, variable'ları grup dışına taşıyın veya yeni bir grup oluşturun

### "Variable'ları grup dışına taşımak istiyorum"

**Adımlar:**
1. Codemagic Dashboard → Settings → Environment variables
2. Her variable'a tıklayın
3. "Group" alanını boş bırakın veya "None" seçin
4. Save
5. `codemagic.yaml`'dan `groups` satırını kaldırın veya yorum satırı yapın

## ✅ Alternatif: Grup Kullanmadan

Eğer grup kullanmak istemiyorsanız:

1. **Codemagic Dashboard'da:**
   - Variable'larınızı grup dışına taşıyın
   - "Group" alanını boş bırakın

2. **codemagic.yaml'da:**
   - `groups` satırını kaldırın veya yorum satırı yapın:
   ```yaml
   environment:
     # groups:  # Grup kullanmıyoruz
     #   - supabase_env_vars
     vars:
       XCODE_WORKSPACE: "ios/App/App.xcworkspace"
   ```

3. **Yeni build başlatın**

## 📋 Kontrol Listesi

- [ ] Codemagic Dashboard'da grup adını buldum
- [ ] `codemagic.yaml` dosyasında `groups` satırını aktif ettim
- [ ] Grup adını doğru yazdım
- [ ] Değişiklikleri commit edip push ettim
- [ ] Yeni build başlattım
- [ ] Build loglarında `YES ✅` görünüyor

## 🔗 Faydalı Linkler

- [Codemagic Environment Variables Groups](https://docs.codemagic.io/yaml/environment-variables/#environment-variable-groups)
- [Codemagic YAML Reference](https://docs.codemagic.io/yaml/yaml-getting-started/)

