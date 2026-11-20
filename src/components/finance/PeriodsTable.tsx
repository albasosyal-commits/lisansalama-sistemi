import React, { useState } from 'react';
import { Ban, Pencil, PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import type { Product, StoredLicense } from '../../types';
import type { FinancePayment, FinancePeriod } from '../../types/finance';
import { financeApi } from '../../services/financeApi';
import { periodBalance } from '../../services/financeCalc';
import { ConfirmModal } from '../ConfirmModal';
import { formatDate, formatMoney } from './format';
import { productName, STATUS_BADGE } from './helpers';
import { PaymentForm } from './PaymentForm';
import { PeriodForm } from './PeriodForm';

interface Props {
  periods: FinancePeriod[];
  /** Tüm ödemeler (bakiye için). */
  payments: FinancePayment[];
  licenses: StoredLicense[];
  products: Product[];
  /** Firma/ürün sütunlarını gizle (tek lisans görünümü). */
  compact?: boolean;
}

const iconBtn = 'p-1.5 rounded hover:bg-slate-100 text-[#64748b] hover:text-[#1e293b] transition';

export const PeriodsTable: React.FC<Props> = ({ periods, payments, licenses, products, compact }) => {
  const [editPeriod, setEditPeriod] = useState<FinancePeriod | null>(null);
  const [payFor, setPayFor] = useState<FinancePeriod | null>(null);
  const [toDelete, setToDelete] = useState<FinancePeriod | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const licenseOf = (p: FinancePeriod) => licenses.find(l => l.license_id === p.license_id) ?? null;
  const sorted = [...periods].sort((a, b) => b.period_start.localeCompare(a.period_start));

  const toggleWriteOff = async (p: FinancePeriod) => {
    setActionError(null);
    try {
      await financeApi.updatePeriod(p.id, {
        written_off: !p.written_off,
        written_off_at: p.written_off ? null : new Date().toISOString(),
      });
    } catch (err: any) {
      setActionError('İşlem kaydedilemedi: ' + (err?.message || 'bilinmeyen hata'));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    if (payments.some(x => x.period_id === toDelete.id)) {
      setDeleteError('Bu döneme ait ödemeler var, önce onları silin.');
      return;
    }
    try {
      await financeApi.deletePeriod(toDelete.id);
      setToDelete(null);
    } catch (err: any) {
      setDeleteError('Dönem silinemedi: ' + (err?.message || 'bilinmeyen hata'));
    }
  };

  if (sorted.length === 0) {
    return <p className="p-6 text-sm text-[#64748b] text-center">Henüz dönem ücreti kaydı yok.</p>;
  }

  return (
    <>
      {actionError && <p className="px-4 py-2 text-sm text-red-600">{actionError}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-[#64748b]">
            <tr>
              {!compact && <th className="text-left px-3 py-2">Firma</th>}
              {!compact && <th className="text-left px-3 py-2">Ürün</th>}
              <th className="text-left px-3 py-2">Dönem</th>
              <th className="text-right px-3 py-2">Ücret</th>
              <th className="text-right px-3 py-2">Ödenen</th>
              <th className="text-right px-3 py-2">Kalan</th>
              <th className="text-left px-3 py-2">Durum</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const lic = licenseOf(p);
              const bal = periodBalance(p, payments);
              const badge = STATUS_BADGE[bal.status];
              return (
                <tr key={p.id} className="border-t border-[#f1f5f9] align-top">
                  {!compact && (
                    <td className="px-3 py-2 font-medium text-[#1e293b]">
                      {lic?.customer ?? p.customer}
                      {!lic && <div className="text-[11px] text-[#94a3b8]">(silinmiş lisans)</div>}
                    </td>
                  )}
                  {!compact && <td className="px-3 py-2">{lic?.product_name || productName(products, p.product_id)}</td>}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(p.period_start)} – {formatDate(p.period_end)}
                    {p.increase_pct ? <div className="text-[11px] text-[#3b82f6]">+%{p.increase_pct} artış</div> : null}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatMoney(p.amount, p.currency)}
                    {p.currency !== 'TRY' && <div className="text-[11px] text-[#94a3b8]">{formatMoney(p.amount_try)}</div>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(bal.paid, p.currency)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(bal.remaining, p.currency)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 text-[11px] font-semibold border rounded-full whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <button className={iconBtn} title="Ödeme ekle" onClick={() => setPayFor(p)}>
                        <PlusCircle className="w-4 h-4 text-[#10b981]" />
                      </button>
                      <button className={iconBtn} title="Düzenle" onClick={() => setEditPeriod(p)}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className={iconBtn}
                        title={p.written_off ? 'Alacağa geri al' : 'Alacaktan düş'}
                        onClick={() => toggleWriteOff(p)}
                      >
                        {p.written_off ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button className={iconBtn} title="Sil" onClick={() => { setDeleteError(null); setToDelete(p); }}>
                        <Trash2 className="w-4 h-4 text-[#ef4444]" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editPeriod && (
        <PeriodForm license={licenseOf(editPeriod)} period={editPeriod} onSaved={() => {}} onClose={() => setEditPeriod(null)} />
      )}
      {payFor && (
        <PaymentForm
          license={licenseOf(payFor)}
          periods={periods.filter(x => x.license_id === payFor.license_id)}
          payments={payments}
          initialPeriodId={payFor.id}
          onSaved={() => {}}
          onClose={() => setPayFor(null)}
        />
      )}
      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Dönem ücretini sil"
        description="Bu dönem ücreti kaydı kalıcı olarak silinecek."
        itemDetails={toDelete ? [
          { label: 'Firma', value: toDelete.customer },
          { label: 'Ücret', value: formatMoney(toDelete.amount, toDelete.currency) },
        ] : undefined}
        confirmText="Sil"
        variant="danger"
        error={deleteError}
      />
    </>
  );
};
