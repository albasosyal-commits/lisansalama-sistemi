# Finans Modülü Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lisans paneline lisans ücreti (dönem), tahsilat, gider takibi ve TL bazlı finans raporu ekleyen "Finans" sekmesi.

**Architecture:** Tamamen tarayıcı tarafı. Üç yeni Firestore koleksiyonu (`finance_periods`, `finance_payments`, `finance_expenses`) client SDK ile doğrudan okunur/yazılır; `licenses` dokümanlarına finans verisi yazılmaz. Tüm hesaplama saf fonksiyonlarda (`financeCalc.ts`), birim testli. Kur, kayıt anında frankfurter.app'ten alınıp kayıtla sabitlenir.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind 4, lucide-react, Firestore client SDK (`firebase/firestore`), Vitest (yeni dev dependency).

**Spec:** `docs/superpowers/specs/2026-11-20-finans-modulu-design.md`

## Global Constraints

- Tüm UI metinleri ve hata mesajları **Türkçe**.
- Para birimleri yalnız `'TRY' | 'USD' | 'EUR'`; tüm toplamlar TL (`amount_try`).
- Kur API: `https://api.frankfurter.app/{YYYY-MM-DD}?from={USD|EUR}&to=TRY`, 5 sn timeout; fetch `res.json().catch(() => ({ message: '...' }))` desenini izler.
- Finans verisi **asla** `licenses` koleksiyonuna yazılmaz; `api.createLicense/extendLicense/deleteLicense` imzaları değişmez.
- Yeni `/api/*` sunucu ucu eklenmez.
- Para gösterimi: `Intl.NumberFormat('tr-TR', { style: 'currency', currency })`.
- Para tutarları 2 ondalığa yuvarlanır (`Math.round(x * 100) / 100`).
- Finans kaydı yazımı başarısız olursa lisans işlemi geri alınmaz; uyarı: `"Lisans oluşturuldu ancak ücret kaydedilemedi — Finans sekmesinden ekleyin."` (uzatmada "Lisans uzatıldı ancak…").
- **Dal:** `feature/finans` üzerinde çalış. `.git/hooks/post-commit` her commit'te `git push origin HEAD` yapar — `main`'e commit atmak Vercel prod deploy'u tetikler. `main`'e birleştirme yalnız kullanıcı onayıyla.
- Doğrulama: `npm test` (vitest) + `npm run lint` (tsc). UI görevleri ayrıca `npm run dev` ile elle kontrol edilir.

## Review Focus

1. **Lisansın hiç dönemi yokken ödeme ekleme** → ödeme formu açılmaz, "Önce dönem ücreti girin" mesajı ve dönem ekleme formu gösterilir. (Task 5)
2. **Kur alınamadı (ağ hatası / hafta sonu / timeout)** → kur alanı boş, uyarı görünür, Kaydet devre dışı; hafta sonu tarihinde frankfurter son iş gününü döndürür, `fx_date` dönen tarih olur. (Task 2 testleri)
3. **Silinmiş lisansa ait dönem/ödeme** → raporlarda "(silinmiş lisans)" etiketiyle, `customer` kopyasıyla görünür, çökme yok. (Task 1 `buildSummary` testi + Task 5)
4. **Ayın 31'inde başlayan aylık gider** → kısa aylarda ay sonuna sabitlenir (31 Oca → 28/29 Şub). (Task 1 testi)
5. **Tutara virgüllü giriş (`1.500,50`)** → Türkçe giriş 1500.50 olarak ayrıştırılır; geçersiz giriş Kaydet'i kapatır. (Task 3 `parseTrAmount` testi)

---

### Task 1: Tipler, Vitest kurulumu ve hesaplama çekirdeği

**Files:**
- Create: `src/types/finance.ts`, `src/services/financeCalc.ts`, `src/services/financeCalc.test.ts`
- Modify: `package.json` (devDependency `vitest@^3`, script `"test": "vitest run"`)

