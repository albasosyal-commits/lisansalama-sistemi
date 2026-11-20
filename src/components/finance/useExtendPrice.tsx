import React, { useEffect, useState } from 'react';
import type { StoredLicense } from '../../types';
import type { FinancePeriod, MoneyFields } from '../../types/finance';
import { financeApi } from '../../services/financeApi';
import { applyIncrease } from '../../services/financeCalc';
import { withTimeout } from '../../services/timeout';
import { MoneyInput } from './MoneyInput';
import { formatMoney, todayStr } from './format';

/**
 * Süre uzatma akışları için "yeni dönem ücreti" durumu + UI.
 * Hem ExtendLicenseModal hem LicenseManageModal'ın "Süre Uzat" sekmesi kullanır.
 */
export function useExtendPrice(license: StoredLicense) {
  const [withPrice, setWithPrice] = useState(false);
  const [lastPeriod, setLastPeriod] = useState<FinancePeriod | null>(null);
  const [increasePct, setIncreasePct] = useState('0');
  const [price, setPrice] = useState<MoneyFields | null>(null);
  const [seed, setSeed] = useState<MoneyFields | null>(null);

  useEffect(() => {
    let cancelled = false;
    financeApi
      .getPeriodsForLicense(license.license_id)
      .then(list => {
        if (cancelled || list.length === 0) return;
        const last = [...list].sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
        setLastPeriod(last);
        setWithPrice(true);
        setSeed({ ...last });
      })
      .catch(err => console.warn('Önceki dönem ücreti okunamadı:', err));
    return () => {
      cancelled = true;
    };
  }, [license.license_id]);

  const pctNumber = () => {
    const n = Number(increasePct.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const onIncreaseChange = (v: string) => {
    setIncreasePct(v);
    const n = Number(v.replace(',', '.'));
    if (lastPeriod && Number.isFinite(n)) setSeed({ ...lastPeriod, amount: applyIncrease(lastPeriod.amount, n) });
  };

  /** Uzatmadan önce çağrılır; hata mesajı veya null döner. */
  const validate = (): string | null =>
    withPrice && !price
      ? 'Yeni dönem ücreti eksik veya geçersiz (tutar ve döviz kuru gerekli). Ücret girmeyecekseniz kutucuğu kaldırın.'
      : null;

  /** Uzatma başarılı olduktan sonra çağrılır; kullanıcı mesajına eklenecek not döner ('' = sorun yok). */
  const record = async (previousExpiresAt: string, updated: StoredLicense): Promise<string> => {
    if (!withPrice || !price) return '';
    const pct = pctNumber();
    try {
      await withTimeout(financeApi.addPeriod({
        ...price,
        license_id: license.license_id,
        product_id: license.product_id,
        customer: license.customer,
        period_start: previousExpiresAt.slice(0, 10),
        period_end: updated.expires_at.slice(0, 10),
        increase_pct: pct !== 0 ? pct : null,
        source: 'extend',
        written_off: false,
        written_off_at: null,
      }), 5000);
      return '';
    } catch (err) {
      console.warn('Yeni dönem ücreti kaydedilemedi:', err);
      return ' Lisans uzatıldı ancak ücret kaydedilemedi — Finans sekmesinden ekleyin.';
    }
  };

  const section = (
    <div className="p-3 bg-white rounded-lg border border-[#e2e8f0] space-y-3">
      <label className="flex items-center gap-2 text-xs font-semibold text-[#1e293b] cursor-pointer">
        <input type="checkbox" checked={withPrice} onChange={e => setWithPrice(e.target.checked)} />
        Yeni dönem ücreti gir (Finans)
      </label>
      {withPrice && (
        <>
          {lastPeriod && (
            <div className="flex items-center gap-2 text-xs text-[#64748b]">
              <span>
                Önceki ücret: <b>{formatMoney(lastPeriod.amount, lastPeriod.currency)}</b>
              </span>
              <span className="ml-auto">Artış %</span>
              <input
                value={increasePct}
                onChange={e => onIncreaseChange(e.target.value)}
                inputMode="decimal"
                className="w-16 bg-white border border-[#cbd5e1] rounded-lg px-2 py-1 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
              />
            </div>
          )}
          <MoneyInput label="Yeni dönem ücreti" value={seed} refreshRate onChange={setPrice} date={todayStr()} />
        </>
      )}
    </div>
  );

  return { section, validate, record };
}
