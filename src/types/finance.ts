export type Currency = 'TRY' | 'USD' | 'EUR';

export const CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR'];

export interface MoneyFields {
  amount: number;
  currency: Currency;
  fx_rate: number;
  fx_date: string;
  fx_source: 'auto' | 'manual';
  amount_try: number;
}

export interface FinancePeriod extends MoneyFields {
  id: string;
  license_id: string;
  product_id: string;
  customer: string;
  period_start: string;
  period_end: string;
  increase_pct: number | null;
  source: 'create' | 'extend' | 'manual';
  written_off: boolean;
  written_off_at: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'havale' | 'nakit' | 'kart' | 'diger';

export interface FinancePayment extends MoneyFields {
  id: string;
  license_id: string;
  period_id: string;
  customer: string;
  product_id: string;
  paid_at: string;
  method: PaymentMethod;
  notes?: string;
  created_at: string;
}

export type Recurrence = 'none' | 'monthly' | 'yearly';

export interface FinanceExpense extends MoneyFields {
  id: string;
  title: string;
  category: string;
  product_id: string | null;
  spent_at: string;
  recurrence: Recurrence;
  recurrence_end: string | null;
  notes?: string;
  created_at: string;
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'written_off';

export interface PeriodBalance {
  paid: number;
  remaining: number;
  remainingTry: number;
  status: PaymentStatus;
  fxDiffTry: number;
}

export interface ProductFinanceRow {
  product_id: string | null;
  sales: number;
  collected: number;
  receivable: number;
  expense: number;
  net: number;
}

export interface FinanceSummary {
  sales: number;
  collected: number;
  receivable: number;
  expense: number;
  net: number;
  fxDiff: number;
  byProduct: ProductFinanceRow[];
}