**Interfaces:**
- Produces (`src/types/finance.ts`):
  ```ts
  export type Currency = 'TRY' | 'USD' | 'EUR';
  export interface MoneyFields { amount: number; currency: Currency; fx_rate: number; fx_date: string; fx_source: 'auto' | 'manual'; amount_try: number; }
  export interface FinancePeriod extends MoneyFields { id: string; license_id: string; product_id: string; customer: string; period_start: string; period_end: string; increase_pct: number | null; source: 'create' | 'extend' | 'manual'; written_off: boolean; written_off_at: string | null; notes?: string; created_at: string; updated_at: string; }
  export interface FinancePayment extends MoneyFields { id: string; license_id: string; period_id: string; customer: string; product_id: string; paid_at: string; method: 'havale' | 'nakit' | 'kart' | 'diger'; notes?: string; created_at: string; }
  export interface FinanceExpense extends MoneyFields { id: string; title: string; category: string; product_id: string | null; spent_at: string; recurrence: 'none' | 'monthly' | 'yearly'; recurrence_end: string | null; notes?: string; created_at: string; }
  export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'written_off';
  export interface PeriodBalance { paid: number; remaining: number; remainingTry: number; status: PaymentStatus; fxDiffTry: number; }
  export interface ProductFinanceRow { product_id: string | null; sales: number; collected: number; receivable: number; expense: number; net: number; }
  export interface FinanceSummary { sales: number; collected: number; receivable: number; expense: number; net: number; fxDiff: number; byProduct: ProductFinanceRow[]; }
  ```
- Produces (`src/services/financeCalc.ts`):
  - `round2(n: number): number`
  - `toMoney(amount: number, currency: Currency, fx_rate: number, fx_date: string, fx_source: 'auto'|'manual'): MoneyFields` — TRY ise `fx_rate=1`.
  - `applyIncrease(amount: number, pct: number): number`
  - `periodBalance(period: FinancePeriod, payments: FinancePayment[]): PeriodBalance` — yalnız `payment.period_id === period.id` olanları sayar.
  - `expandExpense(e: FinanceExpense, from: string, to: string): { date: string; amount_try: number }[]` — tarihler `YYYY-MM-DD`, aralık kapalı.
  - `buildSummary(periods: FinancePeriod[], payments: FinancePayment[], expenses: FinanceExpense[], year: number): FinanceSummary` — `byProduct`'ta `product_id: null` = genel gider satırı.
  - `normalizeCustomer(s: string): string` — trim, çoklu boşluk → tek, `toLocaleLowerCase('tr-TR')`.

- [ ] **Step 1: Dalı oluştur, vitest'i kur**

Run: `git checkout -b feature/finans && npm install -D vitest@^3` ; package.json'a `"test": "vitest run"` ekle.

- [ ] **Step 2: Failing testleri yaz** (`src/services/financeCalc.test.ts`)

