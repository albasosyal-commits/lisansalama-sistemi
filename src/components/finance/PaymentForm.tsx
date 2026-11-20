import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { StoredLicense } from '../../types';
import type { FinancePayment, FinancePeriod, MoneyFields, PaymentMethod } from '../../types/finance';
import { financeApi } from '../../services/financeApi';
import { periodBalance } from '../../services/financeCalc';
import { FinanceModal } from './FinanceModal';
import { MoneyInput } from './MoneyInput';
import { btnPrimary, btnSecondary, formatDate, formatMoney, inputCls, labelCls, todayStr } from './format';
import { METHOD_LABEL } from './helpers';

interface Props {
  license: StoredLicense | null;
  /** Bu lisansa ait dönemler. */
  periods: FinancePeriod[];
  /** Kalan hesabı için tüm ödemeler. */
  payments: FinancePayment[];
  payment?: FinancePayment;
  /** Seçili gelecek dönem (opsiyonel). */
  initialPeriodId?: string;
  onSaved: () => void;
  onClose: () => void;
  /** Dönem yoksa "Dönem ücreti ekle"ye geçiş. */
  onNeedPeriod?: () => void;
}

export const PaymentForm: React.FC<Props> = ({
  license, periods, payments, payment, initialPeriodId, onSaved, onClose, onNeedPeriod,
}) => {
  const sorted = useMemo(() => [...periods].sort((a, b) => a.period_start.localeCompare(b.period_start)), [periods]);
  const defaultPeriod =
    payment?.period_id ??
    initialPeriodId ??
    sorted.find(p => {
      const b = periodBalance(p, payments);
      return b.status === 'unpaid' || b.status === 'partial';
    })?.id ??
    sorted[sorted.length - 1]?.id ??
    '';

  const [periodId, setPeriodId] = useState(defaultPeriod);
  const [paidAt, setPaidAt] = useState(payment?.paid_at ?? todayStr());
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? 'havale');
  const [money, setMoney] = useState<MoneyFields | null>(payment ?? null);
  const [notes, setNotes] = useState(payment?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const period = periods.find(p => p.id === periodId);

  if (periods.length === 0) {
    return (
      <FinanceModal title="Ödeme Ekle" onClose={onClose} footer={<button className={btnSecondary} onClick={onClose}>Kapat</button>}>
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            Önce dönem ücreti girin. Ödeme, lisansın bir ücret dönemine bağlanır.
            {onNeedPeriod && (
              <div className="mt-2">
                <button className={btnPrimary} onClick={onNeedPeriod}>Dönem ücreti ekle</button>
              </div>
            )}
          </div>
        </div>
      </FinanceModal>
    );
  }

  const canSave = !!money && !!period && !!paidAt;

  const save = async () => {
    if (!money || !period) return;
    setSaving(true);
    setError(null);
    try {
      const data = {
        ...money,
        license_id: period.license_id,
        period_id: period.id,
        customer: license?.customer ?? period.customer,
        product_id: license?.product_id ?? period.product_id,
        paid_at: paidAt,
        method,
        notes: notes.trim() || undefined,
      };
      if (payment) await financeApi.updatePayment(payment.id, data);
      else await financeApi.addPayment(data);
      onSaved();
      onClose();
    } catch (err: any) {
      setError('Ödeme kaydedilemedi: ' + (err?.message || 'bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  const bal = period ? periodBalance(period, payments.filter(p => p.id !== payment?.id)) : null;

  return (
    <FinanceModal
      title={payment ? 'Ödemeyi Düzenle' : 'Ödeme Ekle'}
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>İptal</button>
          <button className={btnPrimary} disabled={!canSave || saving} onClick={save}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <p className="text-sm text-[#475569]">
        <b>{license?.customer ?? periods[0].customer}</b>
        {!license && <span className="text-[#94a3b8]"> (silinmiş lisans)</span>}
      </p>
      <div>
        <label className={labelCls}>Dönem</label>
        <select className={inputCls} value={periodId} onChange={e => setPeriodId(e.target.value)}>
          {sorted.map(p => (
            <option key={p.id} value={p.id}>
              {formatDate(p.period_start)} – {formatDate(p.period_end)} · {formatMoney(p.amount, p.currency)}
            </option>
          ))}
        </select>
        {bal && period && (
          <p className="text-xs text-[#64748b] mt-1">
            Kalan: <b>{formatMoney(bal.remaining, period.currency)}</b>
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Ödeme tarihi</label>
          <input type="date" className={inputCls} value={paidAt} onChange={e => setPaidAt(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Yöntem</label>
          <select className={inputCls} value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <MoneyInput
        label="Ödenen tutar"
        value={payment ?? null}
        onChange={setMoney}
        date={paidAt || todayStr()}
        lockedCurrency={period?.currency}
      />
      <div>
        <label className={labelCls}>Not</label>
        <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsiyonel" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </FinanceModal>
  );
};
