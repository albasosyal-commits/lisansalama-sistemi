import React, { useState, useEffect } from 'react';
import {
  FilePlus2,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Cpu,
  Calendar,
  Sparkles,
  User,
  Package,
  Layers,
  ArrowRight,
  Info,
  Clock,
} from 'lucide-react';
import { CreateLicenseParams, LicenseType, Product, StoredLicense } from '../types';
import { api } from '../services/api';

interface LicenseGeneratorProps {
  products: Product[];
  onLicenseCreated: (license: StoredLicense) => void;
  onNavigateToVerifier: (key: string) => void;
  onAddProductClick: () => void;
}

export const LicenseGenerator: React.FC<LicenseGeneratorProps> = ({
  products,
  onLicenseCreated,
  onNavigateToVerifier,
  onAddProductClick,
}) => {
  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customer, setCustomer] = useState<string>('');
  const [licenseType, setLicenseType] = useState<LicenseType>('yearly');
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [machineId, setMachineId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [maxUsers, setMaxUsers] = useState<string>('');
  const [featureModules, setFeatureModules] = useState<string>('core, export, pro');

  // Generation status state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<{
    license: StoredLicense;
    payload: any;
    licenseKey: string;
  } | null>(null);

  // Set default product if available
  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].productId);
    }
  }, [products, selectedProductId]);

  // Calculate live dates
  const calculateDates = () => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (licenseType === 'demo') {
      end.setDate(start.getDate() + 10);
    } else if (licenseType === 'yearly') {
      end.setDate(start.getDate() + 365);
    } else {
      if (customStartDate) start = new Date(customStartDate + 'T00:00:00Z');
      if (customEndDate) end = new Date(customEndDate + 'T23:59:59Z');
    }

    return {
      issuedAt: start.toISOString(),
      expiresAt: end.toISOString(),
    };
  };

  const dates = calculateDates();

  // Helper for generating sample machine ID
  const handleGenerateSampleMachineId = () => {
    const sampleId =
      'HWID-' +
      Math.random().toString(36).substring(2, 8).toUpperCase() +
      '-' +
      Math.random().toString(36).substring(2, 8).toUpperCase();
    setMachineId(sampleId);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductId) {
      setError('Lütfen lisans üretilecek bir ürün seçin.');
      return;
    }

    if (!customer.trim()) {
      setError('Lütfen müşteri adı veya firma / e-posta adresini girin.');
      return;
    }

    try {
      setLoading(true);

      const extra: Record<string, unknown> = {};
      if (maxUsers.trim()) {
        extra.max_users = parseInt(maxUsers, 10) || 1;
      }
      if (featureModules.trim()) {
        extra.modules = featureModules
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean);
      }

      const params: CreateLicenseParams = {
        product_id: selectedProductId,
        customer: customer.trim(),
        license_type: licenseType,
        custom_issued_at: dates.issuedAt,
        custom_expires_at: dates.expiresAt,
        machine_id: machineId.trim() || undefined,
        notes: notes.trim() || undefined,
        extra: Object.keys(extra).length > 0 ? extra : undefined,
      };

      const res = await api.createLicense(params);
      setGeneratedResult(res);
      onLicenseCreated(res.license);
    } catch (err: any) {
      setError(err?.message || 'Lisans oluşturulurken bir hata meydana geldi.');
    } finally {
      setLoading(false);
    }
  };

  // Copy Key to Clipboard
  const handleCopyKey = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult.licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Copy Payload JSON to Clipboard
  const handleCopyPayload = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(JSON.stringify(generatedResult.payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Download License as .lic / .txt
  const handleDownloadFile = () => {
    if (!generatedResult) return;
    const blob = new Blob([generatedResult.licenseKey], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanCustomer = generatedResult.license.customer.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `license_${generatedResult.license.product_id}_${cleanCustomer}.lic`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedProductObj = products.find((p) => p.productId === selectedProductId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: License Generation Form */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1e293b]">
                Yeni Lisans Oluştur
              </h2>
              <p className="text-xs text-[#64748b] mt-0.5">
                RSA-SHA256 asimetrik imzalı, çevrimdışı doğrulanabilir anahtar üretin
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold bg-[#dcfce7] text-[#166534] border border-[#bbf7d0] rounded-full flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>RSA-2048</span>
            </span>
          </div>

          {error && (
            <div className="mt-4 p-3.5 rounded-lg bg-[#fee2e2] border border-[#fecaca] text-[#991b1b] text-xs sm:text-sm flex items-start space-x-2">
              <Info className="w-4 h-4 text-[#ef4444] flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Product Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#64748b] flex items-center space-x-1.5">
                  <Package className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span>Hedef Ürün / Proje *</span>
                </label>
                <button
                  type="button"
                  onClick={onAddProductClick}
                  className="text-xs text-[#3b82f6] hover:text-[#2563eb] font-semibold transition"
                >
                  + Yeni Ürün Ekle
                </button>
              </div>
              {products.length === 0 ? (
                <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#cbd5e1] text-xs text-[#64748b] flex justify-between items-center">
                  <span>Henüz ürün tanımlanmamış.</span>
                  <button
                    type="button"
                    onClick={onAddProductClick}
                    className="px-2.5 py-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-medium"
                  >
                    Ürün Ekle
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="select-product"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3.5 py-2.5 text-sm text-[#1e293b] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] outline-none transition appearance-none cursor-pointer"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.productId}>
                        {p.name} ({p.productId}) — v{p.version}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-3 pointer-events-none text-[#64748b]">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              )}
              {selectedProductObj && (
                <p className="mt-1 text-[11px] text-[#64748b]">
                  {selectedProductObj.description || 'Seçili ürün için dijital imza üretilecek.'}
                </p>
              )}
            </div>

            {/* Customer Name / Company / Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1.5">
                <span className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span>Müşteri / Kurum Adı veya E-posta *</span>
                </span>
              </label>
              <input
                id="input-customer"
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Örn: Acme A.Ş. / musteri@firma.com"
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3.5 py-2.5 text-sm text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] outline-none transition"
              />
            </div>

            {/* License Type Selection (Geometric Balance Style) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-2">
                <span className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span>Lisans Tipi & Geçerlilik Süresi</span>
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {/* Demo */}
                <button
                  type="button"
                  id="btn-type-demo"
                  onClick={() => setLicenseType('demo')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    licenseType === 'demo'
                      ? 'bg-[#eff6ff] border-[#3b82f6] text-[#1d4ed8] font-semibold ring-1 ring-[#3b82f6]/40'
                      : 'bg-[#f8fafc] border-[#cbd5e1] text-[#475569] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm">Demo</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#bfdbfe] text-[#1e40af] font-semibold">
                      10 Gün
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748b] mt-1">Deneme & POC süresi</p>
                </button>

                {/* Yearly */}
                <button
                  type="button"
                  id="btn-type-yearly"
                  onClick={() => setLicenseType('yearly')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    licenseType === 'yearly'
                      ? 'bg-[#eff6ff] border-[#3b82f6] text-[#1d4ed8] font-semibold ring-1 ring-[#3b82f6]/40'
                      : 'bg-[#f8fafc] border-[#cbd5e1] text-[#475569] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm">Yıllık</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#166534] font-semibold">
                      365 Gün
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748b] mt-1">Standart abonelik</p>
                </button>

                {/* Custom */}
                <button
                  type="button"
                  id="btn-type-custom"
                  onClick={() => setLicenseType('custom')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    licenseType === 'custom'
                      ? 'bg-[#eff6ff] border-[#3b82f6] text-[#1d4ed8] font-semibold ring-1 ring-[#3b82f6]/40'
                      : 'bg-[#f8fafc] border-[#cbd5e1] text-[#475569] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm">Özel Süre</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] font-semibold">
                      Manuel
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748b] mt-1">Tarih veya gün seç</p>
                </button>
              </div>
            </div>

            {/* Custom Date Configuration */}
            {licenseType === 'custom' && (
              <div className="p-3.5 bg-[#f8fafc] rounded-lg border border-[#cbd5e1] space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                      Başlangıç Tarihi (UTC)
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                      Bitiş Tarihi (UTC)
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Machine ID / Hardware Fingerprint Lock */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#64748b] flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span>Makine / Donanım Kimliği (Machine ID) (Opsiyonel)</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSampleMachineId}
                  className="text-xs text-[#3b82f6] hover:text-[#2563eb] font-semibold transition"
                >
                  Örnek HWID Üret
                </button>
              </div>
              <input
                id="input-machine-id"
                type="text"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                placeholder="Örn: HWID-9F8A-33C1 veya boş bırakın (tüm cihazlarda çalışır)"
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-mono text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] outline-none transition"
              />
              <p className="mt-1 text-[11px] text-[#64748b]">
                Belirtilirse lisans sadece bu donanım koduna sahip bilgisayarda geçerli olur.
              </p>
            </div>

            {/* Optional Metadata: Max Users & Extra Modules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                  Kullanıcı Limiti (Opsiyonel)
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                  placeholder="Örn: 5 (Sınırsız için boş)"
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                  Yetkili Modüller (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={featureModules}
                  onChange={(e) => setFeatureModules(e.target.value)}
                  placeholder="core, export, analytics"
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] outline-none"
                />
              </div>
            </div>

            {/* Submit Button (Geometric Balance) */}
            <div className="pt-3">
              <button
                type="submit"
                id="btn-generate-license"
                disabled={loading || products.length === 0}
                className="w-full py-3 px-4 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold text-sm shadow-sm flex items-center justify-center space-x-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <span>Lisans İmzalanıyor...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>İmzala ve Lisans Üret</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column: Live Payload & Generated License Output */}
      <div className="lg:col-span-5 space-y-6">
        {/* Output Box (When generated) */}
        {generatedResult ? (
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                <h3 className="font-bold text-[#1e293b] text-base">Lisans Başarıyla Üretildi</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] text-xs font-semibold border border-[#bbf7d0]">
                RSA İmzalandı
              </span>
            </div>

            {/* Formatted License String Output */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1.5">
                Üretilen Anahtar (base64.payload + signature):
              </label>
              <div className="relative">
                <textarea
                  readOnly
                  rows={4}
                  value={generatedResult.licenseKey}
                  className="w-full bg-[#0f172a] font-mono text-[11px] leading-relaxed text-[#10b981] p-3 rounded-lg border border-slate-800 focus:outline-none select-all"
                />
              </div>

              {/* Actions: Copy & Download */}
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <button
                  type="button"
                  id="btn-copy-license-key"
                  onClick={handleCopyKey}
                  className="py-2.5 px-3 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-sm cursor-pointer"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey ? 'Kopyalandı!' : 'Anahtarı Kopyala'}</span>
                </button>
                <button
                  type="button"
                  id="btn-download-license-file"
                  onClick={handleDownloadFile}
                  className="py-2.5 px-3 rounded-lg bg-white hover:bg-[#f8fafc] text-[#1e293b] text-xs font-semibold flex items-center justify-center space-x-1.5 border border-[#cbd5e1] transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#3b82f6]" />
                  <span>.lic İndir</span>
                </button>
              </div>
            </div>

            {/* Quick Test Sandbox Trigger */}
            <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-[#475569]">
                <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                <span>Doğrulamayı test et:</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToVerifier(generatedResult.licenseKey)}
                className="px-3 py-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] font-semibold rounded-lg border border-[#bfdbfe] transition cursor-pointer"
              >
                Sandbox'ta Aç &rarr;
              </button>
            </div>

            {/* Decoded Payload Details */}
            <div className="space-y-2 pt-2 border-t border-[#e2e8f0]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#64748b] uppercase tracking-wider">
                  İmzalanan JSON Payload:
                </span>
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className="text-[#3b82f6] hover:text-[#2563eb] font-semibold"
                >
                  {copiedPayload ? 'JSON Kopyalandı' : 'JSON Kopyala'}
                </button>
              </div>
              <pre className="bg-[#0f172a] p-3 rounded-lg text-[11px] font-mono text-[#38bdf8] border border-slate-800 overflow-x-auto">
                {JSON.stringify(generatedResult.payload, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          /* Live Payload Blueprint Preview */
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <div className="flex items-center space-x-2 text-[#1e293b]">
                <Layers className="w-4 h-4 text-[#3b82f6]" />
                <h3 className="font-bold text-sm">Canlı JSON Payload Önizleme</h3>
              </div>
              <span className="text-[11px] text-[#64748b] font-mono">Canonical JSON</span>
            </div>

            <p className="text-xs text-[#64748b]">
              Formu doldurdukça üretilecek dijital imza payload'ı anlık olarak güncellenir:
            </p>

            <div className="bg-[#0f172a] p-4 rounded-lg border border-slate-800 text-[12px] font-mono text-slate-300 space-y-1">
              <span className="text-slate-500">&#123;</span>
              <div className="pl-4 space-y-0.5">
                <div>
                  <span className="text-[#38bdf8]">"license_id"</span>:{' '}
                  <span className="text-[#10b981]">"&lt;otomatik uuid-v4&gt;"</span>,
                </div>
                <div>
                  <span className="text-[#38bdf8]">"product_id"</span>:{' '}
                  <span className="text-[#fbbf24]">"{selectedProductId || 'urun-adi'}"</span>,
                </div>
                <div>
                  <span className="text-[#38bdf8]">"license_type"</span>:{' '}
                  <span className="text-[#fbbf24]">"{licenseType}"</span>,
                </div>
                <div>
                  <span className="text-[#38bdf8]">"customer"</span>:{' '}
                  <span className="text-[#fbbf24]">"{customer || 'Müşteri Adı'}"</span>,
                </div>
                <div>
                  <span className="text-[#38bdf8]">"issued_at"</span>:{' '}
                  <span className="text-[#93c5fd]">"{dates.issuedAt}"</span>,
                </div>
                <div>
                  <span className="text-[#38bdf8]">"expires_at"</span>:{' '}
                  <span className="text-[#93c5fd]">"{dates.expiresAt}"</span>,
                </div>
                <div>
                  <span className="text-[#38bdf8]">"machine_id"</span>:{' '}
                  {machineId ? (
                    <span className="text-[#fbbf24]">"{machineId}"</span>
                  ) : (
                    <span className="text-slate-500">null</span>
                  )}
                </div>
              </div>
              <span className="text-slate-500">&#125;</span>
            </div>

            <div className="p-3.5 bg-[#eff6ff] rounded-lg border border-[#bfdbfe] text-xs text-[#1e40af] flex items-start space-x-2">
              <Info className="w-4 h-4 text-[#3b82f6] flex-shrink-0 mt-0.5" />
              <span>
                Payload sunucunun RSA-2048 private key'i ile SHA256 algoritmasıyla imzalanır.
                Diğer projeleriniz sadece Public Key ile <strong>internetsiz</strong> doğrulama yapar.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