```ts
const usdPeriod = mkPeriod({ id: 'p1', amount: 1000, currency: 'USD', fx_rate: 34, amount_try: 34000, period_start: '2026-11-10', product_id: 'A' });
const pay = (o) => mkPayment({ period_id: 'p1', currency: 'USD', product_id: 'A', ...o });

test('toMoney TRY kuru 1', () => expect(toMoney(1500.505, 'TRY', 99, '2026-01-01', 'auto')).toMatchObject({ fx_rate: 1, amount_try: 1500.51 }));
test('toMoney USD', () => expect(toMoney(1000, 'USD', 34.25, '2026-01-01', 'auto').amount_try).toBe(34250));
test('applyIncrease', () => { expect(applyIncrease(1000, 20)).toBe(1200); expect(applyIncrease(999.99, 7.5)).toBe(1074.99); });
test('tam ödeme kendi para biriminde ödendi + kur farkı', () => {
  expect(periodBalance(usdPeriod, [pay({ amount: 1000, fx_rate: 36, amount_try: 36000 })])).toEqual({ paid: 1000, remaining: 0, remainingTry: 0, status: 'paid', fxDiffTry: 2000 });
});
test('kısmi ödeme', () => {
  expect(periodBalance(usdPeriod, [pay({ amount: 400, fx_rate: 36, amount_try: 14400 })])).toEqual({ paid: 400, remaining: 600, remainingTry: 20400, status: 'partial', fxDiffTry: 800 });
});
test('ödenmemiş / başka döneme ait ödeme sayılmaz', () => expect(periodBalance(usdPeriod, [pay({ period_id: 'x', amount: 1000, amount_try: 36000 })]).status).toBe('unpaid'));
test('alacaktan düşülen', () => expect(periodBalance({ ...usdPeriod, written_off: true }, [])).toMatchObject({ status: 'written_off', remainingTry: 0 }));
test('aylık gider yıl içinde 12 kez', () => expect(expandExpense(mkExpense({ spent_at: '2025-11-15', recurrence: 'monthly', amount_try: 100 }), '2026-01-01', '2026-12-31')).toHaveLength(12));
test('aylık gider bitişte durur', () => expect(expandExpense(mkExpense({ spent_at: '2026-01-15', recurrence: 'monthly', recurrence_end: '2026-03-31' }), '2026-01-01', '2026-12-31').map(x => x.date)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']));
test('31inde başlayan aylık gider ay sonuna sabitlenir', () => expect(expandExpense(mkExpense({ spent_at: '2026-01-31', recurrence: 'monthly' }), '2026-01-01', '2026-03-31').map(x => x.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']));
test('yıllık ve tek seferlik', () => {
  expect(expandExpense(mkExpense({ spent_at: '2024-06-01', recurrence: 'yearly' }), '2026-01-01', '2026-12-31').map(x => x.date)).toEqual(['2026-06-01']);
  expect(expandExpense(mkExpense({ spent_at: '2025-06-01', recurrence: 'none' }), '2026-01-01', '2026-12-31')).toEqual([]);
});
test('buildSummary: satış başlangıç yılına, alacak yıldan bağımsız, net = tahsilat - gider', () => {
  const p2025 = mkPeriod({ id: 'p0', amount: 500, currency: 'TRY', amount_try: 500, fx_rate: 1, period_start: '2025-03-01', product_id: 'A' });
  const s = buildSummary([usdPeriod, p2025], [pay({ amount: 400, fx_rate: 36, amount_try: 14400, paid_at: '2026-12-01' })],
    [mkExpense({ product_id: null, spent_at: '2026-02-01', amount_try: 1000 }), mkExpense({ product_id: 'A', spent_at: '2026-02-01', amount_try: 400 })], 2026);
  expect(s).toMatchObject({ sales: 34000, collected: 14400, receivable: 20400 + 500, expense: 1400, net: 13000, fxDiff: 800 });
  expect(s.byProduct.find(r => r.product_id === null)).toMatchObject({ expense: 1000 });
  expect(s.byProduct.find(r => r.product_id === 'A')).toMatchObject({ sales: 34000, collected: 14400, expense: 400, net: 14000 });
});
test('normalizeCustomer', () => expect(normalizeCustomer('  ABC   İnşaat ')).toBe('abc inşaat'));
```
`mkPeriod/mkPayment/mkExpense` test dosyasındaki varsayılanlı fabrika fonksiyonları (TRY, rate 1, `written_off:false`, `recurrence:'none'`, `recurrence_end:null`, `paid_at:'2026-01-01'`).

