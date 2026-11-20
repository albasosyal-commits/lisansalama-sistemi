import { useEffect, useState } from 'react';
import { subscribeFinance, type FinanceData } from '../../services/financeApi';

export function useFinanceData(): FinanceData & { loading: boolean; error: string | null } {
  const [data, setData] = useState<FinanceData>({ periods: [], payments: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      return subscribeFinance(
        d => {
          setData(d);
          setLoading(false);
          setError(null);
        },
        err => {
          console.warn('Finans verisi dinlenemedi:', err);
          setError('Finans verileri Firestore\'dan okunamadı: ' + (err?.message || 'bilinmeyen hata'));
          setLoading(false);
        }
      );
    } catch (err: any) {
      setError('Finans verileri yüklenemedi: ' + (err?.message || 'bilinmeyen hata'));
      setLoading(false);
    }
  }, []);

  return { ...data, loading, error };
}
