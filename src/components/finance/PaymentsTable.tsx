import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { StoredLicense } from '../../types';
import type { FinancePayment, FinancePeriod } from '../../types/finance';
import { financeApi } from '../../services/financeApi';
import { ConfirmModal } from '../ConfirmModal';
import { formatDate, formatMoney } from './format';
import { METHOD_LABEL } from './helpers';
import { PaymentForm } from './PaymentForm';

interface Props {
  /** Gösterilecek ödemeler. */
  payments: FinancePayment[];
  /** Bakiye için tüm ödemeler. */
  allPayments: FinancePayment[];
  periods: FinancePeriod[];
  licenses: StoredLicense[];
  compact?: boolean;
}

const iconBtn = 'p-1.5 rounded hover:bg-slate-100 text-[#64748b] hover:text-[#1e293b] transition';

export const PaymentsTable: React.FC<Props> = ({ payments, allPayments, periods, licenses, compact }) => {
  const [edit, setEdit] = useState<FinancePayment | null>(null);
  const [toDelete, setToDelete] = useState<FinancePayment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const licenseOf = (id: string) => licenses.find(l => l.license_id === id) ?? null;
  const sorted = [...payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at));

  if (sorted.length === 0) return <p className="p-6 text-sm text-[#64748b] text-center">Henüz ödeme kaydı yok.</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-[#64748b]">
            <tr>
              <th className="text-left px-3 py-2">Tarih</th>
              {!compact && <th className="text-left px-3 py-2">Firma</th>}
              <th className="text-left px-3 py-2">Yöntem</th>
              <th className="text-right px-3 py-2">Tutar</th>
              <th className="text-right px-3 py-2">TL</th>
              <th className="text-left px-3 py-2">Not</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const lic = licenseOf(p.license_id);
              return (
                <tr key={p.id} className="border-t border-[#f1f5f9]">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.paid_at)}</td>
                  {!compact && (
                    <td className="px-3 py-2 font-medium">
                      {lic?.customer ?? p.customer}
                      {!lic && <span className="text-[11px] text-[#94a3b8]"> (silinmiş lisans)</span>}
                    </td>
                  )}
                  <td className="px-3 py-2">{METHOD_LABEL[p.method] ?? p.method}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-[#10b981]">{formatMoney(p.amount_try)}</td>
                  <td className="px-3 py-2 text-[#64748b]">{p.notes || ''}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-0.5">
                      <button className={iconBtn} title="Düzenle" onClick={() => setEdit(p)}>
                        <Pencil className="w-4 h-4" />
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

      {edit && (
        <PaymentForm
          license={licenseOf(edit.license_id)}
          periods={periods.filter(x => x.license_id === edit.license_id)}
          payments={allPayments}
          payment={edit}
          onSaved={() => {}}
          onClose={() => setEdit(null)}
        />
      )}
      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await financeApi.deletePayment(toDelete.id);
            setToDelete(null);
          } catch (err: any) {
            setDeleteError('Ödeme silinemedi: ' + (err?.message || 'bilinmeyen hata'));
          }
        }}
        title="Ödemeyi sil"
        description="Bu ödeme kaydı kalıcı olarak silinecek."
        itemDetails={toDelete ? [
          { label: 'Firma', value: toDelete.customer },
          { label: 'Tutar', value: formatMoney(toDelete.amount, toDelete.currency) },
          { label: 'Tarih', value: formatDate(toDelete.paid_at) },
        ] : undefined}
        confirmText="Sil"
        variant="danger"
        error={deleteError}
      />
    </>
  );
};
