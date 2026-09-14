# CLAUDE.md

Bu dosya, bu repoda çalışan Claude Code oturumları için proje rehberidir.

## Proje Özeti

**Lisans Yöneticisi (License Manager)** — geliştirilen diğer masaüstü/web/gömülü yazılım projeleri için **RSA-2048/SHA-256 dijital imzalı lisans anahtarları** üreten, yöneten, iptal edebilen (revoke), duraklatabilen (pause) ve hem çevrimdışı hem çevrimiçi doğrulama sağlayan tam kapsamlı bir lisans yönetim paneli. Demo (10 gün), Yıllık (365 gün) ve Özel süreli lisans tipleri; opsiyonel donanım (Machine ID) kilidi; Python/Node/C#/PHP/Go için hazır doğrulama SDK örnekleri içerir. Detaylı ürün açıklaması için `README.md`'ye bakın (Türkçe).

- **GitHub remote**: `albasosyal-commits/lisansalama-sistemi` (dikkat: klasör adı `Lisansama-main` ve proje konuşma dilinde "Lisansama" olarak geçiyor ama gerçek repo adı bu — karıştırmayın).
- **Deploy**: `main` dalına push → Vercel otomatik build + deploy alıyor.
- **package.json `name` alanı** hâlâ `"react-example"` — kalıntı, projenin gerçek adı değil.

## Teknoloji Yığını

- **Frontend**: React 19 + Vite 6 + TypeScript, Tailwind CSS 4 (`@tailwindcss/vite`), `lucide-react` ikonlar, `motion` (Framer Motion) animasyonlar. Router yok — sekme tabanlı tek sayfa uygulama (`activeTab` state'i, URL'e yansımıyor).
- **Yerel/dev backend**: Express 4, `tsx` ile çalıştırılıyor (`server.ts`) — hem Vite dev middleware'i hem de tüm `/api/*` REST API'sini tek process'te sunuyor.
- **Prod backend (Vercel)**: `api/*.ts` altında ayrı, bağımsız serverless function'lar (Express değil, çıplak Node `http` handler'ları).
- **Veritabanı**: Google **Firestore**, varsayılan olmayan (`(default)` değil) `lisanslamaaaa` adlı bir veritabanı.
- **Kriptografi**: Node'un yerleşik `crypto` modülü — RSA-2048 anahtar çifti + SHA-256 imza (lisans imzalama/doğrulama), AES-256-GCM + PBKDF2 (private key'i Firestore'da şifreli saklamak için).
- **Kimlik doğrulama**: **Yok.** Panelde login/session/rol yok, Firestore kuralları herkese açık (aşağıya bakın). `firebase-admin` ve `@google/genai` (Gemini) paketleri `package.json`'da var ama kodda fiilen kullanılmıyor gibi görünüyor — proje muhtemelen Google AI Studio "applet" olarak scaffold edilmiş (`metadata.json`, `assets/.aistudio/`), Gemini entegrasyonu kalıntı/kullanılmıyor.
- **Test altyapısı**: Yok. Test framework, `*.test.*` dosyası veya `test` script'i bulunmuyor. `npm run lint` sadece `tsc --noEmit` çalıştırır (tip kontrolü, gerçek lint değil).
- Hem `package-lock.json` hem `bun.lock` var (npm/bun karışık kullanılmış).

## Mimari — En Kritik Nokta: İkili Veri Yolu + Vercel'de Eksik Endpoint'ler

Bu proje standart bir "frontend → tek API → veritabanı" akışı **DEĞİL**. Üç farklı Firestore erişim katmanı ve iki farklı backend çalışma şekli var:

1. **`src/services/api.ts` (tarayıcı)** — Her işlemde önce **doğrudan Firestore client SDK** ile okuma/yazma dener (browser'dan direkt Firestore'a bağlanıyor, herkese açık kurallarla), başarısız olursa `/api/*` sunucu uçlarına düşer, sonra sonucu arka planda (`safeFirestoreSync`, non-blocking) tekrar Firestore'a yazar. Yani "yaz sonra senkronize et" (write-through) deseni var.
2. **`server/firebaseAdmin.ts`** — Adının aksine `firebase-admin` DEĞİL, client `firebase/firestore` SDK'sını kullanır. RSA anahtar üretme/şifreleme, ürün/lisans CRUD, imzalama (`signLicensePayload`) ve doğrulama (`verifyLicenseKeyString`) mantığının tamamı burada. `server.ts`'in route'larının çoğu bunu çağırır. Ayrıca `getLicenseById`/`saveLicense` için process-in-memory cache var (`cachedLicenses` vb.) — bu cache Vercel'in kısa ömürlü serverless instance'larında invocation'lar arası güvenilir şekilde paylaşılmaz, sadece uzun ömürlü Express dev sunucusunda tam etkilidir.
3. **`firestoreStore.ts`** (kök dizin) — `firebase-admin` SDK'sını kullanan ayrı, daha basit bir Firestore katmanı; sadece `server.ts` ve `api/*.ts` serverless function'ları tarafından import ediliyor.

   ⚠️ **Bilinen tutarsızlık**: `license_keys` koleksiyonundaki tekil sistem anahtarı dokümanının ID'si iki katman arasında farklı olabilir (`server/firebaseAdmin.ts` → `system_keys`, `firestoreStore.ts` → `main` gibi). Anahtar yönetimiyle ilgili bir hata ayıklarken bu ilk kontrol edilecek şeylerden biri olmalı.

