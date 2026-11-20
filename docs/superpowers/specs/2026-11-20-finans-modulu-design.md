# Finans Modülü — Tasarım

Tarih: 2026-11-20 · Durum: Onaylandı (kullanıcı kalan kararları tasarımcıya bıraktı)

## 1. Amaç ve Neden

Lisans Yöneticisi şu an lisans üretiyor/yönetiyor ama hiçbir parasal bilgi tutmuyor. Kullanıcı
(tek yönetici) şunları panelden takip etmek istiyor:

- Her firmaya bir lisansı **kaça verdiği** (fiyat her lisans/firma için elle belirlenir, sabit fiyat listesi yok)
- **Ne kadar ödeme aldığı** ve ne kadar alacağı kaldığı
- Uygulamaları için satın aldığı **hizmetlere ne kadar gider yaptığı** (sunucu, hosting, domain, abonelikler…)
- **Sonraki dönem fiyatını belirlemek** (yenilemede % artış)

Başarı: Finans sekmesini açtığında "bu yıl ne sattım, ne tahsil ettim, ne alacağım var, ne harcadım,
net kârım ne" sorularını TL olarak tek bakışta, ürün bazında da görebilmesi.

## 2. Hedefler / Hedef Olmayanlar / Anti-hedefler

**Hedefler**
- Lisans başına, dönem bazlı ücret (1 yıl, 15 ay, özel süre — lisansın açıldığı süre neyse)
- Lisansa bağlı ödemeler (bir döneme birden fazla kısmi ödeme/taksit)
- Ürüne bağlı (opsiyonel) giderler, tek seferlik veya tekrarlı (aylık/yıllık)
- Çoklu para birimi (TRY, USD, EUR); tüm toplamlar TL
- Yenilemede önceki fiyattan % artışla yeni fiyat önerisi
- Özet + ürün bazlı rapor, yıl filtresi

**Hedef olmayanlar (bu sürümde)**
- Fatura kesme / e-fatura, vergi (KDV) hesabı, muhasebe entegrasyonu
- Ayrı "firma" kartı/kaydı — firma, lisanstaki mevcut `customer` metni üzerinden gruplanır
- Otomatik hatırlatma e-postası/bildirim
- Çok kullanıcılı yetkilendirme

**Anti-hedefler (çalışsa bile başarısızlık sayılır)**
- Finans özelliğinin mevcut lisans üretme / imzalama / doğrulama akışını bozması veya yavaşlatması
- Geçmiş dönem TL tutarlarının kur değiştikçe kendiliğinden değişmesi
- Ücret girmeyi zorunlu kılmak (demo lisanslar ve eski lisanslar ücretsiz/boş kalabilmeli)

## 3. Kısıtlar

- Mevcut yığın: React 19 + Vite + TS + Tailwind 4, lucide-react, motion. Router yok, sekme tabanlı (`TabType` — `src/components/Navbar.tsx`).
- Veri: Firestore, `lisanslamaaaa` veritabanı, tarayıcıdan client SDK ile doğrudan erişim (`src/firebase.ts`).
- Vercel prod'da `/api/licenses*` vb. uçlar yok (CLAUDE.md). Finans imza gerektirmediği için **sunucu ucu eklenmeyecek**, tamamen client Firestore.
- Tüm UI metinleri Türkçe.
- Test altyapısı yok; doğrulama `npm run lint` (tsc) + uygulamayı elle çalıştırarak.
- Lisans dokümanına tam-nesne yazma geçmişte race condition üretti (`GECMIS.md` §2) → finans verisi **`licenses` dokümanlarına yazılmaz**.

## 4. Yaklaşımlar (kur yönetimi)

| | Yaklaşım | Artı | Eksi |
|---|---|---|---|
| **A (seçildi)** | Kur kayıt tarihinde sabitlenir; otomatik getirilir, elle düzeltilebilir; TL karşılığı kayıtla saklanır | Muhasebe açısından doğru, geçmiş değişmez | Kur API'sine bağımlılık (düşerse elle girilir) |
| B | Her gösterimde güncel kurla çevir | Basit veri | Geçmiş kâr her gün değişir — yanıltıcı |
| C | Kur her seferinde elle | İnternetsiz, basit | Her kayıtta ekstra iş |

Kullanıcı A'yı seçti. C, A'nın otomatik getirme başarısız olduğunda düştüğü moddur.

Veri yeri için tek makul yol: aynı Firestore'da yeni koleksiyonlar, client SDK ile (Vercel uç sorunu yok).

## 5. Veri Modeli (yeni Firestore koleksiyonları)

