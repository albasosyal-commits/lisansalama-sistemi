import React, { useState } from 'react';
import type { Product } from '../../types';
import type { FinanceExpense, MoneyFields, Recurrence } from '../../types/finance';
import { financeApi } from '../../services/financeApi';
import { FinanceModal } from './FinanceModal';
import { MoneyInput } from './MoneyInput';
import { btnPrimary, btnSecondary, inputCls, labelCls, todayStr } from './format';

export const EXPENSE_CATEGORIES = ['Sunucu', 'Hosting', 'Alan adı', 'Veritabanı', 'Abonelik', 'Diğer'];

interface Props {
  products: Product[];
  expense?: FinanceExpense;
  onSaved: () => void;
  onClose: () => void;
}

export const ExpenseForm: React.FC<Props> = ({ products, expense, onSaved, onClose }) => {
  const [title, setTitle] = useState(expense?.title ?? '');
  const [category, setCategory] = useState(expense?.category ?? '');
  const [productId, setProductId] = useState<string>(expense?.product_id ?? '');
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? todayStr());
  const [recurrence, setRecurrence] = useState<Recurrence>(expense?.recurrence ?? 'none');
  const [recurrenceEnd, setRecurrenceEnd] = useState(expense?.recurrence_end ?? '');
  const [money, setMoney] = useState<MoneyFields | null>(expense ?? null);
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endInvalid = recurrence !== 'none' && !!recurrenceEnd && recurrenceEnd < spentAt;
  const canSave = !!title.trim() && !!money && !!spentAt && !endInvalid;

  const save = async () => {
    if (!money) return;
    setSaving(true);
    setError(null);
    try {
      const data = {
        ...money,
        title: title.trim(),
        category: category.trim(),
        product_id: productId || null,
        spent_at: spentAt,
        recurrence,
        recurrence_end: recurrence !== 'none' && recurrenceEnd ? recurrenceEnd : null,
        notes: notes.trim() || undefined,
      };
      if (expense) await financeApi.updateExpense(expense.id, data);
      else await financeApi.addExpense(data);
      onSaved();
      onClose();
    } catch (err: any) {
      setError('Gider kaydedilemedi: ' + (err?.message || 'bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinanceModal
      title={expense ? 'Gideri Düzenle' : 'Gider Ekle'}
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
      <div>
        <label className={labelCls}>Açıklama *</label>
        <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Örn: Vercel Pro aboneliği" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Kategori</label>
          <input className={inputCls} list="finance-expense-categories" value={category} onChange={e => setCategory(e.target.value)} />
          <datalist id="finance-expense-categories">
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>Uygulama / Ürün</label>
          <select className={inputCls} value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">Genel / tüm uygulamalar</option>
            {products.map(p => <option key={p.id} value={p.productId}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tarih</label>
          <input type="date" className={inputCls} value={spentAt} onChange={e => setSpentAt(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Tekrar</label>
          <select className={inputCls} value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)}>
            <option value="none">Tek seferlik</option>
            <option value="monthly">Her ay</option>
            <option value="yearly">Her yıl</option>
          </select>
        </div>
      </div>
      {recurrence !== 'none' && (
        <div>
          <label className={labelCls}>Bitiş tarihi (opsiyonel)</label>
          <input type="date" className={inputCls} value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)} />
          {endInvalid && <p className="text-xs text-red-600 mt-1">Bitiş tarihi başlangıçtan önce olamaz.</p>}
        </div>
      )}
      <MoneyInput label={recurrence === 'none' ? 'Tutar' : 'Her tekrarın tutarı'} value={expense ?? null} onChange={setMoney} date={spentAt || todayStr()} />
      <div>
        <label className={labelCls}>Not</label>
        <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsiyonel" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </FinanceModal>
  );
};
