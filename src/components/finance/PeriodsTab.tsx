import React, { useMemo, useState } from 'react';
import { PlusCircle, Search } from 'lucide-react';
import type { Product, StoredLicense } from '../../types';
import type { FinancePayment, FinancePeriod } from '../../types/finance';
import { normalizeCustomer } from '../../services/financeCalc';
import { btnPrimary, cardCls, inputCls } from './format';
import { PeriodForm } from './PeriodForm';
import { PeriodsTable } from './PeriodsTable';

interface Props {
  licenses: StoredLicense[];
  products: Product[];
  periods: FinancePeriod[];
  payments: FinancePayment[];
}

export const PeriodsTab: React.FC<Props> = ({ licenses, products, periods, payments }) => {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const nq = normalizeCustomer(q);
    if (!nq) return periods;
    return periods.filter(p => {
      const lic = licenses.find(l => l.license_id === p.license_id);
      return normalizeCustomer(lic?.customer ?? p.customer).includes(nq);
    });
  }, [q, periods, licenses]);

  return (
    <div className={cardCls}>
      <div className="px-4 py-3 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94a3b8]" />
          <input className={`${inputCls} pl-9 w-64`} placeholder="Firma ara..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className={`${btnPrimary} flex items-center gap-1.5`} onClick={() => setAdding(true)}>
          <PlusCircle className="w-4 h-4" /> Dönem ücreti ekle
        </button>
      </div>
      <PeriodsTable periods={filtered} payments={payments} licenses={licenses} products={products} />
      {adding && <PeriodForm license={null} licenses={licenses} onSaved={() => {}} onClose={() => setAdding(false)} />}
    </div>
  );
};