4. **Ortam farkı — YEREL vs VERCEL PROD:**
   - **Yerel (`npm run dev` → `tsx server.ts`)**: Express app, `server.ts` içinde tanımlı **13 route'un tamamını** sunar (status, keys, keys/regenerate, keys/public.pem, firebase-config, products CRUD, licenses CRUD, licenses/:id/status, /extend, /usage, verify-offline, v1/verify).
   - **Vercel prod (`api/` klasörü)**: Sadece **3 serverless function** var: `api/status.ts`, `api/keys.ts`, `api/firebase-config.ts`. `vercel.json` `/api/(.*)` → `/api/$1` rewrite yapıyor ama bu sadece Vercel'in kendi function router'ına yönlendirir; gerçek dosya karşılığı olmayan yollar (`/api/licenses`, `/api/products`, `/api/licenses/:id/*`, `/api/verify-offline`, `/api/v1/verify`, `/api/keys/regenerate`, `/api/keys/public.pem`) **404 döner.**
   - **Sonuç**: RSA imzalama private key gerektirdiği için sadece sunucu tarafında yapılabiliyor (`signLicensePayload`) — bu imzalama `/api/licenses` (POST) ve `/api/licenses/:id/extend` route'larında gerçekleşiyor. Bu route'lar Vercel'de yoksa, **prod'da yeni lisans oluşturma, süre uzatma ve dış uygulamaların `/api/v1/verify` ile online doğrulama yapması çalışmıyor olabilir.** Frontend bu hatayı Firestore fallback'i ile sessizce yutuyor, yani kullanıcı arayüzde net bir hata görmeyebilir. **Bu, gerçek Vercel deploy'unda ilk doğrulanması gereken şey.**

## Dizin Yapısı

```
├── api/                     # Vercel serverless functions (SADECE 3 dosya — yukarıdaki uyarıya bakın)
│   ├── status.ts            # GET: dashboard istatistikleri
│   ├── keys.ts               # GET: RSA anahtar metadata'sı
│   └── firebase-config.ts    # GET: public Firebase web config
├── server.ts                # Yerel Express sunucusu — TAM API (13 route) + Vite middleware/static serving
├── server/
│   └── firebaseAdmin.ts      # RSA key mgmt, AES şifreleme, Firestore CRUD (client SDK), imzalama/doğrulama, in-memory cache
├── firestoreStore.ts         # firebase-admin SDK ile ayrı/basit Firestore katmanı (server.ts + api/*.ts kullanır)
├── src/
│   ├── App.tsx                # Global state, ilk REST fetch + gerçek zamanlı Firestore onSnapshot dinleyicisi
│   ├── main.tsx                # React root
│   ├── firebase.ts             # Client Firebase init; localStorage + /api/firebase-config ile runtime config
│   ├── services/api.ts         # "İkili veri yolu" mantığının kalbi (yukarıya bakın)
│   ├── types/index.ts           # Paylaşılan domain tipleri (Product, StoredLicense, LicensePayload, KeyMetadata...)
│   ├── data/defaultKeys.ts      # DEFAULT_KEY_METADATA — gömülü public key fallback'i
│   ├── data/codeSnippets.ts     # SDK entegrasyon kod örnekleri (statik string'ler)
│   └── components/               # 15 bileşen, ~6.250 satır — tüm UI burada (alt klasör yok)
│       ├── LicenseGenerator.tsx      # "Lisans Oluştur" sekmesi
│       ├── LicenseList.tsx           # Lisans veritabanı/tablo sekmesi (arama, filtre, iptal)
│       ├── LicenseManageModal.tsx    # En büyük bileşen (1000+ satır) — lisans detay/yönetim modalı
│       ├── ExtendLicenseModal.tsx    # Süre uzatma (RSA payload'ı yeniden imzalar)
│       ├── LicenseHistoryModal.tsx   # Lisans aktivite log görüntüleyici
│       ├── ProductManager.tsx        # Ürün CRUD sekmesi
│       ├── KeyManager.tsx            # RSA anahtar görüntüleme/yenileme/export
│       ├── LicenseVerifierSandbox.tsx # Çevrimdışı/çevrimiçi doğrulama test sandbox'ı (tamper testi dahil)
│       ├── ApiDiagnosticsView.tsx    # "API Tanılama Merkezi" — endpoint health-check, canlı /api/v1/verify test konsolu, hata kodu referans tablosu
│       ├── FirebaseStatusView.tsx    # Firebase/Firestore bağlantı durumu, config editörü, bağlantı testi (~915 satır)
│       ├── DashboardStats.tsx, Navbar.tsx, CodeSnippetsView.tsx, DocumentationView.tsx, ConfirmModal.tsx
├── data/licenses.json         # Eski/örnek lisans verisi (Firestore öncesi kalıntı olabilir)
├── firestore.rules            # allow read, write: if true  — HERKESE AÇIK, auth yok
├── firebase.json              # { firestore: { database: "lisanslamaaaa", rules: "firestore.rules" } }
├── firebase-blueprint.json, firebase-applet-config.json  # Firebase şema/config dokümanları
├── vercel.json                 # Rewrite: /api/* → kendisi, geri kalan her şey → /index.html (SPA)
├── auto-push.ps1 / otomatik-push-baslat.bat  # 10 sn'de bir git status kontrolü, değişiklik varsa otomatik commit+push
└── .git/hooks/post-commit      # Her commit sonrası ayrıca otomatik `git push origin HEAD` çalıştırır
```

