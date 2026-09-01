import React, { useState, useRef, useEffect } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, RefreshCw,
  Send, Wifi, Clock, Terminal, Copy, Check,
  Trash2, ChevronDown, ChevronRight, Info, Zap,
  ShieldCheck, ShieldAlert,
} from 'lucide-react';

type LogLevel = 'success' | 'error' | 'info' | 'warning';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  title: string;
  detail?: string;
  durationMs?: number;
  raw?: any;
}

interface EndpointStatus {
  url: string;
  label: string;
  status: 'idle' | 'checking' | 'ok' | 'error';
  latencyMs?: number;
  statusCode?: number;
}

function levelColor(level: LogLevel): string {
  const m: Record<LogLevel, string> = {
    success: 'text-emerald-400',
    error: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-sky-400',
  };
  return m[level];
}

function levelBg(level: LogLevel): string {
  const m: Record<LogLevel, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30',
    error: 'bg-red-500/10 border-red-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    info: 'bg-sky-500/10 border-sky-500/30',
  };
  return m[level];
}

function LevelIcon({ level }: { level: LogLevel }) {
  if (level === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
  if (level === 'error')   return <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
  if (level === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  return <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />;
}

const ERROR_TRANSLATIONS: Record<string, string> = {
  INVALID_SIGNATURE: 'Gecersiz Imza - Lisans anahtari degistirilmis ya da bu sunucuya ait degil.',
  LICENSE_REVOKED: 'Lisans Iptal Edildi - Yonetici bu lisansi revoke etti.',
  LICENSE_PAUSED: 'Lisans Donduruldu - Yonetici bu lisansi gecici olarak devre disi birakti.',
  LICENSE_EXPIRED: 'Lisans Suresi Doldu - Gecerlilik tarihi gecmis.',
  PRODUCT_MISMATCH: 'Urun Uyumsuzlugu - Lisans baska bir urun icin.',
  MACHINE_ID_MISMATCH: 'Makine Kimligi Uyusmuyor - Lisans farkli bir cihaza kilitli.',
  MISSING_LICENSE_KEY: 'Lisans Anahtari Eksik - license_key alani yok.',
  INTERNAL_ERROR: 'Sunucu Hatasi - Sunucu tarafli bir hata olustu.',
};

const ERROR_FIX: Record<string, string> = {
  INVALID_SIGNATURE: "Lisans Veritabani'ndan dogru anahtari kopyalayin",
  LICENSE_REVOKED: 'Lisans Veritabani > Lisans > Aktif Et butonuna tiklayin',
  LICENSE_PAUSED: 'Lisans Veritabani > Lisans > Play (Aktif Et) butonuna tiklayin',
  LICENSE_EXPIRED: 'Lisans Veritabani > Lisans > Saat simgesi ile sureyi uzatin',
  PRODUCT_MISMATCH: "Uygulamanizda product_id'yi ayni yazin",
  MACHINE_ID_MISMATCH: "Lisanstaki machine_id'yi kontrol edin",
  MISSING_LICENSE_KEY: 'API isteginize license_key ekleyin',
  INTERNAL_ERROR: 'Sunucu loglarini kontrol edin, yeniden baslatin',
};

const ERROR_ROWS = [
  'INVALID_SIGNATURE', 'LICENSE_REVOKED', 'LICENSE_PAUSED', 'LICENSE_EXPIRED',
  'PRODUCT_MISMATCH', 'MACHINE_ID_MISMATCH', 'MISSING_LICENSE_KEY', 'INTERNAL_ERROR',
];

export const ApiDiagnosticsView: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    { url: '/api/status',    label: 'Genel Durum API',             status: 'idle' },
    { url: '/api/licenses',  label: 'Lisans Listesi API',          status: 'idle' },
    { url: '/api/products',  label: 'Urun Listesi API',            status: 'idle' },
    { url: '/api/keys',      label: 'RSA Anahtar API',             status: 'idle' },
    { url: '/api/v1/verify', label: 'Lisans Dogrulama API (POST)', status: 'idle' },
  ]);
  const [testKey, setTestKey] = useState('');
  const [testProductId, setTestProductId] = useState('');
  const [testMachineId, setTestMachineId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prev) => [...prev, { ...entry, id: crypto.randomUUID(), timestamp: new Date() }]);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const checkEndpoint = async (ep: EndpointStatus, index: number) => {
    setEndpoints((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'checking' } : e)));
    const start = performance.now();
    try {
      const method = ep.url === '/api/v1/verify' ? 'POST' : 'GET';
      const body = method === 'POST' ? JSON.stringify({ license_key: '__health_check__' }) : undefined;
      const res = await fetch(ep.url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      const latencyMs = Math.round(performance.now() - start);
      const ok = res.status < 500;
      setEndpoints((prev) =>
        prev.map((e, i) => (i === index ? { ...e, status: ok ? 'ok' : 'error', latencyMs, statusCode: res.status } : e))
      );
      addLog({
        level: ok ? 'success' : 'error',
        title: `${ep.label} - HTTP ${res.status} (${latencyMs}ms)`,
        detail: ok ? `"${ep.url}" basariyla yanit verdi.` : `"${ep.url}" HTTP ${res.status} ile yanit verdi.`,
        durationMs: latencyMs,
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      setEndpoints((prev) =>
        prev.map((e, i) => (i === index ? { ...e, status: 'error', latencyMs } : e))
      );
      addLog({
        level: 'error',
        title: `${ep.label} - Baglanti Hatasi`,
        detail: `"${ep.url}" adresine ulasilamadi: ${err.message}`,
        durationMs: latencyMs,
      });
    }
  };

  const checkAll = async () => {
    addLog({ level: 'info', title: "Tum endpoint'ler kontrol ediliyor..." });
    for (let i = 0; i < endpoints.length; i++) {
      await checkEndpoint(endpoints[i], i);
    }
    addLog({ level: 'info', title: 'Saglik kontrolu tamamlandi.' });
  };

  const handleVerify = async () => {
    if (!testKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();
    addLog({
      level: 'info',
      title: 'Lisans dogrulama istegi gonderiliyor...',
      detail: `product_id: ${testProductId || '(belirtilmedi)'} | machine_id: ${testMachineId || '(belirtilmedi)'}`,
    });
    try {
      const body: any = { license_key: testKey.trim() };
      if (testProductId.trim()) body.product_id = testProductId.trim();
      if (testMachineId.trim()) body.machine_id = testMachineId.trim();
      const res = await fetch('/api/v1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const latencyMs = Math.round(performance.now() - start);
      const json = await res.json().catch(() => ({ valid: false, error: 'JSON_PARSE_ERROR', message: 'Sunucu gecersiz yanit dondurdu.' }));
      setTestResult({ ...json, latencyMs, httpStatus: res.status });
      const isValid = json.valid === true;
      const errorCode = json.error as string | undefined;
      addLog({
        level: isValid ? 'success' : 'error',
        title: isValid ? `Lisans GECERLI - ${latencyMs}ms` : `Lisans GECERSIZ (${errorCode || 'UNKNOWN'}) - ${latencyMs}ms`,
        detail: (errorCode ? ERROR_TRANSLATIONS[errorCode] : undefined) || json.message || 'Bilinmeyen hata.',
        durationMs: latencyMs,
        raw: json,
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      addLog({
        level: 'error',
        title: `Istek Basarisiz - ${latencyMs}ms`,
        detail: `Sunucuya baglaниlamadi: ${err.message}`,
        durationMs: latencyMs,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1e293b] flex items-center space-x-2">
              <Activity className="w-5 h-5 text-[#3b82f6]" />
              <span>API Tanilama Merkezi</span>
            </h2>
            <p className="text-xs text-[#64748b] mt-1">
              Lisanslama sunucusunun calisip calismаdigini test edin, bir lisansi dogrulayin ve hata mesajlarini gorun.
            </p>
          </div>
          <button
            onClick={checkAll}
            className="px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold transition flex items-center space-x-2 shadow-sm cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Tum Servisleri Test Et</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Endpoint Health */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0]">
              <h3 className="text-sm font-bold text-[#1e293b] flex items-center space-x-2">
                <Wifi className="w-4 h-4 text-[#3b82f6]" />
                <span>Servis Saglik Durumu</span>
              </h3>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {endpoints.map((ep, i) => (
                <div key={ep.url} className="flex items-center justify-between px-5 py-3 text-xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {ep.status === 'checking' ? (
                      <RefreshCw className="w-3.5 h-3.5 text-[#3b82f6] animate-spin flex-shrink-0" />
                    ) : ep.status === 'ok' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    ) : ep.status === 'error' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-[#1e293b] truncate">{ep.label}</div>
                      <div className="font-mono text-[10px] text-[#94a3b8]">{ep.url}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    {ep.latencyMs !== undefined && (
                      <span className="text-[10px] text-[#64748b] font-mono">{ep.latencyMs}ms</span>
                    )}
                    {ep.statusCode !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ep.statusCode < 400 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {ep.statusCode}
                      </span>
                    )}
                    <button
                      onClick={() => checkEndpoint(ep, i)}
                      disabled={ep.status === 'checking'}
                      className="p-1 hover:bg-[#f1f5f9] rounded cursor-pointer text-[#64748b] hover:text-[#2563eb] transition disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${ep.status === 'checking' ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verify Form */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0]">
              <h3 className="text-sm font-bold text-[#1e293b] flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#3b82f6]" />
                <span>Lisans Dogrulama Testi</span>
              </h3>
              <p className="text-[11px] text-[#64748b] mt-0.5">
                Diger uygulamanin gonderdigi istek formatini simule edin
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                  Lisans Anahtari (license_key) *
                </label>
                <textarea
                  rows={4}
                  value={testKey}
                  onChange={(e) => setTestKey(e.target.value)}
                  placeholder="Lisans anahtarini buraya yapistirin..."
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[11px] font-mono text-[#1e293b] focus:border-[#3b82f6] outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                    Urun Kodu (product_id)
                  </label>
                  <input
                    type="text"
                    value={testProductId}
                    onChange={(e) => setTestProductId(e.target.value)}
                    placeholder="orn: muhasebe-pro"
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                    Makine Kimligi (machine_id)
                  </label>
                  <input
                    type="text"
                    value={testMachineId}
                    onChange={(e) => setTestMachineId(e.target.value)}
                    placeholder="orn: WIN-ABC12345"
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleVerify}
                disabled={!testKey.trim() || isTesting}
                className="w-full px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dogrulanıyor...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>POST /api/v1/verify - Gonder</span>
                  </>
                )}
              </button>

              {testResult && (
                <div className={`rounded-xl border p-4 text-xs space-y-3 ${testResult.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`flex items-center space-x-2 font-bold ${testResult.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                    {testResult.valid ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                    <span>{testResult.valid ? 'Lisans GECERLI' : 'Lisans GECERSIZ'}</span>
                    <span className="ml-auto font-mono text-[10px] font-normal opacity-70">
                      {testResult.latencyMs}ms - HTTP {testResult.httpStatus}
                    </span>
                  </div>
                  {testResult.error && ERROR_TRANSLATIONS[testResult.error] && (
                    <div className="p-2.5 bg-white border border-red-200 rounded-lg text-red-800 font-medium">
                      {ERROR_TRANSLATIONS[testResult.error]}
                    </div>
                  )}
                  {testResult.error && ERROR_FIX[testResult.error] && (
                    <div className="p-2.5 bg-white border border-amber-200 rounded-lg text-amber-800 font-medium">
                      Cozum: {ERROR_FIX[testResult.error]}
                    </div>
                  )}
                  <div className="text-[#475569]">{testResult.message}</div>
                  {testResult.payload && (
                    <div className="space-y-1 text-[11px] bg-white border border-[#e2e8f0] rounded-lg p-3">
                      <div className="font-bold text-[#64748b] uppercase text-[10px] mb-2">Lisans Bilgileri</div>
                      {[
                        ['Musteri', testResult.payload.customer],
                        ['Urun', testResult.payload.product_id],
                        ['Tip', testResult.payload.license_type],
                        ['Gecerlilik', testResult.payload.expires_at ? new Date(testResult.payload.expires_at).toLocaleString('tr-TR') : '-'],
                        ['Kullanim Sayisi', String(testResult.usage_count ?? '-')],
                        ['Son Kullanim', testResult.last_used_at ? new Date(testResult.last_used_at).toLocaleString('tr-TR') : '-'],
                      ].map(([label, value]) =>
                        value && value !== '-' ? (
                          <div key={label} className="flex justify-between">
                            <span className="text-[#64748b]">{label}:</span>
                            <span className="font-semibold">{value}</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                  <details className="group">
                    <summary className="cursor-pointer text-[10px] text-[#64748b] flex items-center space-x-1 select-none">
                      <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                      <span>Ham JSON yaniti goster</span>
                    </summary>
                    <div className="relative mt-2">
                      <pre className="bg-[#0f172a] text-[#38bdf8] text-[10px] font-mono p-3 rounded-lg overflow-x-auto max-h-40">
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                      <button
                        onClick={() => copyText(JSON.stringify(testResult, null, 2), 'raw-json')}
                        className="absolute top-2 right-2 p-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded cursor-pointer"
                      >
                        {copiedId === 'raw-json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Log Console */}
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '520px' }}>
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-[#38bdf8]" />
              <span>Aktivite Gunlugu</span>
              <span className="ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] font-mono">
                {logs.length} kayit
              </span>
            </h3>
            <button
              onClick={() => setLogs([])}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400 transition cursor-pointer"
              title="Gunlugu Temizle"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 space-y-3 text-slate-500">
                <Terminal className="w-8 h-8 opacity-30" />
                <p className="text-center">
                  Henuz aktivite yok.
                  <br />
                  Testleri calistirin.
                </p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-lg border p-2.5 cursor-pointer transition ${levelBg(log.level)}`}
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex items-start space-x-2">
                    <LevelIcon level={log.level} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold leading-snug ${levelColor(log.level)}`}>{log.title}</div>
                      <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-slate-500">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{log.timestamp.toLocaleTimeString('tr-TR')}</span>
                        {log.durationMs !== undefined && (
                          <span className="text-slate-600">- {log.durationMs}ms</span>
                        )}
                      </div>
                    </div>
                    {(log.detail || log.raw) && (
                      expandedLog === log.id
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  {expandedLog === log.id && log.detail && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-slate-300 text-[11px] leading-relaxed">
                      {log.detail}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
          <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Canli Tanilama Aktif</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-emerald-500">{logs.filter((l) => l.level === 'success').length} basarili</span>
              <span className="text-red-400">{logs.filter((l) => l.level === 'error').length} hata</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Reference Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e2e8f0]">
          <h3 className="text-sm font-bold text-[#1e293b] flex items-center space-x-2">
            <Info className="w-4 h-4 text-[#3b82f6]" />
            <span>Hata Kodu Referans Tablosu</span>
          </h3>
          <p className="text-[11px] text-[#64748b] mt-0.5">
            Diger uygulamaniz bu hata kodlarini aldiginda ne anlama gelir ve nasil cozulur
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Hata Kodu</th>
                <th className="px-5 py-3 text-left">Aciklama</th>
                <th className="px-5 py-3 text-left">Cozum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {ERROR_ROWS.map((code) => (
                <tr key={code} className="hover:bg-[#f8fafc]">
                  <td className="px-5 py-3">
                    <code className="px-2 py-1 bg-[#fee2e2] text-[#991b1b] rounded text-[11px] font-bold">
                      {code}
                    </code>
                  </td>
                  <td className="px-5 py-3 text-[#475569]">{ERROR_TRANSLATIONS[code]}</td>
                  <td className="px-5 py-3 text-[#166534] font-medium">{ERROR_FIX[code]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
