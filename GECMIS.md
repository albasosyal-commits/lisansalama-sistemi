# Geçmiş — Yapılan İşlemler Günlüğü

Bu dosya, Lisansama (lisansalama-sistemi) merkezi lisans yönetim sistemi ve ona bağlı
üç kulüp uygulamasının (democlub, sporclub, anadoluakçaysporclub) geliştirme sürecinde
Claude Code oturumlarında yapılan işlemlerin kronolojik özetidir. Teknik mimari için
`CLAUDE.md`'ye, yeni bir uygulamayı sisteme bağlama adımları için `lisansaktarim.md`'ye bakın.

## 1. Başlangıç — Proje Analizi ve Belgeleme

- `CLAUDE.md` oluşturuldu: proje mimarisi, ikili veri yolu (Firestore client SDK + `/api/*`),
  Vercel'de eksik serverless endpoint riski, veri modeli, bilinen sorunlar belgelendi.
- Ürün satışı (products) işleminin `spoer-club`/Akçay tarafında görünmemesi sorunu bulundu ve
  izin (`permissions.ts`) varsayılanı `true` yapılarak çözüldü.

## 2. Lisanslama ↔ Democlub Entegrasyonu

- `https://lisansalama-sistemi.vercel.app` üzerinden lisans üretimi, dondurma (pause),
  iptal (revoke) akışları democlub (`https://demosporclub.sosyalritim.com.tr/`) ile canlı test edildi.
- **Bug**: Lisans dondurulduğunda democlub çalışmaya devam ediyordu → race condition
  (tam nesne `saveLicense()` yazması eşzamanlı istekleri eziyordu) tespit edilip
  hedefli `updateDoc()` tabanlı fonksiyonlarla (`recordLicenseUsage`, `updateLicenseFields`,
  `markLicenseRemovedFromApp`) düzeltildi.
- **Bug**: Reaktivasyonda "Function setDoc() called with invalid data: Unsupported field
  value: undefined" hatası → `sanitizeForFirestore()` dizilere de recursive çalışacak
  şekilde yeniden yazıldı.
- **Bug**: Lisans silinip sayfa yenilenince tekrar aktif görünüyordu → Firestore'daki
  `app_license/current` ve `systemConfig/activeLicense` dokümanları da temizlenmediği için
  oluşuyordu; `clearFirestoreAppLicenseDoc()` eklendi.
- **Bug**: Yeni lisans girildiğinde "kullanım durumu" düşmüyordu → `activateLicense()`
  hiçbir zaman `checkLicenseOnline()` çağırmıyordu; aktivasyon sonrası bu çağrı eklendi.
- "Sistem Lisans Bilgileri" kartı democlub'ta Settings sayfasından "Sistem & Veri Tabanı
  Yönetim Paneli" (SystemAdmin.tsx) içine taşındı, ayrı bir "Lisans Bilgileri" sekmesi olarak.
- Lisans uygulamadan silinirse veritabanında "Lisans Silindi" uyarısının görünmesi istendi →
  `removed_from_app` / `removed_from_app_at` alanları eklendi, `LicenseList.tsx`'te en
  yüksek öncelikli rozet olarak gösterildi.

## 3. WhatsApp Entegrasyonu (democlub)

- `https://demosporclub.sosyalritim.com.tr/whatsapp` sayfasında karekod gelmiyordu.
- Kök neden: ayrı WhatsApp köprü servisinde (`whatsapp entegrasnyon`, whatsapp-web.js + PM2 +
  ngrok) democlub için `tenants.json` içinde tenant tanımı yoktu → eklendi, servis yeniden başlatıldı.
- Vercel tarafında `WHATSAPP_SERVICE_URL` / `WHATSAPP_SERVICE_API_KEY` ortam değişkenlerinin
  kullanıcı tarafından panelden eklenip yeniden deploy edilmesi gerekiyordu (Claude'un Vercel
  panel erişimi yok). Son kontrolde durum hâlâ "disconnected" görünüyordu; teşhis amaçlı
  `debugError` ve `envCheck` alanları API yanıtına eklendi ki sorun panel erişimi olmadan da
  tespit edilebilsin. **Bu konu tam doğrulanmadı, takip gerekebilir.**

