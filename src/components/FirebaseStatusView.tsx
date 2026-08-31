import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Server,
  Layers,
  ShieldCheck,
  PlusCircle,
  ExternalLink,
  Info,
  Settings,
  Edit3,
  RotateCcw,
  Save,
  Sparkles,
  X,
  Code,
} from 'lucide-react';
import {
  db,
  firebaseConfig,
  setRuntimeFirebaseConfig,
  resetRuntimeFirebaseConfig,
  defaultFirebaseConfig,
  FirebaseConfigType,
} from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

export const FirebaseStatusView: React.FC = () => {
  const [currentConfig, setCurrentConfig] = useState<FirebaseConfigType>(firebaseConfig);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    needsDatabaseCreation?: boolean;
    message: string;
    pingMs?: number;
    collections?: { productsCount: number; licensesCount: number };
    errorDetails?: string;
  } | null>(null);

  const [isCreatingTestDoc, setIsCreatingTestDoc] = useState(false);
  const [testDocFeedback, setTestDocFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Edit Settings State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<FirebaseConfigType>(firebaseConfig);
  const [pasteSnippet, setPasteSnippet] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Listen to global config updates
  useEffect(() => {
    const handleConfigChange = (e: any) => {
      if (e.detail) {
        setCurrentConfig(e.detail);
        setEditForm(e.detail);
      }
    };
    window.addEventListener('firebase-config-updated', handleConfigChange);
    return () => window.removeEventListener('firebase-config-updated', handleConfigChange);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const withTimeout = <T,>(promise: Promise<T>, ms = 6000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Firestore bağlantı testi ${ms / 1000}sn içinde yanıt vermedi.`));
      }, ms);
      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  const testFirestoreConnection = async (targetConfig: FirebaseConfigType = currentConfig) => {
    setTestingConnection(true);
    setTestResult(null);
    const start = performance.now();

    // 1. Fast pre-flight check via REST API to detect if database exists or project/API key mismatch
    try {
      const dbParam = targetConfig.firestoreDatabaseId || '(default)';
      const preflightUrl = `https://firestore.googleapis.com/v1/projects/${targetConfig.projectId}/databases/${dbParam}/documents?key=${targetConfig.apiKey}`;
      const preflightRes = await fetch(preflightUrl);
      const preflightText = await preflightRes.text().catch(() => '');
      let preflightData: any = {};
      try {
        preflightData = JSON.parse(preflightText);
      } catch {
        // html or raw text response
      }

      if (preflightRes.status === 404) {
        const elapsed = Math.round(performance.now() - start);
        setTestResult({
          success: false,
          needsDatabaseCreation: true,
          pingMs: elapsed,
          message: `Firebase Console'da "${targetConfig.projectId}" projesi altında "${dbParam}" veritabanı henüz oluşturulmamış veya etkinleştirilmemiş.`,
          errorDetails: `Google Cloud / Firestore HTTP 404 (Not Found): ${preflightData?.error?.message || 'Veritabanı bulunamadı. Firebase Console üzerinden Cloud Firestore oluşturulmalıdır.'}`,
        });
        setTestingConnection(false);
        return;
      }

      if (preflightRes.status === 403) {
        const elapsed = Math.round(performance.now() - start);
        const reason = preflightData?.error?.details?.[0]?.reason || preflightData?.error?.status || 'PERMISSION_DENIED';
        setTestResult({
          success: false,
          pingMs: elapsed,
          message: `Firebase Yetki Hatası (403): "${targetConfig.projectId}" projesi ile mevcut API Anahtarı eşleşmiyor veya Firestore API yetkisi kapalı.`,
          errorDetails: `Detay: ${preflightData?.error?.message || 'Permission denied on resource project'}. (Sebep: ${reason}) - Firebase Console Proje Ayarları'ndaki Web Yapılandırmasını kontrol ediniz.`,
        });
        setTestingConnection(false);
        return;
      }
    } catch {
      // ignore network errors and proceed with SDK test
    }

    try {
      // 2. Test read collections with timeout
      const [productsSnap, licensesSnap] = await withTimeout(
        Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'licenses')),
        ]),
        6000
      );

      // 3. Test write-read-delete roundtrip to verify write permission
      const testDocRef = doc(db, '_connection_test', 'test_ping');
      await withTimeout(
        setDoc(testDocRef, {
          timestamp: new Date().toISOString(),
          test: true,
        }),
        6000
      );
      await deleteDoc(testDocRef).catch(() => {});

      const elapsed = Math.round(performance.now() - start);

      setTestResult({
        success: true,
        message: `Firebase Firestore ("${targetConfig.projectId}") bağlantısı, okuma ve YAZMA izinleri başarıyla doğrulandı!`,
        pingMs: elapsed,
        collections: {
          productsCount: productsSnap.size,
          licensesCount: licensesSnap.size,
        },
      });
    } catch (err: any) {
      console.error('Firestore connection error:', err);
      let errMsg = err?.message || 'Firestore ile bağlantı kurulamadı.';
      if (err?.code === 'permission-denied' || errMsg.includes('insufficient permissions')) {
        errMsg = 'Yazma/Okuma İzni Reddedildi (Permission Denied). Firebase Console > Firestore > Rules sayfasından güvenlik kurallarını açmanız gerekmektedir.';
      } else if (errMsg.includes('yanıt vermedi')) {
        errMsg = `Firestore veritabanı yanıt vermedi. Lütfen Firebase Console'da Cloud Firestore veritabanınızın oluşturulmuş ve kurallarının açık olduğunu kontrol edin.`;
      }

      setTestResult({
        success: false,
        message: errMsg,
        errorDetails: `Hata Kodu: ${err?.code || 'Bağlantı/Ağ'} | ${err?.message || ''}`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCreateSampleProductInFirestore = async () => {
    try {
      setIsCreatingTestDoc(true);
      setTestDocFeedback(null);
      const testId = 'prod-test-' + Math.floor(Math.random() * 10000);
      const sample = {
        id: testId,
        name: 'Firestore Test Ürünü #' + testId.slice(-4),
        productId: 'test-app-' + testId.slice(-4),
        description: 'Firestore doğrudan kayıt doğrulama testi',
        version: '1.0.0',
        created_at: new Date().toISOString(),
      };

      await withTimeout(setDoc(doc(db, 'products', testId), sample), 8000);
      setTestDocFeedback({
        success: true,
        message: `"${sample.name}" belgesi Firestore "products" koleksiyonuna başarıyla yazıldı!`,
      });
      // Re-run test to refresh counter
      testFirestoreConnection();
    } catch (err: any) {
      setTestDocFeedback({
        success: false,
        message: `Kayıt durumu: ${err?.message || 'Yetki veya bağlantı hatası'}`,
      });
    } finally {
      setIsCreatingTestDoc(false);
    }
  };

  // Quick parser for pasted JavaScript snippet or JSON
  const handleParseSnippet = () => {
    if (!pasteSnippet.trim()) return;

    try {
      const text = pasteSnippet.trim();
      const extracted: Partial<FirebaseConfigType> = {};

      // Match properties using regex
      const matchProp = (prop: string) => {
        const regex = new RegExp(`['"]?${prop}['"]?\\s*:\\s*['"]([^'"]+)['"]`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : undefined;
      };

      const apiKey = matchProp('apiKey');
      const authDomain = matchProp('authDomain');
      const projectId = matchProp('projectId');
      const storageBucket = matchProp('storageBucket');
      const messagingSenderId = matchProp('messagingSenderId');
      const appId = matchProp('appId');
      const measurementId = matchProp('measurementId');

      if (apiKey) extracted.apiKey = apiKey;
      if (authDomain) extracted.authDomain = authDomain;
      if (projectId) extracted.projectId = projectId;
      if (storageBucket) extracted.storageBucket = storageBucket;
      if (messagingSenderId) extracted.messagingSenderId = messagingSenderId;
      if (appId) extracted.appId = appId;
      if (measurementId) extracted.measurementId = measurementId;

      if (!extracted.projectId && !extracted.apiKey) {
        // Try direct JSON.parse
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') {
            Object.assign(extracted, parsed);
          }
        } catch {
          // not clean json
        }
      }

      if (extracted.projectId || extracted.apiKey) {
        setEditForm((prev) => ({
          ...prev,
          ...extracted,
        }));
        setSaveStatus({
          success: true,
          message: 'Firebase yapılandırması metinden başarıyla ayrıştırıldı ve forma aktarıldı!',
        });
        setPasteSnippet('');
      } else {
        setSaveStatus({
          success: false,
          message: 'Yapıştırılan metinde apiKey veya projectId bulunamadı. Lütfen Firebase Console Web SDK kodunu yapıştırınız.',
        });
      }
    } catch (err: any) {
      setSaveStatus({
        success: false,
        message: 'Ayrıştırma hatası: ' + (err?.message || 'Geçersiz format'),
      });
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.projectId.trim() || !editForm.apiKey.trim()) {
      setSaveStatus({
        success: false,
        message: 'Proje ID ve API Anahtarı alanları zorunludur.',
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const updated = await setRuntimeFirebaseConfig(editForm);
      setCurrentConfig(updated);
      setSaveStatus({
        success: true,
        message: 'Firebase bağlantı ayarları başarıyla güncellendi ve yeni bağlantı başlatıldı!',
      });
      setIsEditing(false);
      // Run connectivity test immediately with new config
      setTimeout(() => {
        testFirestoreConnection(updated);
      }, 300);
    } catch (err: any) {
      setSaveStatus({
        success: false,
        message: 'Ayarlar kaydedilirken hata oluştu: ' + (err?.message || ''),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('Firebase bağlantı ayarlarını varsayılan ayarlara sıfırlamak istediğinize emin misiniz?')) {
      return;
    }

    setIsSaving(true);
    try {
      const resetConfig = await resetRuntimeFirebaseConfig();
      setCurrentConfig(resetConfig);
      setEditForm(resetConfig);
      setIsEditing(false);
      setSaveStatus({
        success: true,
        message: 'Firebase ayarları varsayılanlara sıfırlandı.',
      });
      setTimeout(() => {
        testFirestoreConnection(resetConfig);
      }, 300);
    } catch (err: any) {
      setSaveStatus({
        success: false,
        message: 'Sıfırlama hatası: ' + (err?.message || ''),
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  const isCustomized =
    currentConfig.projectId !== defaultFirebaseConfig.projectId ||
    currentConfig.apiKey !== defaultFirebaseConfig.apiKey;

  const recommendedRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-[#eff6ff] text-[#2563eb] rounded-xl border border-[#bfdbfe]">
              <Database className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-lg font-bold text-[#1e293b]">
                  Firebase & Firestore Veritabanı Yönetimi
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] mr-1.5" />
                  Proje: <strong>{currentConfig.projectId}</strong>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                  DB: <strong>{currentConfig.firestoreDatabaseId || '(default)'}</strong>
                </span>
                {isCustomized && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                    Özel Yapılandırma
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748b] mt-1">
                Tüm ürün tanımları ve üretilen lisans kayıtları <strong>{currentConfig.projectId}</strong> Firebase projesindeki Firestore veritabanına anlık kaydedilmektedir.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                setIsEditing(!isEditing);
                setEditForm(currentConfig);
                setSaveStatus(null);
              }}
              className="px-3.5 py-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1] rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>{isEditing ? 'Düzenlemeyi Kapat' : 'Ayarları Değiştir'}</span>
            </button>
            <button
              onClick={handleCreateSampleProductInFirestore}
              disabled={isCreatingTestDoc}
              className="px-3.5 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isCreatingTestDoc ? 'Yazılıyor...' : 'Test Kaydı Ekle'}</span>
            </button>
            <button
              onClick={() => testFirestoreConnection(currentConfig)}
              disabled={testingConnection}
              className="px-3.5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}</span>
            </button>
          </div>
        </div>

        {/* Global Save Status Alert */}
        {saveStatus && (
          <div
            className={`mt-4 p-3 rounded-lg border text-xs font-semibold flex items-center space-x-2 ${
              saveStatus.success
                ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#166534]'
                : 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b]'
            }`}
          >
            {saveStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-[#166534] flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#991b1b] flex-shrink-0" />
            )}
            <span>{saveStatus.message}</span>
          </div>
        )}

        {/* Live Test Result Alert */}
        {testResult && (
          <div
            className={`mt-5 p-4 rounded-xl border flex flex-col space-y-3 text-xs leading-relaxed ${
              testResult.success
                ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]'
                : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
            }`}
          >
            <div className="flex items-start space-x-3">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-[#16a34a] flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[#dc2626] flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div className="font-bold text-sm">{testResult.message}</div>
                {testResult.errorDetails && (
                  <div className="font-mono text-[11px] bg-white/80 p-2 rounded border border-red-200 mt-2 text-[#7f1d1d]">
                    {testResult.errorDetails}
                  </div>
                )}
                {testResult.success && testResult.collections && (
                  <div className="flex flex-wrap gap-4 text-[11px] text-[#15803d] pt-1">
                    <span>
                      ⚡ Gecikme (Latency): <strong>{testResult.pingMs} ms</strong>
                    </span>
                    <span>
                      📦 Ürün Koleksiyonu (products): <strong>{testResult.collections.productsCount} belge</strong>
                    </span>
                    <span>
                      🔑 Lisans Koleksiyonu (licenses): <strong>{testResult.collections.licensesCount} belge</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* If database needs to be created in Firebase Console */}
            {testResult.needsDatabaseCreation && (
              <div className="mt-2 p-3 bg-white rounded-lg border border-red-300 text-[#1e293b] space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-xs text-[#b91c1c] flex items-center space-x-1.5">
                    <Database className="w-4 h-4 text-[#dc2626]" />
                    <span>Çözüm (1 Dakikada Firestore'u Etkinleştirin):</span>
                  </span>
                  <a
                    href={`https://console.firebase.google.com/project/${currentConfig.projectId}/firestore`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-md text-xs font-bold transition flex items-center space-x-1 shadow-sm"
                  >
                    <span>Firebase Console'da Veritabanı Oluştur</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-[#475569]">
                  <li>Yukarıdaki kırmızı <strong>"Firebase Console'da Veritabanı Oluştur"</strong> butonuna tıklayın.</li>
                  <li>Açılan sayfada <strong>"Create database" (Veritabanı oluştur)</strong> butonuna basın.</li>
                  <li>Konum seçin ve güvenlik kuralı olarak <strong>"Start in test mode" (Test modunda başlat)</strong> seçip onaylayın.</li>
                  <li>Oluşturduktan sonra bu sayfadaki <strong>"Bağlantıyı Test Et"</strong> butonuna basınız.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Test Doc Write Feedback */}
        {testDocFeedback && (
          <div
            className={`mt-3 p-3 rounded-lg border text-xs font-semibold flex items-center space-x-2 ${
              testDocFeedback.success
                ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#166534]'
                : 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b]'
            }`}
          >
            {testDocFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-[#166534] flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#991b1b] flex-shrink-0" />
            )}
            <span>{testDocFeedback.message}</span>
          </div>
        )}
      </div>

      {/* EDIT CONFIGURATION PANEL (Collapsible) */}
      {isEditing && (
        <div className="bg-white rounded-xl border-2 border-[#3b82f6] p-6 shadow-md space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-[#eff6ff] text-[#2563eb] rounded-lg">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1e293b]">
                  Firebase Bağlantı Parametrelerini Düzenle
                </h3>
                <p className="text-xs text-[#64748b]">
                  Kendi Firebase projenizin kimlik bilgilerini girerek doğrudan kendi veritabanınıza bağlanabilirsiniz.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1.5 text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Paste / Auto Parser Box */}
          <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#cbd5e1] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#334155] flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-[#2563eb]" />
                <span>Hızlı İçe Aktarma (Firebase Console Web SDK Yapılandırmasını Yapıştır)</span>
              </label>
              <button
                type="button"
                onClick={handleParseSnippet}
                disabled={!pasteSnippet.trim()}
                className="px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md text-xs font-bold transition flex items-center space-x-1 disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Ayrıştır ve Doldur</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={pasteSnippet}
              onChange={(e) => setPasteSnippet(e.target.value)}
              placeholder="const firebaseConfig = { apiKey: 'AIza...', authDomain: '...', projectId: '...', storageBucket: '...', messagingSenderId: '...', appId: '...' };"
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none bg-white text-[#1e293b]"
            />
            <p className="text-[11px] text-[#64748b]">
              İpucu: Firebase Console &gt; Proje Ayarları sayfasındaki <code>firebaseConfig</code> objesini buraya yapıştırıp "Ayrıştır ve Doldur" butonuna tıklayabilirsiniz.
            </p>
          </div>

          {/* Main Form */}
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project ID */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Proje Kimliği (Project ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.projectId}
                  onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
                  placeholder="örn: lisanslama"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Web API Anahtarı (apiKey) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.apiKey}
                  onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                  placeholder="örn: AIzaSy..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none"
                />
              </div>

              {/* Auth Domain */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Auth Domain
                </label>
                <input
                  type="text"
                  value={editForm.authDomain}
                  onChange={(e) => setEditForm({ ...editForm, authDomain: e.target.value })}
                  placeholder="örn: proje-id.firebaseapp.com"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none"
                />
              </div>

              {/* Storage Bucket */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Storage Bucket
                </label>
                <input
                  type="text"
                  value={editForm.storageBucket}
                  onChange={(e) => setEditForm({ ...editForm, storageBucket: e.target.value })}
                  placeholder="örn: proje-id.firebasestorage.app"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none"
                />
              </div>

              {/* App ID */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  App ID
                </label>
                <input
                  type="text"
                  value={editForm.appId}
                  onChange={(e) => setEditForm({ ...editForm, appId: e.target.value })}
                  placeholder="örn: 1:175186698188:web:9d03f143..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none"
                />
              </div>

              {/* Messaging Sender ID */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Messaging Sender ID
                </label>
                <input
                  type="text"
                  value={editForm.messagingSenderId}
                  onChange={(e) => setEditForm({ ...editForm, messagingSenderId: e.target.value })}
                  placeholder="örn: 175186698188"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none"
                />
              </div>

              {/* Measurement ID */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Measurement ID (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={editForm.measurementId || ''}
                  onChange={(e) => setEditForm({ ...editForm, measurementId: e.target.value })}
                  placeholder="örn: G-QR2D6Q335V"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none"
                />
              </div>

              {/* Firestore Database ID */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Firestore Database ID
                </label>
                <input
                  type="text"
                  value={editForm.firestoreDatabaseId || '(default)'}
                  onChange={(e) => setEditForm({ ...editForm, firestoreDatabaseId: e.target.value })}
                  placeholder="(default)"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[#e2e8f0] flex-wrap gap-2">
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isSaving}
                className="px-4 py-2 bg-[#f8fafc] hover:bg-[#fee2e2] text-[#991b1b] border border-[#fecaca] rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Varsayılanlara Sıfırla</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#334155] rounded-lg text-xs font-bold transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Kaydediliyor...' : 'Kaydet ve Bağlan'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Security Rules Helper if permission is blocked */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
            <h3 className="text-sm font-bold text-[#1e293b]">
              Firebase Console Firestore Güvenlik Kuralları (Security Rules)
            </h3>
          </div>
          <button
            onClick={() => copyToClipboard(recommendedRules, 'rules')}
            className="text-xs text-[#2563eb] hover:text-[#1d4ed8] flex items-center space-x-1 font-medium cursor-pointer"
          >
            {copiedKey === 'rules' ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#16a34a]" />
                <span className="text-[#16a34a]">Kurallar Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Kuralı Kopyala</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-[#64748b] leading-relaxed">
          Eğer Firestore kaydında <code>permission-denied</code> alıyorsanız, Firebase Console üzerinde Firestore veritabanınızın güvenlik kurallarını aşağıdaki gibi ayarlayıp <strong>Yayınla (Publish)</strong> butonuna basınız:
        </p>

        <div className="relative bg-[#0f172a] text-[#f8fafc] p-3 rounded-lg font-mono text-xs overflow-x-auto">
          <pre>{recommendedRules}</pre>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-[#64748b]">
          <Info className="w-3.5 h-3.5 text-[#3b82f6]" />
          <span>
            Firebase Console Adresi:{' '}
            <a
              href={`https://console.firebase.google.com/project/${currentConfig.projectId}/firestore/rules`}
              target="_blank"
              rel="noreferrer"
              className="text-[#2563eb] hover:underline font-semibold inline-flex items-center space-x-0.5"
            >
              <span>console.firebase.google.com/project/{currentConfig.projectId}/firestore/rules</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </span>
        </div>
      </div>

      {/* Grid: Config Details & Security Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Active Firebase Config */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
            <h3 className="text-sm font-bold text-[#1e293b] flex items-center space-x-2">
              <Server className="w-4 h-4 text-[#3b82f6]" />
              <span>Etkin Firebase Yapılandırması</span>
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditForm(currentConfig);
                }}
                className="text-xs text-[#2563eb] hover:text-[#1d4ed8] flex items-center space-x-1 font-semibold cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Düzenle</span>
              </button>
              <span className="text-[#cbd5e1]">|</span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(currentConfig, null, 2), 'config')}
                className="text-xs text-[#64748b] hover:text-[#1e293b] flex items-center space-x-1 font-medium cursor-pointer"
              >
                {copiedKey === 'config' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#16a34a]" />
                    <span className="text-[#16a34a]">Kopyalandı</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] font-medium">Project ID:</span>
              <span className="font-mono font-bold text-[#1e293b]">{currentConfig.projectId}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] font-medium">API Key:</span>
              <span className="font-mono text-[#1e293b] truncate max-w-[200px]">{currentConfig.apiKey}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] font-medium">Auth Domain:</span>
              <span className="font-mono text-[#1e293b]">{currentConfig.authDomain}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] font-medium">Storage Bucket:</span>
              <span className="font-mono text-[#1e293b]">{currentConfig.storageBucket}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] font-medium">Messaging Sender ID:</span>
              <span className="font-mono text-[#1e293b]">{currentConfig.messagingSenderId}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] font-medium">App ID:</span>
              <span className="font-mono text-[#1e293b] truncate max-w-[200px]">{currentConfig.appId}</span>
            </div>
            {currentConfig.measurementId && (
              <div className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                <span className="text-[#64748b] font-medium">Measurement ID:</span>
                <span className="font-mono text-[#1e293b]">{currentConfig.measurementId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Architecture & Collections */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm space-y-4">
          <div className="border-b border-[#e2e8f0] pb-3">
            <h3 className="text-sm font-bold text-[#1e293b] flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#3b82f6]" />
              <span>Firestore Veri Şeması & Koleksiyonlar</span>
            </h3>
          </div>

          <div className="space-y-3">
            {/* Products collection */}
            <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-[#2563eb]">/products/{'{productId}'}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#eff6ff] text-[#1d4ed8] rounded font-semibold">Koleksiyon</span>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Tanımlanan yazılım projeleri (ad, benzersiz <code>productId</code>, sürüm, açıklama).
              </p>
            </div>

            {/* Licenses collection */}
            <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-[#2563eb]">/licenses/{'{licenseId}'}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#eff6ff] text-[#1d4ed8] rounded font-semibold">Koleksiyon</span>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Üretilen tüm lisanslar, RSA imzalı ham anahtar (<code>raw_key</code>), durum, süre ve hareket günlüğü (<code>logs</code>).
              </p>
            </div>

            {/* Security Rules */}
            <div className="p-3 bg-[#f0fdf4] rounded-lg border border-[#bbf7d0] space-y-1">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#166534]">
                <ShieldCheck className="w-4 h-4" />
                <span>Firestore Doğrudan Yazma & Senkronizasyon</span>
              </div>
              <p className="text-[11px] text-[#15803d]">
                Veritabanı işlemleri doğrudan <code>{currentConfig.projectId}</code> projenize <code>setDoc</code> ve <code>deleteDoc</code> ile anlık olarak işlenir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

