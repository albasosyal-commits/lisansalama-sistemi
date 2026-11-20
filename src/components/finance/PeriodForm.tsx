import React, { useState } from 'react';
import type { StoredLicense } from '../../types';
import type { FinancePayment, FinancePeriod, MoneyFields } from '../../types/finance';
import { isPeriodCurrencyLocked } from '../../services/financeCalc';
import { financeApi } from '../../services/financeApi';
import { FinanceModal } from './FinanceModal';
import { MoneyInput } from './MoneyInput';
import { btnPrimary, btnSecondary, inputCls, labelCls, toDateInput, todayStr } from './format';

interface Props {
  /** Yeni dönem için lisans. null ise `licenses` listesinden seçtirilir (veya düzenlenen dönemin lisansı silinmiştir). */
  license: StoredLicense | null;
  /** Lisans seçimi için (yalnız yeni kayıt ve license=null iken). */
  licenses?: StoredLicense[];
  period?: FinancePeriod;
  /** Düzenlemede: ödemesi olan dönemin para birimini kilitlemek için. */
  payments?: FinancePayment[];
  onSaved: () => void;
  onClose: () => void;
}

export const PeriodForm: React.FC<Props> = ({ license, licenses = [], period, payments = [], onSaved, onClose }) => {
  const [licenseId, setLicenseId] = useState(license?.license_id ?? period?.license_id ?? '');
  const selected = license ?? licenses.find(l => l.license_id === licenseId) ?? null;

  const [start, setStart] = useState(toDateInput(period?.period_start ?? selected?.issued_at) || todayStr());
  const [end, setEnd] = useState(toDateInput(period?.period_end ?? selected?.expires_at) || todayStr());
  const [money, setMoney] = useState<MoneyFields | null>(period ?? null);
  const [notes, setNotes] = useState(period?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickLicense = (id: string) => {
    setLicenseId(id);
    const l = licenses.find(x => x.license_id === id);
    if (l) {
      setStart(toDateInput(l.issued_at));
      setEnd(toDateInput(l.expires_at));
    }
  };

  const canSave = !!money && !!start && !!end && end >= start && (!!period || !!selected);

  const save = async () => {
    if (!money) return;
    setSaving(true);
    setError(null);
    try {
      if (period) {
        await financeApi.updatePeriod(period.id, { ...money, period_start: start, period_end: end, notes: notes.trim() });
      } else if (selected) {
        await financeApi.addPeriod({
          ...money,
          license_id: selected.license_id,
          product_id: selected.product_id,
          customer: selected.customer,
          period_start: start,
          period_end: end,
          increase_pct: null,
          source: 'manual',
          written_off: false,
          written_off_at: null,
          notes: notes.trim() || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError('Dönem ücreti kaydedilemedi: ' + (err?.message || 'bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinanceModal
      title={period ? 'Dönem Ücretini Düzenle' : 'Dönem Ücreti Ekle'}
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
      {!license && !period ? (
        <div>
          <label className={labelCls}>Lisans</label>
          <select className={inputCls} value={licenseId} onChange={e => pickLicense(e.target.value)}>
            <option value="">Lisans seçin...</option>
            {licenses.map(l => (
              <option key={l.license_id} value={l.license_id}>
                {l.customer} — {l.product_name || l.product_id} ({toDateInput(l.expires_at)})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm text-[#475569]">
          <b>{selected?.customer ?? period?.customer}</b>
          {!selected && period && <span className="text-[#94a3b8]"> (silinmiş lisans)</span>}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Dönem başlangıcı</label>
          <input type="date" className={inputCls} value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Dönem bitişi</label>
          <input type="date" className={inputCls} value={end} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      {end < start && <p className="text-xs text-red-600">Bitiş tarihi başlangıçtan önce olamaz.</p>}

      <MoneyInput
        label="Dönem ücreti"
        value={period ?? null}
        onChange={setMoney}
        date={start || todayStr()}
        lockedCurrency={isPeriodCurrencyLocked(period, payments) ? period!.currency : undefined}
      />
      {isPeriodCurrencyLocked(period, payments) && (
        <p className="text-[11px] text-[#94a3b8]">Bu döneme ödeme girildiği için para birimi değiştirilemez.</p>
      )}

      <div>
        <label className={labelCls}>Not</label>
        <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsiyonel" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </FinanceModal>
  );
};
