import { describe, expect, test } from 'vitest';
import type { FinanceExpense, FinancePayment, FinancePeriod } from '../types/finance';
import {
  applyIncrease,
  buildSummary,
  expandExpense,
  normalizeCustomer,
  periodBalance,
  toMoney,
} from './financeCalc';

const money = { amount: 0, currency: 'TRY' as const, fx_rate: 1, fx_date: '2026-01-01', fx_source: 'auto' as const, amount_try: 0 };

const mkPeriod = (o: Partial<FinancePeriod>): FinancePeriod => ({
  ...money,
  id: 'p',
  license_id: 'L1',
  product_id: 'A',
  customer: 'Firma',
  period_start: '2026-01-01',
  period_end: '2027-01-01',
  increase_pct: null,
  source: 'manual',
  written_off: false,
  written_off_at: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  ...o,
});

const mkPayment = (o: Partial<FinancePayment>): FinancePayment => ({
  ...money,
  id: 'pay',
  license_id: 'L1',
  period_id: 'p',
  customer: 'Firma',
  product_id: 'A',
  paid_at: '2026-01-01',
  method: 'havale',
  created_at: '2026-01-01',
  ...o,
});

const mkExpense = (o: Partial<FinanceExpense>): FinanceExpense => ({
  ...money,
  amount: 100,
  amount_try: 100,
  id: 'e',
  title: 'Sunucu',
  category: 'Sunucu',
  product_id: null,
  spent_at: '2026-01-01',
  recurrence: 'none',
  recurrence_end: null,
  created_at: '2026-01-01',
  ...o,
});

const usdPeriod = mkPeriod({ id: 'p1', amount: 1000, currency: 'USD', fx_rate: 34, amount_try: 34000, period_start: '2026-11-10', product_id: 'A' });
const pay = (o: Partial<FinancePayment>) => mkPayment({ period_id: 'p1', currency: 'USD', product_id: 'A', ...o });

describe('toMoney', () => {
  test('TRY kuru 1', () => expect(toMoney(1500.505, 'TRY', 99, '2026-01-01', 'auto')).toMatchObject({ fx_rate: 1, amount_try: 1500.51 }));
  test('USD', () => expect(toMoney(1000, 'USD', 34.25, '2026-01-01', 'auto').amount_try).toBe(34250));
});

test('applyIncrease', () => {
  expect(applyIncrease(1000, 20)).toBe(1200);
  expect(applyIncrease(999.99, 7.5)).toBe(1074.99);
});

describe('periodBalance', () => {
  test('tam ödeme kendi para biriminde ödendi + kur farkı', () => {
    expect(periodBalance(usdPeriod, [pay({ amount: 1000, fx_rate: 36, amount_try: 36000 })])).toEqual({
      paid: 1000, remaining: 0, remainingTry: 0, status: 'paid', fxDiffTry: 2000,
    });
  });
  test('kısmi ödeme', () => {
    expect(periodBalance(usdPeriod, [pay({ amount: 400, fx_rate: 36, amount_try: 14400 })])).toEqual({
      paid: 400, remaining: 600, remainingTry: 20400, status: 'partial', fxDiffTry: 800,
    });
  });
  test('başka döneme ait ödeme sayılmaz', () =>
    expect(periodBalance(usdPeriod, [pay({ period_id: 'x', amount: 1000, amount_try: 36000 })]).status).toBe('unpaid'));
  test('alacaktan düşülen', () =>
    expect(periodBalance({ ...usdPeriod, written_off: true }, [])).toMatchObject({ status: 'written_off', remainingTry: 0 }));
});

describe('expandExpense', () => {
  test('aylık gider yıl içinde 12 kez', () =>
    expect(expandExpense(mkExpense({ spent_at: '2025-11-15', recurrence: 'monthly', amount_try: 100 }), '2026-01-01', '2026-12-31')).toHaveLength(12));
  test('aylık gider bitişte durur', () =>
    expect(expandExpense(mkExpense({ spent_at: '2026-01-15', recurrence: 'monthly', recurrence_end: '2026-03-31' }), '2026-01-01', '2026-12-31').map(x => x.date))
      .toEqual(['2026-01-15', '2026-02-15', '2026-03-15']));
  test('31inde başlayan aylık gider ay sonuna sabitlenir', () =>
    expect(expandExpense(mkExpense({ spent_at: '2026-01-31', recurrence: 'monthly' }), '2026-01-01', '2026-03-31').map(x => x.date))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31']));
  test('yıllık ve tek seferlik', () => {
    expect(expandExpense(mkExpense({ spent_at: '2024-06-01', recurrence: 'yearly' }), '2026-01-01', '2026-12-31').map(x => x.date)).toEqual(['2026-06-01']);
    expect(expandExpense(mkExpense({ spent_at: '2025-06-01', recurrence: 'none' }), '2026-01-01', '2026-12-31')).toEqual([]);
  });
});

test('buildSummary: satış başlangıç yılına, alacak yıldan bağımsız, net = tahsilat - gider', () => {
  const p2025 = mkPeriod({ id: 'p0', amount: 500, currency: 'TRY', amount_try: 500, fx_rate: 1, period_start: '2025-03-01', product_id: 'A' });
  const s = buildSummary(
    [usdPeriod, p2025],
    [pay({ amount: 400, fx_rate: 36, amount_try: 14400, paid_at: '2026-12-01' })],
    [mkExpense({ product_id: null, spent_at: '2026-02-01', amount_try: 1000 }), mkExpense({ product_id: 'A', spent_at: '2026-02-01', amount_try: 400 })],
    2026,
  );
  expect(s).toMatchObject({ sales: 34000, collected: 14400, receivable: 20400 + 500, expense: 1400, net: 13000, fxDiff: 800 });
  expect(s.byProduct.find(r => r.product_id === null)).toMatchObject({ expense: 1000 });
  expect(s.byProduct.find(r => r.product_id === 'A')).toMatchObject({ sales: 34000, collected: 14400, expense: 400, net: 14000 });
});

test('normalizeCustomer', () => expect(normalizeCustomer('  ABC   İnşaat ')).toBe('abc inşaat'));

import { isPeriodCurrencyLocked } from './financeCalc';

test('isPeriodCurrencyLocked: ödemesi olan dönemin para birimi kilitli', () => {
  expect(isPeriodCurrencyLocked(usdPeriod, [pay({ amount: 500, amount_try: 18000 })])).toBe(true);
  expect(isPeriodCurrencyLocked(usdPeriod, [pay({ period_id: 'baska' })])).toBe(false);
  expect(isPeriodCurrencyLocked(undefined, [])).toBe(false);
});
