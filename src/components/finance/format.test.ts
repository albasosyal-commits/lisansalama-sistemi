import { expect, test } from 'vitest';
import { formatMoney, parseTrAmount } from './format';

test('parseTrAmount Türkçe ve nokta ondalık', () => {
  expect(parseTrAmount('1.500,50')).toBe(1500.5);
  expect(parseTrAmount('1500.5')).toBe(1500.5);
  expect(parseTrAmount('1500')).toBe(1500);
  expect(parseTrAmount('1500,75')).toBe(1500.75);
  expect(parseTrAmount(' 2.000 ')).toBe(2000);
});

test('parseTrAmount geçersizler null', () => {
  expect(parseTrAmount('')).toBeNull();
  expect(parseTrAmount('abc')).toBeNull();
  expect(parseTrAmount('-5')).toBeNull();
  expect(parseTrAmount('0')).toBeNull();
});

test('formatMoney TL', () => {
  const s = formatMoney(1500.5);
  expect(s).toContain('₺');
  expect(s).toContain('1.500,50');
});

test('formatMoney USD', () => expect(formatMoney(10, 'USD')).toContain('$'));

import { parseRate, shouldAutoFetchRate } from './format';

test('parseRate: nokta her zaman ondalık (41.250 → 41.25)', () => {
  expect(parseRate('41.250')).toBe(41.25);
  expect(parseRate('41,25')).toBe(41.25);
  expect(parseRate('36')).toBe(36);
  expect(parseRate('1.234,5')).toBeNull();
  expect(parseRate('abc')).toBeNull();
  expect(parseRate('0')).toBeNull();
});

const usdInit = { amount: 1000, currency: 'USD' as const, fx_rate: 34, fx_date: '2026-03-02', fx_source: 'manual' as const, amount_try: 34000 };

test('shouldAutoFetchRate: kayıtlı dövizli değer, aynı para birimi ve tarih → getirme', () => {
  expect(shouldAutoFetchRate(usdInit, '2026-03-01', 'USD', '2026-03-01', false)).toBe(false);
});
test('shouldAutoFetchRate: tarih veya para birimi değişince getir', () => {
  expect(shouldAutoFetchRate(usdInit, '2026-03-01', 'USD', '2026-04-01', false)).toBe(true);
  expect(shouldAutoFetchRate(usdInit, '2026-03-01', 'EUR', '2026-03-01', false)).toBe(true);
});
test('shouldAutoFetchRate: yeni kayıt, refreshRate, TRY', () => {
  expect(shouldAutoFetchRate(null, '2026-03-01', 'USD', '2026-03-01', false)).toBe(true);
  expect(shouldAutoFetchRate(usdInit, '2026-03-01', 'USD', '2026-03-01', true)).toBe(true);
  expect(shouldAutoFetchRate(null, '2026-03-01', 'TRY', '2026-03-01', false)).toBe(false);
});