- [ ] **Step 3: Testlerin başarısız olduğunu gör** — Run: `npm test` → FAIL (modül yok).
- [ ] **Step 4: `src/types/finance.ts` ve `src/services/financeCalc.ts`'yi yaz.** Tarih aritmetiği UTC string üzerinden (`YYYY-MM-DD`), saat dilimi kayması olmasın. Kur farkı: `Σ payment.amount_try − paid × period.fx_rate`. Durum önceliği: `written_off` > `remaining <= 0 → paid` > `paid > 0 → partial` > `unpaid`.
- [ ] **Step 5: Testler geçer** — Run: `npm test` → PASS; `npm run lint` → hata yok.
- [ ] **Step 6: Commit** — `git add package.json package-lock.json src/types/finance.ts src/services/financeCalc*.ts && git commit -m "feat(finans): tipler ve hesaplama cekirdegi"`

### Task 2: Firestore servis katmanı ve kur getirme

**Files:**
- Create: `src/services/fxRate.ts`, `src/services/fxRate.test.ts`, `src/services/financeApi.ts`

**Interfaces:**
- Consumes: Task 1 tipleri; `db` from `src/firebase.ts`.
- Produces:
  - `FINANCE_COLLECTIONS = { periods: 'finance_periods', payments: 'finance_payments', expenses: 'finance_expenses' } as const`
  - `fetchFxRate(currency: Currency, date: string, fetchImpl = fetch): Promise<{ rate: number; date: string } | null>` — TRY → `{rate:1,date}`; hata/timeout/geçersiz yanıt → `null`.
  - `financeApi.addPeriod(p: Omit<FinancePeriod,'id'|'created_at'|'updated_at'>): Promise<FinancePeriod>`, `updatePeriod(id: string, patch: Partial<FinancePeriod>): Promise<void>`, `deletePeriod(id)`
  - `financeApi.addPayment(p: Omit<FinancePayment,'id'|'created_at'>)`, `updatePayment(id, patch)`, `deletePayment(id)`
  - `financeApi.addExpense(e: Omit<FinanceExpense,'id'|'created_at'>)`, `updateExpense(id, patch)`, `deleteExpense(id)`
  - `subscribeFinance(cb: (d: { periods: FinancePeriod[]; payments: FinancePayment[]; expenses: FinanceExpense[] }) => void, onError: (e: Error) => void): () => void` — 3 `onSnapshot`; dönen fonksiyon hepsini kapatır.
  - Yazmalar `addDoc`/`updateDoc` (hedefli; `undefined` alanlar çıkarılır), id = Firestore doc id.

- [ ] **Step 1: Failing testler** (`fetchFxRate`, sahte `fetchImpl` ile):
```ts
test('TRY ağ çağrısı yapmaz', async () => { const f = vi.fn(); expect(await fetchFxRate('TRY', '2026-03-01', f)).toEqual({ rate: 1, date: '2026-03-01' }); expect(f).not.toHaveBeenCalled(); });
test('USD kuru ve dönen tarih', async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ date: '2026-02-27', rates: { TRY: 36.1234 } }) });
  expect(await fetchFxRate('USD', '2026-03-01', f)).toEqual({ rate: 36.1234, date: '2026-02-27' });
  expect(f.mock.calls[0][0]).toBe('https://api.frankfurter.app/2026-03-01?from=USD&to=TRY');
});
test('hata → null', async () => { expect(await fetchFxRate('EUR', '2026-03-01', vi.fn().mockRejectedValue(new Error('x')))).toBeNull(); });
test('bozuk JSON → null', async () => { expect(await fetchFxRate('EUR', '2026-03-01', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error(); } }))).toBeNull(); });
test('ok=false → null', async () => { expect(await fetchFxRate('EUR', '2026-03-01', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))).toBeNull(); });
```
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: `financeApi.ts`'yi yaz.** Timeout `AbortController` ile 5000 ms. Firestore importu test ortamında Firebase'i başlatmamalı — `fetchFxRate`'i firebase importu olmayan `src/services/fxRate.ts`'ye koy, `financeApi.ts` onu re-export etsin; test `fxRate.ts`'yi import etsin (dosya adı buna göre `fxRate.test.ts`).
- [ ] **Step 4:** `npm test` → PASS; `npm run lint` → temiz.
- [ ] **Step 5: Commit** — `git commit -m "feat(finans): firestore servis katmani ve kur getirme"`

