import type { Product } from '../../types';
import type { PaymentStatus } from '../../types/finance';

export function productName(products: Product[], productId: string | null | undefined): string {
  if (!productId) return '-';
  const p = products.find(x => x.productId === productId || x.id === productId);
  return p ? p.name : productId;
}

export const STATUS_BADGE: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: 'Ödendi', cls: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]' },
  partial: { label: 'Kısmi', cls: 'bg-[#fef9c3] text-[#854d0e] border-[#fde68a]' },
  unpaid: { label: 'Ödenmedi', cls: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]' },
  written_off: { label: 'Alacaktan düşüldü', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const METHOD_LABEL: Record<string, string> = {
  havale: 'Havale/EFT',
  nakit: 'Nakit',
  kart: 'Kredi Kartı',
  diger: 'Diğer',
};
