# Lisanslama Sistemini Yeni Bir Uygulamaya Aktarma Rehberi

Bu doküman, Lisansama (RSA-SHA256 lisans sistemi) entegrasyonunu **yeni bir uygulamaya** eklerken izlenecek adımları içerir. democlub ve sporclub'a (spoer-club klasörü) bu adımlarla kuruldu, ikisinde de çalışıyor.

**Önemli**: Lisans "kullanımda mı", "kaç gün kaldı" gibi bilgiler **tamamen otomatik** işler — hiçbir manuel ayar gerektirmez. Uygulama, lisans anahtarını girdiğiniz anda ve sonrasında periyodik olarak kendisi Lisansama'ya haber verir; siz sadece aşağıdaki tek seferlik kurulumu yapıp bir lisans anahtarı üretip girersiniz, gerisi kendi kendine işler.

---

## Adım 1: Dosyaları Kopyala

En son çalışan sürüm için **democlub-main** klasörünü referans al (en güncel düzeltmeler orada). Şu dosya/klasörleri yeni uygulamaya birebir kopyala:

```
src/components/license/          (tüm klasör: LicenseGate.tsx, LicenseActivationScreen.tsx, LicenseInfoModal.tsx, LicenseWarningModal.tsx)
src/contexts/LicenseContext.tsx
src/lib/licenseValidator.ts
```

## Adım 2: Ürün Kodunu Değiştir

`src/lib/licenseValidator.ts` dosyasında **tek bir satırı** değiştir:

```ts
export const CURRENT_PRODUCT_ID = 'YENI_UYGULAMA_V1';   // yeni uygulamaya özgü, benzersiz bir ID
```

**Dikkat**: Bu ID, Lisansama panelinde oluşturacağın ürünün `product_id` alanıyla (küçük harfe çevrilip boşluklar tire yapılarak) eşleşmeli. Karışıklığı önlemek için ürün kodunu **panelde ne yazacaksan, kod içinde de birebir aynı şekilde (büyük/küçük harf farkı önemli değil ama görsel olarak aynı isim) kullan**. Örnek: kod içinde `SPORCLUB_V1` ise panelde ürünü oluştururken `product_id` alanına `sporclub-v1` yaz (otomatik küçük harfe çevrilir, alt çizgiler tireye dönüşmez, harfe/tireye/alt çizgiye izin verilir).

⚠️ **En sık yapılan hata**: Panelde lisans oluştururken yanlışlıkla başka bir uygulamanın ürününü seçmek (örn. `SPOR_KULUBU_V1` yerine `SPORCLUB_V1`, isimler birbirine çok benziyor). Lisans oluşturmadan önce ürün adını iki kez kontrol et.

## Adım 3: `App.tsx`'i Sarmala

Ana `App()` bileşeninde `LicenseProvider` ve `LicenseGate`'i şu sırayla ekle (democlub/sporclub'daki gibi):

```tsx
import { LicenseProvider } from './contexts/LicenseContext';
import LicenseGate from './components/license/LicenseGate';

// ...

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <LicenseProvider>
          <AuthProvider>
            <ToastProvider>
              <ConfirmModalProvider>
                <BranchProvider>
                  <LicenseGate>
                    <BrowserRouter>
                      {/* mevcut route'lar buraya */}
                    </BrowserRouter>
                  </LicenseGate>
                </BranchProvider>
              </ConfirmModalProvider>
            </ToastProvider>
          </AuthProvider>
        </LicenseProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
```

Uygulamanın kendi provider zincirine göre sıra değişebilir; önemli olan `LicenseProvider`'ın en dışta, `LicenseGate`'in ise gerçek route'ları (BrowserRouter) sarmalamasıdır.

## Adım 4: `DataSecurityService` Kontrolü

`src/services/DataSecurityService.ts` dosyasında şu iki metod var mı kontrol et:

```
setEncryptedStorage(key, data)
getDecryptedStorage(key, defaultValue)
```

Yoksa (çoğu eski kod tabanında yok), dosyanın sonuna, `export class DataSecurityService { ... }` kapanışından hemen önce ekle:

```ts
  public static getDecryptedStorage<T = any>(key: string, defaultValue?: T): T {
    return this.secureLoadLocalSync<T>(key, defaultValue);
  }

  public static setEncryptedStorage(key: string, data: any): void {
    if (typeof window === 'undefined') return;
    try {
      const encrypted = this.encryptSync(data);
      window.localStorage.setItem(key, encrypted);
    } catch (err) {
      console.error(`[DataSecurity] Failed to setEncryptedStorage '${key}':`, err);
    }
  }
```

## Adım 5: Tip Kontrolü

```bash
npx tsc --noEmit
```

Hata çıkmamalı. Çıkarsa genelde eksik bir import ya da `DataSecurityService`'teki metod isimlerinin uyuşmamasıdır.

## Adım 6: Lisansama Panelinde Ürün + Lisans Oluştur

