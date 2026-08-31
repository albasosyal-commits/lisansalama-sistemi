import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, HeaderBar, TabType } from './components/Navbar';
import { DashboardStats } from './components/DashboardStats';
import { LicenseGenerator } from './components/LicenseGenerator';
import { LicenseList } from './components/LicenseList';
import { ProductManager } from './components/ProductManager';
import { KeyManager } from './components/KeyManager';
import { LicenseVerifierSandbox } from './components/LicenseVerifierSandbox';
import { CodeSnippetsView } from './components/CodeSnippetsView';
import { DocumentationView } from './components/DocumentationView';
import { FirebaseStatusView } from './components/FirebaseStatusView';

import {
  DashboardStats as StatsType,
  KeyMetadata,
  Product,
  StoredLicense,
} from './types';
import { api } from './services/api';
import { DEFAULT_KEY_METADATA } from './data/defaultKeys';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('create');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Core Data State
  const [stats, setStats] = useState<StatsType | null>({
    totalProducts: 0,
    totalLicenses: 0,
    activeLicenses: 0,
    revokedLicenses: 0,
    expiredLicenses: 0,
    demoCount: 0,
    yearlyCount: 0,
    customCount: 0,
  });
  const [keyInfo, setKeyInfo] = useState<KeyMetadata>(DEFAULT_KEY_METADATA);
  const [products, setProducts] = useState<Product[]>([]);
  const [licenses, setLicenses] = useState<StoredLicense[]>([]);

  // State passed to sandbox when user clicks "Sandbox'ta Test Et"
  const [sandboxLicenseKey, setSandboxLicenseKey] = useState<string>('');

  // Track if initial load is done (to not block live listener)
  const initialLoadDone = useRef(false);

  // Initial Data Fetcher
  const loadAllData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);

      // Execute all data fetching safely
      const results = await Promise.allSettled([
        api.getStatus(),
        api.getKeys(),
        api.getProducts(),
        api.getLicenses(),
      ]);

      if (results[0].status === 'fulfilled') {
        setStats(results[0].value.stats);
      }
      if (results[1].status === 'fulfilled') {
        setKeyInfo(results[1].value);
      }
      if (results[2].status === 'fulfilled') {
        setProducts(results[2].value);
      }
      if (results[3].status === 'fulfilled') {
        setLicenses(results[3].value);
        initialLoadDone.current = true;
      }
    } catch (err: any) {
      console.error('Error fetching application data:', err);
      setError(err?.message || 'Veriler sunucudan alınırken bir sorun oluştu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ——————————————————————————————————————————————————
  // Gerçek Zamanlı Firestore Dinleyicisi
  // Diğer uygulamaların /api/v1/verify üzerinden lisans aktive etmesi,
  // durum değişikliği (pause/revoke), süre uzatma gibi işlemleri
  // dashboard'a anlık yansıtır — manuel yenileme gerekmez.
  // ——————————————————————————————————————————————————
  useEffect(() => {
    const licensesRef = collection(db, 'licenses');
    const q = query(licensesRef, orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!initialLoadDone.current) return; // ilk yükleme bitmeden atla
        const updated = snapshot.docs.map((d) => d.data() as StoredLicense);
        setLicenses(updated);

        // İstatistikleri de güncelle
        const now = Date.now();
        const active = updated.filter(
          (l) => l.status === 'active' && new Date(l.expires_at).getTime() > now
        ).length;
        const revoked = updated.filter((l) => l.status === 'revoked').length;
        const expired = updated.filter(
          (l) => l.status !== 'revoked' && new Date(l.expires_at).getTime() <= now
        ).length;
        setStats((prev) =>
          prev
            ? {
                ...prev,
                totalLicenses: updated.length,
                activeLicenses: active,
                revokedLicenses: revoked,
                expiredLicenses: expired,
                usedCount: updated.filter((l) => l.is_used).length,
                unusedCount: updated.filter((l) => !l.is_used).length,
              }
            : prev
        );
      },
      (err) => {
        console.warn('Canlı lisans dinleyici not:', err?.message || err);
      }
    );

    return () => unsubscribe();
  }, []);


  // Navigate to Sandbox with a specific license key
  const handleNavigateToVerifier = (key: string) => {
    setSandboxLicenseKey(key);
    setActiveTab('verifier');
  };

  // Trigger when a new license is generated
  const handleLicenseCreated = (newLic: StoredLicense) => {
    setLicenses((prev) => [newLic, ...prev]);
    // Refresh stats silently
    loadAllData(true);
  };

  // Filter click from dashboard cards
  const handleDashboardFilterClick = () => {
    setActiveTab('list');
  };

  // Product selection from Product Manager
  const handleSelectProductForLicense = () => {
    setActiveTab('create');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col lg:flex-row selection:bg-[#3b82f6] selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        keyInfo={keyInfo}
        stats={stats}
        loading={loading}
        onRefresh={() => loadAllData(false)}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <HeaderBar
          activeTab={activeTab}
          stats={stats}
          loading={loading}
          onRefresh={() => loadAllData(false)}
        />

        {/* Content Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#fee2e2] border border-[#fecaca] text-[#991b1b] text-sm flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-[#ef4444] flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => loadAllData(false)}
                className="px-3 py-1 bg-[#ef4444] text-white hover:bg-[#dc2626] rounded-lg text-xs font-semibold cursor-pointer"
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {/* Global Stats Overview Bar */}
          {stats && <DashboardStats stats={stats} onFilterClick={handleDashboardFilterClick} />}

          {/* Tab Views */}
          {loading && !keyInfo && products.length === 0 ? (
            <div className="p-20 text-center space-y-3 bg-white rounded-xl border border-[#e2e8f0] shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#3b82f6]" />
              <p className="text-[#64748b] text-sm font-medium">
                Lisans yönetim paneli ve RSA anahtarları yükleniyor...
              </p>
            </div>
          ) : (
            <div>
              {activeTab === 'create' && (
                <LicenseGenerator
                  products={products}
                  onLicenseCreated={handleLicenseCreated}
                  onNavigateToVerifier={handleNavigateToVerifier}
                  onAddProductClick={() => setActiveTab('products')}
                />
              )}

              {activeTab === 'list' && (
                <LicenseList
                  licenses={licenses}
                  products={products}
                  onRefresh={() => loadAllData(true)}
                  onNavigateToVerifier={handleNavigateToVerifier}
                />
              )}

              {activeTab === 'products' && (
                <ProductManager
                  products={products}
                  onRefresh={() => loadAllData(true)}
                  onSelectProductForLicense={handleSelectProductForLicense}
                />
              )}

              {activeTab === 'keys' && (
                <KeyManager keyInfo={keyInfo} onRefresh={() => loadAllData(true)} />
              )}

              {activeTab === 'verifier' && (
                <LicenseVerifierSandbox
                  initialLicenseKey={sandboxLicenseKey}
                  keyInfo={keyInfo}
                />
              )}

              {activeTab === 'snippets' && (
                <CodeSnippetsView keyInfo={keyInfo} products={products} />
              )}

              {activeTab === 'firebase' && <FirebaseStatusView />}

              {activeTab === 'docs' && <DocumentationView />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