### Task 3: Ortak UI parçaları — MoneyInput ve useFinanceData

**Files:**
- Create: `src/components/finance/MoneyInput.tsx`, `src/components/finance/format.ts`, `src/components/finance/format.test.ts`, `src/components/finance/useFinanceData.ts`

**Interfaces:**
- Produces:
  - `parseTrAmount(s: string): number | null` — `"1.500,50"`→1500.5, `"1500.5"`→1500.5, `"1500"`→1500, `""`/`"abc"`/negatif→`null`.
  - `formatMoney(n: number, currency: Currency = 'TRY'): string`
  - `<MoneyInput value: MoneyFields | null onChange: (m: MoneyFields | null) => void date: string lockedCurrency?: Currency label?: string />` — tutar + para birimi seçici + kur alanı. Para birimi/tarih değişince `fetchFxRate` çağırır (yükleniyor göstergesi), başarısızsa uyarı `"Kur alınamadı, elle girin."`; kur elle değişirse `fx_source='manual'`. Geçersizse `onChange(null)` → formlar Kaydet'i kapatır. TRY'de kur alanı gizli.
  - `useFinanceData(): { periods; payments; expenses; loading: boolean; error: string | null }` — `subscribeFinance` ile.

- [ ] **Step 1: Failing test** `format.test.ts`: yukarıdaki `parseTrAmount` örnekleri + `formatMoney(1500.5)` `'₺'` ve `'1.500,50'` içerir.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** `format.ts`, `MoneyInput.tsx`, `useFinanceData.ts`'yi yaz. Stil: mevcut formlardaki Tailwind sınıfları (`LicenseGenerator.tsx` input stilleri).
- [ ] **Step 4:** `npm test` + `npm run lint` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(finans): MoneyInput ve finans veri kancasi"`

### Task 4: Finans sekmesi iskeleti ve Özet

**Files:**
- Create: `src/components/finance/FinanceView.tsx`, `src/components/finance/FinanceSummaryTab.tsx`
- Modify: `src/components/Navbar.tsx:23` (`TabType`'a `'finance'`), `:45-50` (menü öğesi `{ id: 'finance', label: 'Finans', icon: Wallet, desc: 'Gelir, Tahsilat & Gider' }`, `account`'tan önce), `:200-207` (`finance: { title: 'Finans', subtitle: 'Lisans ücretleri, tahsilat, giderler ve kâr' }`); `src/App.tsx:~235` (`{activeTab === 'finance' && <FinanceView licenses={licenses} products={products} />}`)

**Interfaces:**
- Consumes: `useFinanceData`, `buildSummary`, `periodBalance`, `applyIncrease`, `formatMoney`; App'teki mevcut `licenses: StoredLicense[]`, `products: Product[]` state'leri.
- Produces: `FinanceView` props `{ licenses: StoredLicense[]; products: Product[] }`; alt sekme state'i `'summary' | 'periods' | 'payments' | 'expenses'`.

