import { expect, test, vi } from 'vitest';
import { fetchFxRate } from './fxRate';

test('TRY ağ çağrısı yapmaz', async () => {
  const f = vi.fn();
  expect(await fetchFxRate('TRY', '2026-03-01', f)).toEqual({ rate: 1, date: '2026-03-01' });
  expect(f).not.toHaveBeenCalled();
});

test('USD kuru ve dönen tarih', async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ date: '2026-02-27', rates: { TRY: 36.1234 } }) });
  expect(await fetchFxRate('USD', '2026-03-01', f)).toEqual({ rate: 36.1234, date: '2026-02-27' });
  expect(f.mock.calls[0][0]).toBe('https://api.frankfurter.app/2026-03-01?from=USD&to=TRY');
});

test('ağ hatası → null', async () => {
  expect(await fetchFxRate('EUR', '2026-03-01', vi.fn().mockRejectedValue(new Error('x')))).toBeNull();
});

test('bozuk JSON → null', async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('bad'); } });
  expect(await fetchFxRate('EUR', '2026-03-01', f)).toBeNull();
});

test('ok=false → null', async () => {
  expect(await fetchFxRate('EUR', '2026-03-01', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))).toBeNull();
});

test('kur alanı yoksa → null', async () => {
  expect(await fetchFxRate('EUR', '2026-03-01', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: {} }) }))).toBeNull();
});
