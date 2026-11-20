import type { Currency } from '../../types/finance';

/**
 * Kullanıcı tutar girişini sayıya çevirir. "1.500,50" (Türkçe), "1500.5", "2.000" (binlik) desteklenir.
 * Boş, sayısal olmayan, sıfır veya negatif değer → null.
 */
export function parseTrAmount(s: string): number | null {
  let t = s.trim().replace(/\s/g, '');
  if (!t || !/^[0-9.,]+$/.test(t)) return null;

  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ''); // yalnız binlik ayraçlı: "2.000"
  }
  if ((t.match(/\./g) || []).length > 1) return null;

  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

const formatters = new Map<Currency, Intl.NumberFormat>();

export function formatMoney(n: number, currency: Currency = 'TRY'): string {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', { style: 'currency', currency });
    formatters.set(currency, f);
  }
  return f.format(n);
}

/** ISO/tarih string'ini YYYY-MM-DD'ye indirger. */
export const toDateInput = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');

export const todayStr = (): string => new Date().toISOString().slice(0, 10);

export const formatDate = (d: string | null | undefined): string =>
  d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('tr-TR') : '-';

// Ortak Tailwind sınıfları (mevcut panel formlarıyla uyumlu)
export const inputCls =
  'w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-sm text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] outline-none transition disabled:bg-slate-50';
export const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1.5';
export const btnPrimary =
  'px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
export const btnSecondary =
  'px-4 py-2 bg-white border border-[#cbd5e1] hover:bg-slate-50 text-[#334155] rounded-lg text-sm font-semibold transition';
export const cardCls = 'bg-white border border-[#e2e8f0] rounded-xl shadow-sm';