- [ ] **Step 1: Uygula.** Özet: yıl seçici (veride geçen yıllar + bu yıl, varsayılan bu yıl), 6 kart (Satış, Tahsil Edilen, Bekleyen Alacak — altında "bugün itibarıyla" notu, Gider, Net Kâr, Kur Farkı), ürün tablosu (ürün adı `products`'tan; bulunamazsa product_id; `null` → "Genel giderler"). "Yaklaşan yenilemeler": `expires_at` bugün ile +60 gün arasında, `status !== 'revoked'`, en az bir dönemi olan lisanslar; son dönem tutarı ve "% artış" kutusu (varsayılan 0) ile `applyIncrease` sonucu.
- [ ] **Step 2:** `npm run lint` → temiz.
- [ ] **Step 3: Elle doğrula:** `npm run dev`, Finans sekmesi açılır, boş veride kartlar 0 ₺, konsolda hata yok.
- [ ] **Step 4: Commit** — `git commit -m "feat(finans): Finans sekmesi ve ozet raporu"`

### Task 5: Lisans Ücretleri ve Ödemeler alt sekmeleri

**Files:**
- Create: `src/components/finance/PeriodForm.tsx`, `src/components/finance/PaymentForm.tsx`, `src/components/finance/PeriodsTab.tsx`, `src/components/finance/PaymentsTab.tsx`
- Modify: `src/components/finance/FinanceView.tsx`

**Interfaces:**
- Produces:
  - `<PeriodForm license: StoredLicense | null period?: FinancePeriod onSaved: () => void onClose: () => void />` — yeni (`source:'manual'`, varsayılan `period_start=issued_at`, `period_end=expires_at`) veya düzenleme.
  - `<PaymentForm license: StoredLicense | null periods: FinancePeriod[] payment?: FinancePayment onSaved onClose />` — dönem seçici (varsayılan kalanı olan en eski dönem), para birimi dönemin para birimine kilitli (`lockedCurrency`), `paid_at` varsayılan bugün, yöntem seçici. `periods` boşsa form yerine "Önce dönem ücreti girin." + PeriodForm'a geçiş butonu.
  - Silinmiş lisans için `license=null`; `customer`/`product_id` dönemden alınır.

- [ ] **Step 1: Uygula.** PeriodsTab: satır = dönem; sütunlar Firma | Ürün | Dönem | Ücret (orijinal + TL) | Ödenen | Kalan | rozet (Ödendi yeşil / Kısmi sarı / Ödenmedi kırmızı / Alacaktan düşüldü gri); lisans `licenses`'ta yoksa firma adının yanında "(silinmiş lisans)". Eylemler: Ödeme ekle, Düzenle, Alacaktan düş / Geri al (`updatePeriod(id, { written_off, written_off_at })`), Sil (`ConfirmModal` ile; döneme bağlı ödeme varsa silme engellenir: "Bu döneme ait ödemeler var, önce onları silin."). Firma arama (`normalizeCustomer` ile). PaymentsTab: tarih azalan liste, düzenle/sil (ConfirmModal).
- [ ] **Step 2:** `npm run lint` → temiz.
- [ ] **Step 3: Elle doğrula:** Mevcut bir lisansa 1000 USD dönem ekle (kur otomatik dolmalı) → 400 USD ödeme → rozet Kısmi, kalan 600 $ → 600 USD ödeme → Ödendi, Özet'te Kur Farkı görünür. Dönemi olmayan lisansta ödeme ekle → "Önce dönem ücreti girin." Ağ kapalıyken USD seç → "Kur alınamadı, elle girin.", Kaydet kapalı.
- [ ] **Step 4: Commit** — `git commit -m "feat(finans): lisans ucretleri ve odemeler"`

### Task 6: Giderler alt sekmesi

**Files:**
- Create: `src/components/finance/ExpenseForm.tsx`, `src/components/finance/ExpensesTab.tsx`
- Modify: `src/components/finance/FinanceView.tsx`

**Interfaces:**
- Produces: `<ExpenseForm products: Product[] expense?: FinanceExpense onSaved onClose />` — başlık (zorunlu), kategori (serbest metin, öneri listesi `datalist`: Sunucu, Hosting, Alan adı, Veritabanı, Abonelik, Diğer), ürün seçici ("Genel / tüm uygulamalar" = null), tarih, tekrar (Tek seferlik / Aylık / Yıllık), tekrarlıysa opsiyonel bitiş tarihi, MoneyInput, not.

- [ ] **Step 1: Uygula.** ExpensesTab: liste (başlık, kategori, ürün, tarih, tekrar rozeti, tutar orijinal + TL), ürün ve kategori filtresi, seçili yılın toplamı (`expandExpense` ile yıl aralığı), düzenle/sil (ConfirmModal).
- [ ] **Step 2:** `npm run lint` → temiz.
- [ ] **Step 3: Elle doğrula:** Aylık 20 USD "Sunucu" gideri ekle (ocak başlangıçlı) → Özet'te gider 12 × TL karşılığı; ürünsüz gider "Genel giderler" satırında.
- [ ] **Step 4: Commit** — `git commit -m "feat(finans): giderler"`

### Task 7: Lisans oluşturma, uzatma ve yönetim penceresine entegrasyon

**Files:**
- Modify: `src/components/LicenseGenerator.tsx` (state + form bölümü + `handleGenerate` içinde `api.createLicense` sonrası, ~satır 140), `src/components/ExtendLicenseModal.tsx` (state + bölüm + `handleExtend` ~satır 70), `src/components/LicenseManageModal.tsx` (yeni "Finans" bölümü)

**Interfaces:**
- Consumes: `MoneyInput`, `financeApi.addPeriod`, `applyIncrease`, `periodBalance`, `PeriodForm`, `PaymentForm`, `useFinanceData`.

- [ ] **Step 1: LicenseGenerator.** Opsiyonel "Ücret" bölümü (MoneyInput, tarih = lisans başlangıcı). Lisans oluşunca, ücret girilmişse `addPeriod({ license_id, product_id, customer, period_start: license.issued_at, period_end: license.expires_at, source: 'create', increase_pct: null, written_off: false, written_off_at: null, ...money })`. Hata → ekranda Global Constraints'teki uyarı; lisans sonucu yine gösterilir. Ücret boşsa yazma yok.
- [ ] **Step 2: ExtendLicenseModal.** "Yeni dönem ücreti" bölümü: lisansın en son (`period_end` en büyük) dönemi varsa tutar ve para birimi önceden dolu, "% artış" kutusu (varsayılan 0) değişince tutar = `applyIncrease(son.amount, pct)`; kullanıcı tutarı elle değiştirebilir. Uzatma başarılıysa ve ücret girilmişse `addPeriod({ period_start: license.expires_at /* eski */, period_end: updated.expires_at, source: 'extend', increase_pct: pct || null, ... })`. Kur tarihi = uzatma günü (bugün).
- [ ] **Step 3: LicenseManageModal.** "Finans" bölümü: o lisansın dönemleri (rozetli) ve ödemeleri, "Dönem ücreti ekle" ve "Ödeme ekle" butonları (Task 5 formları).
- [ ] **Step 4:** `npm test` + `npm run lint` → PASS.
- [ ] **Step 5: Elle doğrula:** Ücretli yıllık lisans oluştur → Finans > Lisans Ücretleri'nde görünür. Ücretsiz lisans → dönem kaydı yok. Uzat, %20 → yeni tutar 1,2×, iki dönem listelenir, `period_start` eski bitiş tarihi. Lisans RSA anahtarı ve doğrulama (Doğrulama sandbox'ı) eskisi gibi çalışır. Lisansı sil → dönemleri "(silinmiş lisans)" ile kalır.
- [ ] **Step 6: Commit** — `git commit -m "feat(finans): lisans olusturma/uzatma/yonetim entegrasyonu"`

### Task 8: Belgeler ve son kontrol

**Files:**
- Modify: `CLAUDE.md` (Veri Modeli'ne 3 koleksiyon, Dizin Yapısı'na `src/components/finance/`, Geliştirme Komutları'na `npm test`; "Test altyapısı yok" ifadelerini Vitest ile güncelle), `GECMIS.md` (yeni bölüm: Finans modülü)

- [ ] **Step 1:** Belgeleri güncelle.
- [ ] **Step 2:** `npm test`, `npm run lint`, `npm run build` → hepsi başarılı.
- [ ] **Step 3: Commit** — `git commit -m "docs: finans modulu belgelendi"` (dal Vercel preview'a gider; `main`'e birleştirme kullanıcı onayıyla).
