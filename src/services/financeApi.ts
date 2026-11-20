import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FinanceExpense, FinancePayment, FinancePeriod } from '../types/finance';

export { fetchFxRate } from './fxRate';

export const FINANCE_COLLECTIONS = {
  periods: 'finance_periods',
  payments: 'finance_payments',
  expenses: 'finance_expenses',
} as const;

/** Firestore `undefined` alan kabul etmez — çıkar. */
function clean<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

async function add<T extends { id: string }>(col: string, data: Omit<T, 'id'>): Promise<T> {
  const ref = await addDoc(collection(db, col), clean(data as Record<string, any>));
  return { ...(data as any), id: ref.id } as T;
}

async function patch(col: string, id: string, data: Record<string, any>): Promise<void> {
  const { id: _ignored, ...rest } = data;
  await updateDoc(doc(db, col, id), clean(rest));
}

async function remove(col: string, id: string): Promise<void> {
  await deleteDoc(doc(db, col, id));
}

const now = () => new Date().toISOString();

export const financeApi = {
  addPeriod(p: Omit<FinancePeriod, 'id' | 'created_at' | 'updated_at'>): Promise<FinancePeriod> {
    const ts = now();
    return add<FinancePeriod>(FINANCE_COLLECTIONS.periods, { ...p, created_at: ts, updated_at: ts });
  },
  updatePeriod(id: string, p: Partial<FinancePeriod>): Promise<void> {
    return patch(FINANCE_COLLECTIONS.periods, id, { ...p, updated_at: now() });
  },
  deletePeriod(id: string): Promise<void> {
    return remove(FINANCE_COLLECTIONS.periods, id);
  },

  addPayment(p: Omit<FinancePayment, 'id' | 'created_at'>): Promise<FinancePayment> {
    return add<FinancePayment>(FINANCE_COLLECTIONS.payments, { ...p, created_at: now() });
  },
  updatePayment(id: string, p: Partial<FinancePayment>): Promise<void> {
    return patch(FINANCE_COLLECTIONS.payments, id, p);
  },
  deletePayment(id: string): Promise<void> {
    return remove(FINANCE_COLLECTIONS.payments, id);
  },

  addExpense(e: Omit<FinanceExpense, 'id' | 'created_at'>): Promise<FinanceExpense> {
    return add<FinanceExpense>(FINANCE_COLLECTIONS.expenses, { ...e, created_at: now() });
  },
  updateExpense(id: string, e: Partial<FinanceExpense>): Promise<void> {
    return patch(FINANCE_COLLECTIONS.expenses, id, e);
  },
  deleteExpense(id: string): Promise<void> {
    return remove(FINANCE_COLLECTIONS.expenses, id);
  },
};

export interface FinanceData {
  periods: FinancePeriod[];
  payments: FinancePayment[];
  expenses: FinanceExpense[];
}

/** Üç finans koleksiyonunu gerçek zamanlı dinler; dönen fonksiyon tüm dinleyicileri kapatır. */
export function subscribeFinance(cb: (d: FinanceData) => void, onError: (e: Error) => void): () => void {
  const state: FinanceData = { periods: [], payments: [], expenses: [] };
  const ready = { periods: false, payments: false, expenses: false };
  const emit = () => {
    if (ready.periods && ready.payments && ready.expenses) cb({ ...state });
  };

  const listen = <K extends keyof FinanceData>(key: K, col: string) =>
    onSnapshot(
      collection(db, col),
      snap => {
        state[key] = snap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as FinanceData[K];
        ready[key] = true;
        emit();
      },
      err => onError(err)
    );

  const unsubs = [
    listen('periods', FINANCE_COLLECTIONS.periods),
    listen('payments', FINANCE_COLLECTIONS.payments),
    listen('expenses', FINANCE_COLLECTIONS.expenses),
  ];
  return () => unsubs.forEach(u => u());
}
