import React, { useState } from 'react';
import { AlertCircle, BarChart3, FileText, Receipt, RefreshCw, Wallet } from 'lucide-react';
import type { Product, StoredLicense } from '../../types';
import { useFinanceData } from './useFinanceData';
import { FinanceSummaryTab } from './FinanceSummaryTab';
import { PeriodsTab } from './PeriodsTab';
import { PaymentsTable } from './PaymentsTable';
import { cardCls } from './format';
import { ExpensesTab } from './ExpensesTab';

type SubTab = 'summary' | 'periods' | 'payments' | 'expenses';

interface Props {
  licenses: StoredLicense[];
  products: Product[];
}

export const FinanceView: React.FC<Props> = ({ licenses, products }) => {
  const [tab, setTab] = useState<SubTab>('summary');
  const { periods, payments, expenses, loading, error } = useFinanceData();

  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'summary', label: 'Özet', icon: BarChart3 },
    { id: 'periods', label: 'Lisans Ücretleri', icon: FileText },
    { id: 'payments', label: 'Ödemeler', icon: Wallet },
    { id: 'expenses', label: 'Giderler', icon: Receipt },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[#e2e8f0]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.id ? 'border-[#3b82f6] text-[#3b82f6]' : 'border-transparent text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center text-sm text-[#64748b] gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Finans verileri yükleniyor...
        </div>
      ) : (
        <>
          {tab === 'summary' && (
            <FinanceSummaryTab licenses={licenses} products={products} periods={periods} payments={payments} expenses={expenses} />
          )}
          {tab === 'periods' && (
            <PeriodsTab licenses={licenses} products={products} periods={periods} payments={payments} />
          )}
          {tab === 'payments' && (
            <div className={cardCls}>
              <p className="px-4 py-3 border-b border-[#e2e8f0] text-xs text-[#64748b]">
                Yeni ödeme, "Lisans Ücretleri" sekmesinde ilgili dönemin yanındaki + butonuyla eklenir.
              </p>
              <PaymentsTable payments={payments} allPayments={payments} periods={periods} licenses={licenses} />
            </div>
          )}
          {tab === 'expenses' && <ExpensesTab products={products} expenses={expenses} />}
        </>
      )}
    </div>
  );
};