## Veri Modeli (Firestore koleksiyonları)

- **`license_products`** (doc ID = `productId`): `{ id, name, productId, description, version, created_at }`
- **`licenses`** (doc ID = `license_id`, UUID):
  ```
  {
    license_id, product_id, product_name, customer,
    license_type: 'demo' | 'yearly' | 'custom',
    issued_at, expires_at, machine_id, status: 'active' | 'revoked' | 'paused',
    raw_key,   // base64(payload).base64(signature) — dış uygulamalara verilen lisans anahtarı
    created_at, revoked_at, paused_at, notes, extra,
    logs: LicenseActivityLog[],   // created/extended/paused/unpaused/revoked/reactivated/activated/used/reset_usage
    is_used, usage_count, first_used_at, last_used_at, last_machine_id, app_version
  }
  ```
- **`license_keys`** (tekil sistem dokümanı — ID tutarsızlığı için yukarıdaki uyarıya bakın):
  ```
  { algorithm, keySize, created_at, fingerprint, publicKey,
    encryptedPrivateKey: { encrypted, iv, tag, salt } }  // AES-256-GCM, LICENSE_MASTER_SECRET ile
  ```

**Lisans anahtarı formatı**: `base64(JSON payload).base64(RSA-SHA256 imza)` — sadece public key ile çevrimdışı doğrulanabilir.

## API Uç Noktaları (`server.ts` — kanonik/tam liste)

| Yöntem | Yol | Amaç | Vercel prod'da var mı? |
|---|---|---|---|
| GET | `/api/status` | Dashboard istatistikleri + key metadata | ✅ (`api/status.ts`) |
| GET | `/api/keys` | RSA key metadata | ✅ (`api/keys.ts`) |
| GET | `/api/keys/public.pem` | Public key indirme | ❌ |
| POST | `/api/keys/regenerate` | Yeni RSA çifti üret | ❌ |
| GET/POST | `/api/firebase-config`, POST `/reset` | Firebase config oku/güncelle/sıfırla | ✅ (sadece GET, `api/firebase-config.ts`) |
| GET/POST | `/api/products`, DELETE `/api/products/:id` | Ürün CRUD | ❌ |
| GET/POST | `/api/licenses` | Lisans listele / **oluştur ve imzala** | ❌ |
| PATCH | `/api/licenses/:id/status` | Revoke/pause/reactivate | ❌ |
| PATCH | `/api/licenses/:id/extend` | Süre uzat, **yeniden imzala** | ❌ |
| PATCH | `/api/licenses/:id/usage` | Kullanım durumunu işaretle/sıfırla | ❌ |
| DELETE | `/api/licenses/:id` | Lisans sil | ❌ |
| POST | `/api/verify-offline` | Sandbox doğrulama (imza + opsiyonel machine-id/usage tracking) | ❌ |
| POST | `/api/v1/verify` | **Dış uygulamaların çağırdığı** genel doğrulama API'si (imza, revoke, pause, expiry, product/machine eşleşmesi kontrolü + kullanım kaydı) | ❌ |

