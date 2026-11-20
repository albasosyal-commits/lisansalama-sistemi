import React, { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, Clock, Repeat, TrendingUp, Wallet } from 'lucide-react';
import type { Product, StoredLicense } from '../../types';
import type { FinanceExpense, FinancePayment, FinancePeriod } from '../../types/finance';
import { applyIncrease, buildSummary } from '../../services/financeCalc';
import { cardCls, formatDate, formatMoney, inputCls } from './format';
import { productName } from './helpers';

interface Props {
  licenses: StoredLicense[];
  products: Product[];
  periods: FinancePeriod[];
  payments: FinancePayment[];
  expenses: FinanceExpense[];
}

const RENEWAL_WINDOW_DAYS = 60;

export const FinanceSummaryTab: React.FC<Props> = ({ licenses, products, periods, payments, expenses }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [increasePct, setIncreasePct] = useState('0');

  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    periods.forEach(p => set.add(Number(p.period_start.slice(0, 4))));
    payments.forEach(p => set.add(Number(p.paid_at.slice(0, 4))));
    expenses.forEach(e => set.add(Number(e.spent_at.slice(0, 4))));
    return [...set].filter(Boolean).sort((a, b) => b - a);
  }, [periods, payments, expenses, currentYear]);

  const summary = useMemo(() => buildSummary(periods, payments, expenses, year), [periods, payments, expenses, year]);

  const renewals = useMemo(() => {
    const now = Date.now();
    const limit = now + RENEWAL_WINDOW_DAYS * 86400000;
    return licenses
      .filter(l => l.status !== 'revoked')
      .filter(l => {
        const t = new Date(l.expires_at).getTime();
        return t >= now && t <= limit;
      })
      .map(l => {
        const last = periods
          .filter(p => p.license_id === l.license_id)
          .sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
        return last ? { license: l, last } : null;
      })
      .filter((x): x is { license: StoredLicense; last: FinancePeriod } => !!x)
      .sort((a, b) => a.license.expires_at.localeCompare(b.license.expires_at));
  }, [licenses, periods]);

  const pct = Number(increasePct.replace(',', '.')) || 0;

  const cards = [
    { label: 'Satış', value: summary.sales, icon: TrendingUp, color: 'text-[#3b82f6]', note: `${year} yılında başlayan dönemler` },
    { label: 'Tahsil Edilen', value: summary.collected, icon: ArrowDownCircle, color: 'text-[#10b981]', note: `${year} yılı ödemeleri` },
    { label: 'Bekleyen Alacak', value: summary.receivable, icon: Clock, color: 'text-[#f59e0b]', note: 'bugün itibarıyla (tüm yıllar)' },
    { label: 'Gider', value: summary.expense, icon: ArrowUpCircle, color: 'text-[#ef4444]', note: `${year} yılı giderleri` },
    { label: 'Net Kâr', value: summary.net, icon: Wallet, color: summary.net >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]', note: 'tahsilat − gider' },
    { label: 'Kur Farkı', value: summary.fxDiff, icon: Repeat, color: 'text-[#8b5cf6]', note: 'dövizli ödemelerde kur değişimi' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1e293b]">Yıl Özeti</h3>
        <select className={`${inputCls} w-32`} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`${cardCls} p-4`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              <c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}
            </div>
            <div className={`mt-2 text-lg sm:text-xl font-bold ${c.color}`}>{formatMoney(c.value)}</div>
            <div className="text-[11px] text-[#94a3b8] mt-0.5">{c.note}</div>
          </div>
        ))}
      </div>

      <div className={`${cardCls} overflow-x-auto`}>
        <div className="px-4 py-3 border-b border-[#e2e8f0] text-sm font-bold text-[#1e293b]">Ürün Bazında ({year})</div>
        {summary.byProduct.length === 0 ? (
          <p className="p-6 text-sm text-[#64748b] text-center">Bu yıl için finans kaydı yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#64748b]">
              <tr>
                <th className="text-left px-4 py-2">Ürün</th>
                <th className="text-right px-4 py-2">Satış</th>
                <th className="text-right px-4 py-2">Tahsilat</th>
                <th className="text-right px-4 py-2">Alacak</th>
                <th className="text-right px-4 py-2">Gider</th>
                <th className="text-right px-4 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {summary.byProduct.map(r => (
                <tr key={r.product_id ?? '__genel'} className="border-t border-[#f1f5f9]">
                  <td className="px-4 py-2 font-medium text-[#1e293b]">
                    {r.product_id === null ? 'Genel giderler' : productName(products, r.product_id)}
                  </td>
                  <td className="px-4 py-2 text-right">{formatMoney(r.sales)}</td>
                  <td className="px-4 py-2 text-right text-[#10b981]">{formatMoney(r.collected)}</td>
                  <td className="px-4 py-2 text-right text-[#f59e0b]">{formatMoney(r.receivable)}</td>
                  <td className="px-4 py-2 text-right text-[#ef4444]">{formatMoney(r.expense)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${r.net >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{formatMoney(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={`${cardCls} overflow-x-auto`}>
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#3b82f6]" /> Yaklaşan Yenilemeler ({RENEWAL_WINDOW_DAYS} gün)
          </div>
          <label className="flex items-center gap-2 text-xs text-[#64748b]">
            Önerilen artış %
            <input className={`${inputCls} w-20`} value={increasePct} onChange={e => setIncreasePct(e.target.value)} inputMode="decimal" />
          </label>
        </div>
        {renewals.length === 0 ? (
          <p className="p-6 text-sm text-[#64748b] text-center">Önümüzdeki {RENEWAL_WINDOW_DAYS} günde bitecek ücretli lisans yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#64748b]">
              <tr>
                <th className="text-left px-4 py-2">Firma</th>
                <th className="text-left px-4 py-2">Ürün</th>
                <th className="text-left px-4 py-2">Bitiş</th>
                <th className="text-right px-4 py-2">Son Ücret</th>
                <th className="text-right px-4 py-2">Önerilen</th>
              </tr>
            </thead>
            <tbody>
              {renewals.map(({ license, last }) => (
                <tr key={license.license_id} className="border-t border-[#f1f5f9]">
                  <td className="px-4 py-2 font-medium">{license.customer}</td>
                  <td className="px-4 py-2">{license.product_name || productName(products, license.product_id)}</td>
                  <td className="px-4 py-2">{formatDate(license.expires_at)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(last.amount, last.currency)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#3b82f6]">
                    {formatMoney(applyIncrease(last.amount, pct), last.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
