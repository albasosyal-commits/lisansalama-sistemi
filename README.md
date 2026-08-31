# 🛡️ Lisans Sistemi & Lisans Üretici (License Generator & Management System)

Bu proje, geliştirdiğiniz diğer masaüstü, web veya gömülü yazılım projeleriniz için **RSA-SHA256 dijital imzalı lisans anahtarları** üreten, yöneten, iptal edebilen ve istemciler için çevrimdışı (internetsiz) doğrulama sağlayan tam donanımlı bir lisans yönetim merkezidir.

---

## 🚀 Temel Özellikler

1. **Lisans Oluşturma & RSA-SHA256 İmzalama:**
   - Birden fazla ürün ve proje desteği (`product_id`).
   - Müşteri adı, firma veya e-posta adresi ile lisanslama.
   - **Demo Lisans (10 Gün)**, **Yıllık Lisans (365 Gün)** ve **Özel Süreli Lisans** otomatik UTC hesaplama.
   - **Makine ID (Hardware Fingerprint Lock):** İsteğe bağlı donanım kilidi ile lisansı belirli bir bilgisayara/sunucuya sabitleme.
   - Nokta ile ayrılmış Base64 çıktı formatı: `base64(payload).base64(signature)`.

2. **Kayıt Veritabanı & İptal (Revoke) Yönetimi:**
   - Üretilen tüm lisansların durumları (`active` / `revoked` / `expired`), süreleri ve detayları veritabanında saklanır.
   - Arama ve filtreleme (ürüne göre, duruma göre, lisans tipine göre).
   - Tek tıkla lisans iptal etme (revoke) ve yeniden aktif etme.
   - `.lic` veya `.txt` dosyası olarak indirme ve JSON dışa aktarma (backup).

3. **RSA-2048 Asimetrik Anahtar Çifti Yönetimi:**
   - İlk açılışta 2048-bit RSA anahtar çiftini otomatik üretir.
   - **Private Key Güvenliği:** Sunucuda `PBKDF2` + `AES-256-GCM` ile şifrelenmiş olarak saklanır, hiçbir zaman dışarıya verilmez.
   - **Public Key Dışa Aktarma:** `.pem` / `.txt` veya tek tıkla kopyalama (bu anahtar diğer projelerinize gömülür).
   - SHA-256 Key Fingerprint göstergesi.

4. **Doğrulama Sandbox'ı (Interactive Verifier):**
   - Herhangi bir lisans anahtarını yapıştırıp hem **çevrimdışı (RSA imza doğrulaması)** hem de **çevrimiçi (iptal durumu)** denetleme.
   - Tahrifat simülasyonu (Tamper test) ile değiştirilen verilerin anında yakalandığını kanıtlama.

5. **Hazır SDK & Entegrasyon Kodları:**
   - **Python** (`cryptography` paketi ile çevrimdışı doğrulama)
   - **Node.js / TypeScript** (Yerleşik `crypto` kütüphanesi, sıfır bağımlılık)
   - **C# / .NET** (`RSACryptoServiceProvider` / `RSA.Create()`)
   - **PHP** (`openssl_verify` fonksiyonu)
   - **Go (Golang)** (`crypto/rsa` ve `crypto/x509`)
   - **REST API (cURL)** (Merkezi sunucudan online iptal kontrolü)

---

## 🛠️ Kurulum ve Çalıştırma

### Gereksinimler
- Node.js 18+ (Node.js 20+ önerilir)
- npm veya yarn / pnpm

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Geliştirme Modunda Çalıştırın (Development)
```bash
npm run dev
```
Uygulama `http://localhost:3000` adresinde açılacaktır.

### 3. Prodüksiyon Derlemesi (Build & Start)
```bash
npm run build
npm start
```

---

## 💡 Nasıl Kullanılır? (Adım Adım Kılavuz)

### Adım 1: Public Key'i Dışa Aktarın
1. Üst menüden **RSA Anahtar Yönetimi** sekmesine gidin.
2. **Public Key'i Kopyala** veya **.pem Olarak İndir** butonuna basarak anahtarınızı alın.
3. Bu anahtarı korumak istediğiniz yazılım projenize yapıştırın.

### Adım 2: Yeni Ürün Tanımlayın (Opsiyonel)
1. **Ürün Yönetimi** sekmesine gidin.
2. Yazılımınız için bir ad ve benzersiz `product_id` (örn: `akilli-muhasebe-erp`) tanımlayın.

### Adım 3: Müşteri İçin Lisans Üretin
1. **Lisans Oluştur** sekmesine gelin.
2. Ürünü seçin, müşteri adını girin ve lisans tipini (Demo / Yıllık / Özel) seçin.
3. İsteğe bağlı olarak müşterinin donanım kodunu (Machine ID) girin.
4. **Lisans Anahtarı Üret & İmzala** butonuna basın.
5. Oluşan anahtarı müşteriye iletin veya `.lic` dosyası olarak kaydedin.

### Adım 4: İstemci Projenizde Lisansı Doğrulayın
**Python Örneği:**
```python
from license_verifier import LicenseVerifier

verifier = LicenseVerifier()
is_valid, message, payload = verifier.verify_license(
    license_key_str="MUSTERIDEN_GELEN_ANAHTAR",
    expected_product_id="akilli-muhasebe-erp"
)

if is_valid:
    print(f"Lisans Geçerli! Bitiş: {payload['expires_at']}")
else:
    print(f"Geçersiz Lisans: {message}")
```

---

## 🔒 Güvenlik & Mimari Notları

- **Asimetrik Kriptografi:** Lisansları yalnızca sizdeki **Private Key** imzalayabilir. Dağıttığınız yazılımlarda yalnızca **Public Key** bulunur. Kötü niyetli kişiler yazılımınızı tersine mühendislikle inceleseler dahi geçerli bir lisans üretemezler.
- **İnternetsiz (Offline) Doğrulama:** Müşterinizin bilgisayarı internete hiç bağlanmasa dahi imza ve son kullanma tarihi matematiksel olarak %100 güvenle doğrulanır.
- **Online İptal (Revocation API):** Müşteri internete bağlıysa `POST /api/v1/verify` adresine istek atılarak lisansın sunucuda iptal edilip edilmediği anlık sorgulanabilir.
- **UTC Zaman Standardı:** Tüm tarih hesaplamaları ISO 8601 UTC formatında yapılır, saat dilimi karışıklıkları yaşanmaz.