`ApiDiagnosticsView.tsx` bu endpoint'lerin çoğunu canlı test eden bir "API Tanılama" sekmesi sağlıyor — Vercel'de bir sorun olup olmadığını görmenin en hızlı yolu bu sekmedir.

## Geliştirme Komutları

```bash
npm install
npm run dev      # tsx server.ts — http://localhost:3000 (Express + Vite middleware, TÜM route'lar aktif)
npm run build    # vite build && esbuild server.ts --bundle ... --outfile=dist/server.cjs
npm start        # node dist/server.cjs — prod build'i yerel çalıştırır (Vercel'in DEĞİL, kendi build'inin davranışı)
npm run lint      # tsc --noEmit (sadece tip kontrolü)
```

## Ortam Değişkenleri

`.env.example` sadece AI Studio kalıntısı olan `GEMINI_API_KEY` ve `APP_URL`'i belgeliyor — bunlar bu lisans sisteminin gerçek çalışma zamanı değişkenleri **değil**. Kodda fiilen kullanılan değişkenler (hiçbiri `.env.example`'da yok, hepsinin hardcoded fallback'i var — bu bir eksiklik):

- `LICENSE_MASTER_SECRET` — private key AES-256-GCM şifreleme parolası (⚠️ ayarlanmazsa kaynak kodda gömülü varsayılan bir parola kullanılıyor — prod'da mutlaka gerçek bir değerle override edilmeli).
- `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_DATABASE_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — `firestoreStore.ts`'nin `firebase-admin` init'i için
- `NODE_ENV` — `server.ts`'de Vite middleware / statik `dist/` seçimini belirler
- `DISABLE_HMR` — `vite.config.ts`, AI Studio'ya özgü

## Bilinen Sorunlar / Riskler

1. **Vercel'de eksik endpoint'ler** (yukarıya bakın) — muhtemelen en kritik/acil sorun.
2. **`firestore.rules` tamamen açık**: `allow read, write: if true;` — hiçbir auth kontrolü yok, herkes tüm koleksiyonları okuyup yazabilir.
3. **Kimlik doğrulama hiç yok**: Lisans yönetim paneline (lisans oluşturma/iptal, RSA anahtar yenileme dahil) internetten erişebilen herkes müdahale edebilir.
4. **Secrets kaynak kodda hardcoded**: Firebase web config (apiKey dahil, 4+ yerde tekrarlanmış) ve `LICENSE_MASTER_SECRET` varsayılanı plaintext olarak repoda duruyor.
5. **İki Firestore katmanı arasında tutarsızlık** (`license_keys` doküman ID'si) — bkz. Mimari bölümü.
6. **Otomatik push mekanizmaları**: `auto-push.ps1` (10 sn'de bir polling) VE `.git/hooks/post-commit` (her commit sonrası) — kullanıcı açıkça istemedikçe bu betikleri tetikleme veya bunlara güvenerek "otomatik push edilir" varsayımıyla hareket etme; bir commit oluşturulduğunda hook zaten push edebilir.
7. Test altyapısı yok — davranış değişikliklerini elle (uygulamayı çalıştırıp) doğrulamak gerekiyor.

## Kod Kuralları

- Kullanıcıya dönük tüm mesajlar/log'lar (API `message` alanları, UI metinleri) **Türkçe** yazılıyor — yeni kod eklerken bu tutarlılığı koru.
- Fetch çağrılarında `res.json().catch(() => ({ message: '...JSON parse hatası...' }))` deseni tekrar tekrar kullanılıyor (boş/geçersiz yanıtlarda "Unexpected end of JSON input" hatasını önlemek için) — yeni fetch çağrıları eklerken aynı deseni izle.
- Firestore yazmaları çoğunlukla `safeFirestoreSync` / `withTimeout` yardımcılarıyla **non-blocking** yapılıyor (arka planda dener, hata olursa sadece `console.warn`) — kullanıcı akışını Firestore gecikmesi/hatası bloklamasın diye.
- Yeni bir `/api/*` route eklerken hem `server.ts`'e (yerel) HEM `api/` altına ayrı bir serverless function dosyası olarak eklemeyi unutma — aksi halde Vercel'de çalışmaz (bkz. Mimari bölümü).
