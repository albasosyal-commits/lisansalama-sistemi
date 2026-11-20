import React, { useMemo, useState } from 'react';
import { PlusCircle, RefreshCw } from 'lucide-react';
import type { StoredLicense } from '../../types';
import { periodBalance } from '../../services/financeCalc';
import { btnPrimary, btnSecondary, formatMoney } from './format';
import { useFinanceData } from './useFinanceData';
import { PeriodsTable } from './PeriodsTable';
import { PaymentsTable } from './PaymentsTable';
import { PeriodForm } from './PeriodForm';
import { PaymentForm } from './PaymentForm';

/** Lisans yönetim penceresindeki "Finans" sekmesi: bu lisansın dönem ücretleri ve ödemeleri. */
export const LicenseFinancePanel: React.FC<{ license: StoredLicense }> = ({ license }) => {
  const { periods: allPeriods, payments: allPayments, loading, error } = useFinanceData();
  const [addPeriod, setAddPeriod] = useState(false);
  const [addPayment, setAddPayment] = useState(false);

  const periods = useMemo(() => allPeriods.filter(p => p.license_id === license.license_id), [allPeriods, license.license_id]);
  const payments = useMemo(() => allPayments.filter(p => p.license_id === license.license_id), [allPayments, license.license_id]);
  const remainingTry = periods.reduce((s, p) => s + periodBalance(p, allPayments).remainingTry, 0);
  const totalTry = periods.reduce((s, p) => s + p.amount_try, 0);
  const paidTry = payments.reduce((s, p) => s + p.amount_try, 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-sm text-[#64748b]">
        <RefreshCw className="w-4 h-4 animate-spin" /> Finans verileri yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-lg bg-slate-50 border border-[#e2e8f0]">
          <div className="text-[11px] uppercase text-[#64748b] font-semibold">Toplam Ücret</div>
          <div className="font-bold text-[#1e293b]">{formatMoney(totalTry)}</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-[#e2e8f0]">
          <div className="text-[11px] uppercase text-[#64748b] font-semibold">Ödenen</div>
          <div className="font-bold text-[#10b981]">{formatMoney(paidTry)}</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-[#e2e8f0]">
          <div className="text-[11px] uppercase text-[#64748b] font-semibold">Kalan Alacak</div>
          <div className="font-bold text-[#f59e0b]">{formatMoney(remainingTry)}</div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button className={`${btnSecondary} flex items-center gap-1.5 text-xs`} onClick={() => setAddPeriod(true)}>
          <PlusCircle className="w-4 h-4" /> Dönem ücreti ekle
        </button>
        <button className={`${btnPrimary} flex items-center gap-1.5 text-xs`} onClick={() => setAddPayment(true)}>
          <PlusCircle className="w-4 h-4" /> Ödeme ekle
        </button>
      </div>

      <div className="border border-[#e2e8f0] rounded-lg">
        <div className="px-3 py-2 text-xs font-bold uppercase text-[#64748b] border-b border-[#e2e8f0]">Dönem Ücretleri</div>
        <PeriodsTable periods={periods} payments={allPayments} licenses={[license]} products={[]} compact />
      </div>
      <div className="border border-[#e2e8f0] rounded-lg">
        <div className="px-3 py-2 text-xs font-bold uppercase text-[#64748b] border-b border-[#e2e8f0]">Ödemeler</div>
        <PaymentsTable payments={payments} allPayments={allPayments} periods={periods} licenses={[license]} compact />
      </div>

      {addPeriod && <PeriodForm license={license} onSaved={() => {}} onClose={() => setAddPeriod(false)} />}
      {addPayment && (
        <PaymentForm
          license={license}
          periods={periods}
          payments={allPayments}
          onSaved={() => {}}
          onClose={() => setAddPayment(false)}
          onNeedPeriod={() => {
            setAddPayment(false);
            setAddPeriod(true);
          }}
        />
      )}
    </div>
  );
};