## 4. Vercel Serverless Routing Sorunları (Lisansama-main)

- `api/products.ts` + `api/products/[id].ts` gibi dosya/dizin adı çakışmaları sessizce
  build'i bozuyordu; `[...catchall].ts` ve `[[...optional]].ts` bu Vercel hesabında güvenilir
  çalışmıyordu.
- Kalıcı çözüm: tüm API rotaları **düz dosyalar** haline getirildi (`api/status.ts`,
  `api/keys.ts`, `api/products.ts`, `api/product-item.ts`, `api/licenses.ts`,
  `api/license-item.ts`, `api/firebase-config.ts`, `api/v1/verify.ts`, `api/verify-offline.ts`)
  ve dinamik segmentler `vercel.json` içinde `:param` tarzı rewrite kurallarıyla yönlendirildi.
- `firestoreStore.ts` (firebase-admin SDK, Vercel'de env var eksikliğinden çalışmıyordu) yerine
  tüm route'lar `server/firebaseAdmin.js` (client SDK) üzerinden çalışacak şekilde değiştirildi.
- `saveLicense()` fire-and-forget (await'siz) yazım yapıyordu → `await` eklenip hataların
  fırlatılması sağlandı, sessiz veri kaybı önlendi.

## 5. Sporclub Entegrasyonu (spoer-club klasörü)

- **Önemli düzeltme**: `sporclub.sosyalritim.com.tr` işlemlerinin **`anadoluakçaysporclub`**
  değil, ayrı **`spoer-club`** klasöründen ve onun `origin` remote'una (sporclub.git) push
  edilerek yapılması gerektiği netleştirildi (ikisi de aynı git repo'ya bağlı görünse de
  ayrı yönetilen kod tabanları).
  `anadoluakçaysporclub`'a önceden kopyalanmış lisans dosyaları geri alındı, iş `spoer-club`'da
  tekrarlandı.
- `origin`'den en güncel kod çekildi (bir başka oturumun "Ürün Satışı" özelliği ile birleşti).
- democlub'daki lisans bileşenleri (`src/components/license/*`, `LicenseContext.tsx`,
  `licenseValidator.ts`) kopyalandı, `CURRENT_PRODUCT_ID = 'SPORCLUB_V1'` olarak ayarlandı.
- `DataSecurityService.ts`'e eksik `getDecryptedStorage`/`setEncryptedStorage` metodları eklendi.
- `App.tsx` `LicenseProvider` + `LicenseGate` ile sarmalandı.
- `SystemAdmin.tsx`'e democlub'daki gibi "Lisans Bilgileri" sekmesi eklendi.
- Lisansama'da `sporclub-v1` ürünü oluşturuldu.
- **Bug**: Kullanıcı yanlış ürün koduyla (`spor-kulubu-v1` yerine) lisans üretmişti, sporclub
  kabul etmiyordu → doğru ürünle yeni lisans üretilip anahtar kullanıcıya verildi.
- Sporclub sistem yönetici panelinde "Lisans Bilgileri" alanı democlub'takiyle aynı şekilde
  eklendi (kullanıcı talebi üzerine).

## 6. Anadolu Akçay Spor Kulübü Entegrasyonu

- Önce "Akçay'a şu an bir şey yapma" denildi, daha sonra "anadoluakçaysporclub'a da
  lisanslama sistemini kur" talimatıyla açıkça onaylandı.
- Git durumu doğrulandı: local HEAD = `akcaysporclub` remote HEAD, `origin` (sporclub.git)
  ileride/diverge olduğu için **asla `origin`'e push edilmedi**, sadece `akcaysporclub`
  remote'una push edildi.
- Aynı kopyalama deseni (lisans bileşenleri, DataSecurityService fix, App.tsx sarmalama,
  SystemAdmin.tsx "Lisans Bilgileri" sekmesi), `CURRENT_PRODUCT_ID = 'AKCAY_SPOR_V1'`.
- Lisansama'da `akcay-spor-v1` ürünü oluşturuldu.
- İlk push denemesi HTTP 404 ile başarısız oldu (geçici GitHub sorunu), tekrar denemede başarılı oldu.

## 7. Kalıcı Entegrasyon Rehberi

- `lisansaktarim.md` oluşturuldu: yeni bir uygulamaya lisanslama sistemini bağlamak için
  adım adım rehber + "Sık Karşılaşılan Sorunlar" tablosu, ileride her uygulama için yeniden
  ayar yapmaya gerek kalmasın diye.

## 8. Lisansama Paneline Giriş Ekranı ve Hesap Yönetimi

- `https://lisansalama-sistemi.vercel.app/` için kullanıcı adı/şifre ile giriş ekranı istendi
  (varsayılan: `admin` / `100712`), diğer üç kulüp uygulamasındaki "100712" şifre kilidi
  deseniyle uyumlu, tamamen client-side (sunucu doğrulamalı değil) bir model.
- `AuthContext.tsx`, `LoginScreen.tsx` oluşturuldu; `App.tsx` `AuthProvider` + `AuthGate` ile
  sarmalandı.
- İlk aşamada şifre değiştirme header'da bir dropdown modal (`ChangePasswordModal.tsx`) olarak
  eklendi.
- **Sonraki talep**: kullanıcı adı/şifre değiştirmenin ayrı bir sistem menüsü (sidebar sekmesi)
  olması istendi, sadece şifre değil kullanıcı adı da değiştirilebilmeliydi.
  - `AuthContext.tsx`'e `changeUsername()` eklendi, kullanıcı adı da artık `localStorage`'da
    saklanıp giriş kontrolünde kullanılıyor.
  - `AccountSettingsView.tsx` oluşturuldu: "Kullanıcı Adını Değiştir" ve "Şifre Değiştir"
    olmak üzere iki ayrı form içeren tam sayfa bileşen.
  - Sidebar'a "Hesap Ayarları" sekmesi eklendi, header'daki dropdown butonu artık bu sekmeye
    yönlendiriyor; eski modal bileşeni (`ChangePasswordModal.tsx`) kaldırıldı.
  - `tsc --noEmit` ile doğrulandı, commit atılıp otomatik push ile Vercel'e deploy edildi,
    canlı bundle'da yeni metinler ("Hesap Ayarları", "Kullanıcı Adını Değiştir" vb.) kontrol
    edilerek deploy'un gerçek olduğu (cache değil) teyit edildi.

## 9. Lisans Tablosuna "Son İşlem" Sütunu

- Lisans üzerinde değişiklik yapıldığında (örn. süre uzatma) tarih + işlem türü ayrı bir
  sütunda görünmesi istendi.
- `types/index.ts`'e `removed_from_app` alanları ve log action tipleri eklendi.
- `LicenseList.tsx`'e `ACTION_LABELS` haritası ve `getLastActionInfo()` yardımcı fonksiyonu
  eklendi; tabloya en son işlemi (tarih + etiket, tooltip'te tam açıklama) gösteren yeni
  "Son İşlem" sütunu eklendi.

## 10. Panel Sadeleştirme

- Ana ekrandan "Doğrulama Sandbox", "RSA Anahtarları", "SDK Entegrasyonu", "Mimari Dokümanı"
  sekmeleri ve ilgili buton/prop'lar (`onNavigateToVerifier` dahil) kullanıcı isteğiyle kaldırıldı.

---

**Genel durum**: Üç kulüp uygulaması (democlub, sporclub, anadoluakçaysporclub) artık
kendi ürün kodlarıyla merkezi Lisansama sistemine bağlı, uçtan uca test edilmiş şekilde
çalışıyor. WhatsApp entegrasyonunun Vercel ortam değişkeni tarafı kullanıcı onayı/kontrolü
bekliyor; geri kalan tüm talep edilen özellikler tamamlanıp canlıya alındı.
