import React, { useMemo, useState } from 'react';
import { Pencil, PlusCircle, Repeat, Trash2 } from 'lucide-react';
import type { Product } from '../../types';
import type { FinanceExpense } from '../../types/finance';
import { financeApi } from '../../services/financeApi';
import { expandExpense } from '../../services/financeCalc';
import { ConfirmModal } from '../ConfirmModal';
import { btnPrimary, cardCls, formatDate, formatMoney, inputCls } from './format';
import { productName } from './helpers';
import { ExpenseForm } from './ExpenseForm';

interface Props {
  products: Product[];
  expenses: FinanceExpense[];
}

const iconBtn = 'p-1.5 rounded hover:bg-slate-100 text-[#64748b] hover:text-[#1e293b] transition';
const RECURRENCE_LABEL = { none: '', monthly: 'Aylık', yearly: 'Yıllık' } as const;

export const ExpensesTab: React.FC<Props> = ({ products, expenses }) => {
  const year = new Date().getFullYear();
  const [productFilter, setProductFilter] = useState('__all');
  const [categoryFilter, setCategoryFilter] = useState('__all');
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<FinanceExpense | null>(null);
  const [toDelete, setToDelete] = useState<FinanceExpense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(expenses.map(e => e.category).filter(Boolean))].sort(), [expenses]);

  const filtered = useMemo(
    () =>
      expenses
        .filter(e => productFilter === '__all' || (productFilter === '__general' ? e.product_id === null : e.product_id === productFilter))
        .filter(e => categoryFilter === '__all' || e.category === categoryFilter)
        .sort((a, b) => b.spent_at.localeCompare(a.spent_at)),
    [expenses, productFilter, categoryFilter]
  );

  const yearTotal = useMemo(
    () => filtered.reduce((s, e) => s + expandExpense(e, `${year}-01-01`, `${year}-12-31`).reduce((t, x) => t + x.amount_try, 0), 0),
    [filtered, year]
  );

  return (
    <div className={cardCls}>
      <div className="px-4 py-3 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select className={`${inputCls} w-52`} value={productFilter} onChange={e => setProductFilter(e.target.value)}>
            <option value="__all">Tüm uygulamalar</option>
            <option value="__general">Genel giderler</option>
            {products.map(p => <option key={p.id} value={p.productId}>{p.name}</option>)}
          </select>
          <select className={`${inputCls} w-44`} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="__all">Tüm kategoriler</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#64748b]">
            {year} toplamı: <b className="text-[#ef4444]">{formatMoney(yearTotal)}</b>
          </span>
          <button className={`${btnPrimary} flex items-center gap-1.5`} onClick={() => setAdding(true)}>
            <PlusCircle className="w-4 h-4" /> Gider ekle
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-[#64748b] text-center">Gider kaydı yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#64748b]">
              <tr>
                <th className="text-left px-3 py-2">Tarih</th>
                <th className="text-left px-3 py-2">Açıklama</th>
                <th className="text-left px-3 py-2">Kategori</th>
                <th className="text-left px-3 py-2">Uygulama</th>
                <th className="text-right px-3 py-2">Tutar</th>
                <th className="text-right px-3 py-2">TL</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-t border-[#f1f5f9]">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(e.spent_at)}
                    {e.recurrence !== 'none' && (
                      <div className="text-[11px] text-[#8b5cf6] flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> {RECURRENCE_LABEL[e.recurrence]}
                        {e.recurrence_end ? ` · ${formatDate(e.recurrence_end)}'e kadar` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{e.title}</td>
                  <td className="px-3 py-2">{e.category || '-'}</td>
                  <td className="px-3 py-2">{e.product_id ? productName(products, e.product_id) : 'Genel'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(e.amount, e.currency)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-[#ef4444]">{formatMoney(e.amount_try)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-0.5">
                      <button className={iconBtn} title="Düzenle" onClick={() => setEdit(e)}><Pencil className="w-4 h-4" /></button>
                      <button className={iconBtn} title="Sil" onClick={() => { setDeleteError(null); setToDelete(e); }}>
                        <Trash2 className="w-4 h-4 text-[#ef4444]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(adding || edit) && (
        <ExpenseForm
          products={products}
          expense={edit ?? undefined}
          onSaved={() => {}}
          onClose={() => { setAdding(false); setEdit(null); }}
        />
      )}
      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await financeApi.deleteExpense(toDelete.id);
            setToDelete(null);
          } catch (err: any) {
            setDeleteError('Gider silinemedi: ' + (err?.message || 'bilinmeyen hata'));
          }
        }}
        title="Gideri sil"
        description={toDelete?.recurrence !== 'none' ? 'Tekrarlı gider tüm dönemleriyle birlikte silinecek.' : 'Bu gider kaydı kalıcı olarak silinecek.'}
        itemDetails={toDelete ? [
          { label: 'Açıklama', value: toDelete.title },
          { label: 'Tutar', value: formatMoney(toDelete.amount, toDelete.currency) },
        ] : undefined}
        confirmText="Sil"
        variant="danger"
        error={deleteError}
      />
    </div>
  );
};
