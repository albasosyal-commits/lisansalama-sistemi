import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { CURRENCIES, type Currency, type MoneyFields } from '../../types/finance';
import { fetchFxRate } from '../../services/fxRate';
import { toMoney } from '../../services/financeCalc';
import { formatMoney, inputCls, labelCls, parseTrAmount } from './format';

interface MoneyInputProps {
  /** Başlangıç değeri (düzenleme / önceden doldurma). Değişince form yeniden doldurulur. */
  value: MoneyFields | null;
  onChange: (m: MoneyFields | null) => void;
  /** Kurun ait olacağı tarih (YYYY-MM-DD). */
  date: string;
  lockedCurrency?: Currency;
  label?: string;
  /** true ise başlangıç değeri dövizli olsa bile kur, `date` için yeniden getirilir (ör. yeni dönem). */
  refreshRate?: boolean;
}

const fmtNum = (n: number) => String(n).replace('.', ',');

export const MoneyInput: React.FC<MoneyInputProps> = ({ value, onChange, date, lockedCurrency, label = 'Tutar', refreshRate = false }) => {
  const [amountStr, setAmountStr] = useState(value ? fmtNum(value.amount) : '');
  const [currency, setCurrency] = useState<Currency>(lockedCurrency ?? value?.currency ?? 'TRY');
  const [rateStr, setRateStr] = useState(value && value.currency !== 'TRY' ? fmtNum(value.fx_rate) : '');
  const [fxDate, setFxDate] = useState(value?.fx_date ?? date);
  const [source, setSource] = useState<'auto' | 'manual'>(value?.fx_source ?? 'auto');
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateError, setRateError] = useState(false);

  // Dışarıdan gelen value değişirse (ör. % artış hesaplaması) formu güncelle
  const lastValue = useRef(value);
  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    if (value) {
      setAmountStr(fmtNum(value.amount));
      setCurrency(lockedCurrency ?? value.currency);
    }
  }, [value, lockedCurrency]);

  useEffect(() => {
    if (lockedCurrency) setCurrency(lockedCurrency);
  }, [lockedCurrency]);

  // Para birimi veya tarih değişince kuru otomatik getir (elle girilmediyse)
  const skipFirstFetch = useRef(!refreshRate && !!value && value.currency !== 'TRY');
  useEffect(() => {
    if (currency === 'TRY') {
      setRateError(false);
      return;
    }
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    let cancelled = false;
    setLoadingRate(true);
    setRateError(false);
    fetchFxRate(currency, date).then(r => {
      if (cancelled) return;
      setLoadingRate(false);
      if (r) {
        setRateStr(fmtNum(r.rate));
        setFxDate(r.date);
        setSource('auto');
      } else {
        setRateStr('');
        setFxDate(date);
        setRateError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currency, date]);

  const amount = parseTrAmount(amountStr);
  const rate = currency === 'TRY' ? 1 : parseTrAmount(rateStr);
  const money = amount !== null && rate !== null ? toMoney(amount, currency, rate, currency === 'TRY' ? date : fxDate, currency === 'TRY' ? 'auto' : source) : null;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const key = money ? JSON.stringify(money) : '';
  useEffect(() => {
    onChangeRef.current(money);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="space-y-2">
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          className={inputCls}
          placeholder="Örn: 15.000,00"
          value={amountStr}
          onChange={e => setAmountStr(e.target.value)}
        />
        <select
          className={`${inputCls} w-24 shrink-0`}
          value={currency}
          disabled={!!lockedCurrency}
          onChange={e => setCurrency(e.target.value as Currency)}
        >
          {CURRENCIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {amountStr && amount === null && <p className="text-xs text-red-600">Geçerli bir tutar girin.</p>}

      {currency !== 'TRY' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b] whitespace-nowrap">1 {currency} =</span>
          <input
            type="text"
            inputMode="decimal"
            className={`${inputCls} w-32`}
            placeholder="Kur"
            value={rateStr}
            onChange={e => {
              setRateStr(e.target.value);
              setSource('manual');
              setRateError(false);
            }}
          />
          <span className="text-xs text-[#64748b]">TL</span>
          {loadingRate && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3b82f6]" />}
          {!loadingRate && rateStr && (
            <span className="text-[11px] text-[#94a3b8]">
              {source === 'auto' ? `${fxDate} kuru (ECB)` : 'elle girildi'}
            </span>
          )}
        </div>
      )}
      {rateError && (
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> Kur alınamadı, elle girin.
        </p>
      )}
      {money && currency !== 'TRY' && (
        <p className="text-xs text-[#64748b]">TL karşılığı: <b>{formatMoney(money.amount_try)}</b></p>
      )}
    </div>
  );
};
