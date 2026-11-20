import type { Currency } from '../types/finance';

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<any> }>;

/**
 * Verilen tarihteki döviz → TL kurunu getirir (frankfurter.app / ECB verisi).
 * Hafta sonu/tatil için API son iş gününün kurunu ve tarihini döndürür.
 * Başarısızlıkta null döner — çağıran "Kur alınamadı, elle girin." uyarısını gösterir.
 */
export async function fetchFxRate(
  currency: Currency,
  date: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<{ rate: number; date: string } | null> {
  if (currency === 'TRY') return { rate: 1, date };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetchImpl(`https://api.frankfurter.app/${date}?from=${currency}&to=TRY`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({ message: 'Kur servisi yanıtı okunamadı (JSON parse hatası).' }));
    const rate = data?.rates?.TRY;
    if (typeof rate !== 'number' || !(rate > 0)) return null;
    return { rate, date: typeof data.date === 'string' ? data.date : date };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