Ortak para alanları (her parasal kayıtta):
```
amount: number          // orijinal tutar
currency: 'TRY' | 'USD' | 'EUR'
fx_rate: number         // 1 birim = ? TL (TRY ise 1)
fx_date: string         // kurun ait olduğu tarih (YYYY-MM-DD)
fx_source: 'auto' | 'manual'
amount_try: number      // amount * fx_rate, kayıt anında hesaplanıp saklanır
```

**`finance_periods`** — lisansın ücretli dönemi (fiyat geçmişi)
```
id, license_id, product_id, customer (lisanstan kopya, gruplama için),
period_start, period_end,          // lisansın o dönemki issued/expires değerleri
...para alanları (dönem ücreti),
increase_pct?: number | null,      // önceki döneme göre uygulanan artış (bilgi amaçlı)
source: 'create' | 'extend' | 'manual',
notes?, created_at, updated_at
```

**`finance_payments`** — alınan ödemeler
```
id, license_id, period_id?: string | null, customer, product_id,
paid_at (YYYY-MM-DD), method?: 'havale' | 'nakit' | 'kart' | 'diger',
...para alanları, notes?, created_at
```

**`finance_expenses`** — giderler
```
id, title, category?: string (serbest: sunucu, domain, abonelik…),
product_id?: string | null (null = genel/ortak gider),
spent_at (YYYY-MM-DD),
recurrence: 'none' | 'monthly' | 'yearly',
recurrence_end?: string | null,
...para alanları, notes?, created_at
```

Tekrarlı gider: tek kayıt tutulur; raporlama sırasında seçilen aralığa düşen tekrarlar
hesaplanarak açılır (kur her tekrar için kaydın sabit `fx_rate`'i kullanılır — basitlik için;
gerçek tutar değişirse kullanıcı kaydı bitirip yeni kayıt açar).

Ek alan — `finance_periods.written_off: boolean` (+ `written_off_at`): "alacaktan düş" işaretli dönemin
kalanı alacağa sayılmaz.

### Hesaplama kuralları

- **Ödeme durumu dönemin kendi para biriminde** ölçülür: ödenen = döneme bağlı ödemelerin `amount`
  toplamı; kalan = dönem `amount` − ödenen. Rozet: kalan ≤ 0 → Ödendi, 0 < ödenen → Kısmi, aksi → Ödenmedi.
  Ödemenin para birimi döneminkiyle aynı olmak zorunda (form dönemin para birimini kilitler).
