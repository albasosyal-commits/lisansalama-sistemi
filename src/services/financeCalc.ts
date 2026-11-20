import type {
  Currency,
  FinanceExpense,
  FinancePayment,
  FinancePeriod,
  FinanceSummary,
  MoneyFields,
  PeriodBalance,
  ProductFinanceRow,
} from '../types/finance';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function toMoney(
  amount: number,
  currency: Currency,
  fx_rate: number,
  fx_date: string,
  fx_source: 'auto' | 'manual'
): MoneyFields {
  const rate = currency === 'TRY' ? 1 : fx_rate;
  const amt = round2(amount);
  return { amount: amt, currency, fx_rate: rate, fx_date, fx_source, amount_try: round2(amt * rate) };
}

export function applyIncrease(amount: number, pct: number): number {
  return round2(amount * (1 + pct / 100));
}

export function periodBalance(period: FinancePeriod, payments: FinancePayment[]): PeriodBalance {
  const own = payments.filter(p => p.period_id === period.id);
  const paid = round2(own.reduce((s, p) => s + p.amount, 0));
  const paidTry = own.reduce((s, p) => s + p.amount_try, 0);
  const fxDiffTry = round2(paidTry - paid * period.fx_rate);
  const remaining = round2(Math.max(0, period.amount - paid));

  if (period.written_off) return { paid, remaining, remainingTry: 0, status: 'written_off', fxDiffTry };
  const status = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  return { paid, remaining, remainingTry: round2(remaining * period.fx_rate), status, fxDiffTry };
}

// --- Tarih yardımcıları (YYYY-MM-DD, UTC; saat dilimi kayması olmasın) ---
const parts = (d: string) => d.slice(0, 10).split('-').map(Number) as [number, number, number];
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12
const fmt = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Gider kaydını [from, to] aralığına düşen gerçekleşmelere açar. */
export function expandExpense(e: FinanceExpense, from: string, to: string): { date: string; amount_try: number }[] {
  const [sy, sm, sd] = parts(e.spent_at);
  const end = e.recurrence_end && e.recurrence_end < to ? e.recurrence_end : to;
  const out: { date: string; amount_try: number }[] = [];
  const push = (date: string) => {
    if (date >= from && date <= end) out.push({ date, amount_try: e.amount_try });
  };

  if (e.recurrence === 'none') {
    push(fmt(sy, sm, sd));
    return out;
  }

  const stepMonths = e.recurrence === 'monthly' ? 1 : 12;
  for (let i = 0; ; i += stepMonths) {
    const total = sm - 1 + i;
    const y = sy + Math.floor(total / 12);
    const m = (total % 12) + 1;
    const date = fmt(y, m, Math.min(sd, daysInMonth(y, m)));
    if (date > end) break;
    push(date);
  }
  return out;
}

export function buildSummary(
  periods: FinancePeriod[],
  payments: FinancePayment[],
  expenses: FinanceExpense[],
  year: number
): FinanceSummary {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const inYear = (d: string) => d.slice(0, 4) === String(year);
  const rows = new Map<string | null, ProductFinanceRow>();
  const row = (pid: string | null) => {
    let r = rows.get(pid);
    if (!r) {
      r = { product_id: pid, sales: 0, collected: 0, receivable: 0, expense: 0, net: 0 };
      rows.set(pid, r);
    }
    return r;
  };

  let sales = 0, collected = 0, receivable = 0, expense = 0, fxDiff = 0;

  for (const p of periods) {
    const bal = periodBalance(p, payments);
    receivable += bal.remainingTry;
    row(p.product_id).receivable += bal.remainingTry;
    if (inYear(p.period_start)) {
      sales += p.amount_try;
      row(p.product_id).sales += p.amount_try;
    }
  }

  const periodRate = new Map(periods.map(p => [p.id, p.fx_rate]));
  for (const pay of payments) {
    if (!inYear(pay.paid_at)) continue;
    collected += pay.amount_try;
    row(pay.product_id).collected += pay.amount_try;
    const rate = periodRate.get(pay.period_id);
    if (rate !== undefined) fxDiff += pay.amount_try - pay.amount * rate;
  }

  for (const e of expenses) {
    const total = expandExpense(e, from, to).reduce((s, x) => s + x.amount_try, 0);
    if (total === 0) continue;
    expense += total;
    row(e.product_id).expense += total;
  }

  const byProduct = [...rows.values()].map(r => ({
    product_id: r.product_id,
    sales: round2(r.sales),
    collected: round2(r.collected),
    receivable: round2(r.receivable),
    expense: round2(r.expense),
    net: round2(r.collected - r.expense),
  }));

  return {
    sales: round2(sales),
    collected: round2(collected),
    receivable: round2(receivable),
    expense: round2(expense),
    net: round2(collected - expense),
    fxDiff: round2(fxDiff),
    byProduct,
  };
}

export function normalizeCustomer(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}
