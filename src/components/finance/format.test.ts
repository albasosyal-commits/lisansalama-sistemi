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