- **Kur farkı**: tamamen ödenen dönem için `Σ ödeme.amount_try − dönem.amount_try` (orantılı kısmi
  ödemelerde `Σ ödeme.amount_try − ödenen × dönem.fx_rate`). Raporda ayrı "Kur farkı" satırı/kartı;
  net kâra dahil değil (net kâr zaten tahsilatın gerçek TL'si üzerinden).
- **Kalan alacak (TL)** = kalan × dönem `fx_rate` (dönemin sabit kuru).
- Döneme bağlanmamış ödeme olmaz: ödeme formu lisansın açık dönemini seçtirir (varsayılan en eski açık dönem).
  Lisansın hiç dönemi yoksa önce dönem ücreti girilmesi istenir.
- **Yıl filtresi**: Satış → dönemin `period_start` yılı (dönemin tamamı başladığı yıla yazılır);
  Tahsilat → `paid_at`; Gider → `spent_at` (tekrarlılar açılmış haliyle); Kur farkı → ödemenin `paid_at` yılı.
  **Bekleyen alacak yıl filtresinden bağımsız**, bugün itibarıyla tüm açık alacaktır.

### Lisans durumu ve silme

- İptal/dondurma finans kayıtlarına dokunmaz; ödenmemiş kısım alacakta kalır. Dönem satırında
  "Alacaktan düş" eylemi (`written_off=true`, geri alınabilir).
- Lisans silindiğinde finans kayıtları **silinmez**. Raporlarda lisans bulunamazsa
  `customer`/`product_id` kopyalarıyla "(silinmiş lisans)" etiketiyle gösterilir; bu dönemlere yeni ödeme
  eklenebilir. Silme akışı (`api.deleteLicense`) değiştirilmez.
- Uzatmada yeni dönem `period_start` = önceki `expires_at`, `period_end` = yeni `expires_at`.

## 6. Kur Getirme

- Kaynak: `https://api.frankfurter.app/{YYYY-MM-DD}?from={USD|EUR}&to=TRY` (ECB verisi, ücretsiz, CORS açık, anahtar yok).
- Para birimi TRY değilse ve tarih seçildiğinde otomatik çağrılır; sonuç kur alanına dolar, `fx_source='auto'`.
- Kullanıcı kuru değiştirirse `fx_source='manual'`.
- Hata/timeout (5 sn): alan boş kalır, "Kur alınamadı, elle girin" uyarısı; kayıt kur girilmeden kaydedilemez.
- Fetch, CLAUDE.md'deki `res.json().catch(...)` desenini izler.

## 7. Arayüz

**Yeni sekme: "Finans"** (`TabType`'a `'finance'`, ikon `Wallet`, açıklama "Gelir, Tahsilat & Gider").
İçinde alt sekmeler:

1. **Özet** — yıl seçici (varsayılan bu yıl) + kartlar:
   Satış (dönem ücretleri) · Tahsil edilen · Bekleyen alacak · Gider · **Net kâr (tahsilat − gider)**.
   Altında ürün bazlı tablo: Ürün | Satış | Tahsilat | Alacak | Gider | Net. Genel giderler ayrı satır.
   Ayrıca "Yaklaşan yenilemeler" listesi: önümüzdeki 60 gün içinde bitecek ücretli lisanslar, son fiyat ve %X artışla önerilen fiyat.
2. **Lisans Ücretleri** — lisans başına satır: Firma | Ürün | Dönem | Ücret (orijinal + TL) | Ödenen | Kalan | durum rozeti (Ödendi / Kısmi / Ödenmedi). Satırdan: dönem ücreti düzenle, ödeme ekle, ödeme geçmişi. Firma adına göre filtre/arama.
3. **Ödemeler** — tüm ödemeler listesi, ekle/düzenle/sil.
4. **Giderler** — gider listesi, ekle/düzenle/sil, ürün ve kategori filtresi.

**Mevcut ekranlara eklemeler**
- `LicenseGenerator.tsx`: opsiyonel "Ücret" bölümü (tutar, para birimi, kur). Lisans başarıyla oluşunca `finance_periods`'a `source:'create'` kaydı yazılır. Boş bırakılırsa kayıt yazılmaz.
- `ExtendLicenseModal.tsx`: "Yeni dönem ücreti" bölümü. Lisansın son dönem ücreti varsayılan gelir, yanında "% artış" kutusu → yeni tutar otomatik hesaplanır (elle de değiştirilebilir). Uzatma başarılı olunca `source:'extend'` dönem kaydı yazılır.
- `LicenseManageModal.tsx`: "Finans" bölümü/sekmesi — o lisansın dönemleri ve ödemeleri, "dönem ücreti ekle" (eski lisanslar için `source:'manual'`), "ödeme ekle".

Finans kaydı yazımı başarısız olursa lisans işlemi geri alınmaz; kullanıcıya "Lisans oluşturuldu ancak ücret kaydedilemedi — Finans sekmesinden ekleyin" uyarısı gösterilir.

## 8. Kod Yapısı (öneri, builder'a açık)

- `src/types/finance.ts` — tipler
- `src/services/financeApi.ts` — Firestore CRUD (3 koleksiyon), `fetchFxRate()`, rapor hesaplama yardımcıları (saf fonksiyonlar)
- `src/components/finance/` — `FinanceView.tsx` (alt sekmeler) + alt bileşenler + ortak `MoneyInput.tsx` (tutar/para birimi/kur alanı)
- Finans verisi `FinanceView` açıkken `onSnapshot` ile dinlenir (App.tsx'teki lisans dinleyicisi gibi); global App state'ine eklenmesi gerekmiyor.
- Para formatı: `Intl.NumberFormat('tr-TR', { style:'currency', currency })`.

## 9. Kullanıcının Kararları

- Fiyat lisans başına, elle; firmaya göre farklı olabilir; dönem lisansın açıldığı süre.
- Giderler: uygulamalar için satın alınan hizmetler.
- Çoklu para birimi, sonuçlar TL.
- Kur: Yaklaşım A.
- Kalan tüm kararları (kur farkı, yıl kuralı, iptal/silme davranışı, §10) kullanıcı bana bıraktı
  ("hepsini sen ayarla"); §5'teki kurallar benim önerilerimdir.

## 10. Builder'a Bırakılanlar / Benim Varsayımlarım

- Ödemeler lisansa bağlı (toplu firma ödemesi yok — gerekirse her lisansa bölünerek girilir).
- Firma = lisanstaki `customer` metni (büyük/küçük harf ve boşluk normalize edilerek gruplanır).
- Net kâr tahsilat bazlı (nakit esası); satış/alacak ayrıca gösterilir.
- Desteklenen para birimleri: TRY, USD, EUR.
- "Yaklaşan yenilemeler" penceresi 60 gün, varsayılan önerilen artış %0 (kutudan değiştirilebilir).
- Firestore kuralları mevcut haliyle açık (bilinen risk, kapsam dışı) — yeni koleksiyonlar da açık olacak.
- Alt bileşen bölünmesi, stil detayları, boş durum ekranları builder'ın takdirinde; mevcut panel görünümüyle uyumlu olmalı.