1. `https://lisansalama-sistemi.vercel.app` adresine git.
2. **Ürün Yönetimi**'nden yeni ürünü ekle (Adım 2'deki `product_id` ile birebir aynı olacak şekilde).
3. **Yeni Lisans Oluştur**'dan bu ürün için bir lisans üret (Demo/Yıllık/Özel).
4. Üretilen anahtarı kopyala.

## Adım 7: (Opsiyonel ama Önerilir) Sistem Yönetim Paneline "Lisans Bilgileri" Sekmesi Ekle

Eğer uygulamada `SystemAdmin.tsx` gibi bir "Sistem Yönetimi" paneli varsa, oraya da democlub/sporclub'daki gibi bir "Lisans Bilgileri" sekmesi eklenebilir (görüntüle/sil/yenile). Bu adım kozmetiktir, lisans sisteminin ÇALIŞMASI için gerekli değildir — sadece kullanıcının lisans durumunu panelden görebilmesi için.

Kod bloğu için democlub-main'deki `src/pages/system/SystemAdmin.tsx` içinde `"TAB 5: LİSANS BİLGİLERİ"` yorumunu ara, aynı bloğu kopyala.

## Adım 8: Deploy Edip Test Et

1. Commit + push.
2. Vercel deploy'unun tamamlanmasını bekle (`site.com/` açılışında yeni JS bundle hash'inin değiştiğini kontrol ederek doğrulanabilir).
3. Adım 6'da ürettiğin lisans anahtarını uygulamanın aktivasyon ekranına gir.
4. Lisansama panelinde birkaç saniye içinde o lisansın **"Kullanımda"** olarak işaretlendiğini gör (otomatik, hiçbir ek işlem gerekmez).

---

## Sık Karşılaşılan Sorunlar (Bu Gece Yaşanıp Çözülenler)

| Belirti | Sebep | Çözüm |
|---|---|---|
| Yeni oluşturulan lisans "geçersiz" deniyor | Panelde yanlış ürün seçilmiş (product_id uyuşmuyor) | Doğru ürünü seçip yeniden oluştur |
| Lisansı dondurdum/iptal ettim ama uygulama hâlâ çalışıyor | Eski Lisansama sürümünde bir yarış durumu (race condition) vardı, çok sık gelen doğrulama istekleri iptal işlemini eziyordu | Düzeltildi (bkz. Lisansama-main commit geçmişi, `updateLicenseFields`/`recordLicenseUsage`) — artık olmamalı |
| Lisansı sildim, sayfa yenilenince geri geldi | `removeLicense()` sadece localStorage'ı temizliyordu, Firestore'daki `app_license/current` dokümanına dokunmuyordu | Düzeltildi — artık o doküman da siliniyor |
| Lisans girdim ama panelde "Kullanımda" görünmedi | `activateLicense()` sadece offline doğrulama yapıp kaydediyordu, online kontrolü tetiklemiyordu (sayfa yenilenene kadar beklemek gerekiyordu) | Düzeltildi — aktivasyon anında online kontrol de tetikleniyor |
| `Function setDoc() called with invalid data: Unsupported field value: undefined` hatası | `sanitizeForFirestore` dizileri (logs gibi) temizlemiyordu | Düzeltildi |
| Vercel'de API uçları 404/500 dönüyor | Parantezli dinamik route'lar (`[id].ts`, `[...x].ts`) bu Vercel hesabında güvenilmez davranıyor; ayrıca aynı isimde hem dosya hem klasör olması (`api/products.ts` + `api/products/`) build'i bozuyor | Tüm route'lar düz dosyalara + `vercel.json` `:param` rewrite'larına çevrildi |
| WhatsApp karekodu gelmiyor | Yeni uygulama, bağımsız WhatsApp bridge servisinde ("whatsapp entegrasnyon" klasörü) tenant olarak tanımlı değildi | `tenants.json`'a yeni tenant eklenip servis yeniden başlatılmalı, `WHATSAPP_SERVICE_URL`/`WHATSAPP_SERVICE_API_KEY` Vercel'e eklenip **redeploy** edilmeli (env değişikliği tek başına yeterli değil) |

---

## Mimarinin Özeti (Neden Bu Kadar Basit Çalışıyor)

- **Tek bir RSA anahtar çifti** tüm uygulamalar için ortak (`EMBEDDED_PUBLIC_KEY`, `licenseValidator.ts` içinde gömülü) — private key hiçbir zaman istemciye gitmez, sadece Lisansama sunucusunda kalır.
- Her uygulamayı **`product_id`** ayırt eder — aynı public key, farklı ürün kodları.
- Kullanım takibi (`is_used`, `usage_count`, `first_used_at`, `last_used_at`) **tamamen sunucu tarafında, otomatik** güncellenir; istemci tarafında hiçbir manuel alan doldurma gerekmez.
- İptal/dondurma/uzatma paneldeki tek tıkla yapılır, istemci uygulama bir sonraki online kontrolünde (açılışta + her 6 saatte bir + artık aktivasyon anında) bunu otomatik yakalar ve tam ekran kilitler.
