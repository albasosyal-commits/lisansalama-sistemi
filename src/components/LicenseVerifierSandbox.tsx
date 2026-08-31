import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Cpu,
  Globe,
  Sparkles,
  Layers,
} from 'lucide-react';
import { KeyMetadata, VerificationResult } from '../types';
import { api } from '../services/api';

interface LicenseVerifierSandboxProps {
  initialLicenseKey?: string;
  keyInfo: KeyMetadata | null;
}

export const LicenseVerifierSandbox: React.FC<LicenseVerifierSandboxProps> = ({
  initialLicenseKey = '',
  keyInfo,
}) => {
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>(initialLicenseKey);
  const [machineIdInput, setMachineIdInput] = useState<string>('');
  const [useCustomPublicKey, setUseCustomPublicKey] = useState<boolean>(false);
  const [customPublicKey, setCustomPublicKey] = useState<string>('');

  const [loadingOffline, setLoadingOffline] = useState<boolean>(false);
  const [loadingOnline, setLoadingOnline] = useState<boolean>(false);

  const [offlineResult, setOfflineResult] = useState<VerificationResult | null>(null);
  const [onlineResult, setOnlineResult] = useState<{
    valid: boolean;
    error?: string;
    message: string;
    status?: string;
    payload?: any;
  } | null>(null);

  useEffect(() => {
    if (initialLicenseKey) {
      setLicenseKeyInput(initialLicenseKey);
    }
  }, [initialLicenseKey]);

  // Offline Verification (Pure RSA-SHA256 crypto + local clock check)
  const handleVerifyOffline = async () => {
    if (!licenseKeyInput.trim()) {
      alert('Lütfen doğrulanacak bir lisans anahtarı girin.');
      return;
    }

    try {
      setLoadingOffline(true);
      setOfflineResult(null);
      const res = await api.verifyOffline(
        licenseKeyInput.trim(),
        useCustomPublicKey ? customPublicKey.trim() : undefined,
        machineIdInput.trim() || undefined
      );
      setOfflineResult(res);
    } catch (err: any) {
      alert(err?.message || 'Doğrulama başarısız.');
    } finally {
      setLoadingOffline(false);
    }
  };

  // Online Verification (Crypto + Real-time Revocation Database check)
  const handleVerifyOnline = async () => {
    if (!licenseKeyInput.trim()) {
      alert('Lütfen doğrulanacak bir lisans anahtarı girin.');
      return;
    }

    try {
      setLoadingOnline(true);
      setOnlineResult(null);
      const res = await api.verifyOnline(
        licenseKeyInput.trim(),
        undefined,
        machineIdInput.trim() || undefined
      );
      setOnlineResult(res);
    } catch (err: any) {
      alert(err?.message || 'Çevrimiçi doğrulama başarısız.');
    } finally {
      setLoadingOnline(false);
    }
  };

  // Tamper Demo Helper
  const handleSimulateTamper = () => {
    if (!licenseKeyInput || !licenseKeyInput.includes('.')) return;
    const [payloadB64, sigB64] = licenseKeyInput.split('.');
    try {
      const decoded = JSON.parse(atob(payloadB64));
      decoded.expires_at = '2099-12-31T23:59:59.000Z';
      decoded.customer = (decoded.customer || 'User') + ' (TAMPERED)';
      const tamperedB64 = btoa(JSON.stringify(decoded));
      setLicenseKeyInput(`${tamperedB64}.${sigB64}`);
      setOfflineResult(null);
      setOnlineResult(null);
    } catch (e) {
      alert('Lisans formatı ayrıştırılamadı');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm">
        <h2 className="text-base sm:text-lg font-bold text-[#1e293b]">
          Lisans Doğrulama Sandbox'ı
        </h2>
        <p className="text-xs text-[#64748b] mt-0.5">
          Hem çevrimdışı (RSA imza & süre) hem de çevrimiçi (iptal/revocation) doğrulamayı test edin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input parameters */}
        <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
            <h3 className="font-bold text-[#1e293b] text-sm">Test Girdileri</h3>
            <button
              type="button"
              onClick={handleSimulateTamper}
              className="text-xs px-2.5 py-1 bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] border border-[#fde68a] rounded-lg transition font-semibold flex items-center space-x-1 cursor-pointer"
              title="Payload'u tahrif ederek imza hatası oluştuğunu test edin"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tahrifatı Simüle Et (Tamper)</span>
            </button>
          </div>

          {/* License Key Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1.5">
              Lisans Anahtarı (base64.payload + signature) *
            </label>
            <textarea
              rows={4}
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              placeholder="base64(payload).base64(signature) formatında lisans anahtarını yapıştırın..."
              className="w-full bg-[#0f172a] font-mono text-xs leading-relaxed text-[#10b981] p-3 rounded-lg border border-slate-800 focus:outline-none"
            />
          </div>

          {/* Target Machine ID (Optional) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1.5 flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>Hedef Cihaz Donanım Kodu (Makine ID) (Opsiyonel)</span>
            </label>
            <input
              type="text"
              value={machineIdInput}
              onChange={(e) => setMachineIdInput(e.target.value)}
              placeholder="Örn: HWID-9F8A-33C1 (Donanım kilidi test etmek için)"
              className="w-full bg-white font-mono border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] outline-none"
            />
          </div>

          {/* Custom Public Key Toggle */}
          <div className="pt-2">
            <label className="flex items-center space-x-2 text-xs text-[#475569] cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomPublicKey}
                onChange={(e) => setUseCustomPublicKey(e.target.checked)}
                className="rounded text-[#3b82f6] focus:ring-0"
              />
              <span>Farklı / Özel bir Public Key ile doğrula (Anahtar uyuşmazlığı testi)</span>
            </label>

            {useCustomPublicKey && (
              <div className="mt-2 animate-in fade-in">
                <textarea
                  rows={4}
                  value={customPublicKey}
                  onChange={(e) => setCustomPublicKey(e.target.value)}
                  placeholder="-----BEGIN PUBLIC KEY----- ..."
                  className="w-full bg-[#0f172a] font-mono text-[11px] text-slate-300 p-2.5 rounded-lg border border-slate-800 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#e2e8f0]">
            {/* Offline Verify */}
            <button
              id="btn-verify-offline"
              onClick={handleVerifyOffline}
              disabled={loadingOffline}
              className="py-2.5 px-3.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loadingOffline ? 'Doğrulanıyor...' : '1. Çevrimdışı Doğrula (RSA)'}</span>
            </button>

            {/* Online Verify */}
            <button
              id="btn-verify-online"
              onClick={handleVerifyOnline}
              disabled={loadingOnline}
              className="py-2.5 px-3.5 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer shadow-sm"
            >
              <Globe className="w-4 h-4 text-[#38bdf8]" />
              <span>{loadingOnline ? 'Sorgulanıyor...' : '2. Çevrimiçi Doğrula (API)'}</span>
            </button>
          </div>
        </div>

        {/* Right: Detailed Step-by-step Verdict & Inspection */}
        <div className="lg:col-span-6 space-y-4">
          {/* Offline Verification Result */}
          {offlineResult && (
            <div
              className={`p-5 rounded-xl border ${
                offlineResult.valid
                  ? 'bg-white border-[#bbf7d0]'
                  : 'bg-white border-[#fecaca]'
              } shadow-sm space-y-4 animate-in zoom-in-95`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
                <div className="flex items-center space-x-2">
                  {offlineResult.valid ? (
                    <CheckCircle2 className="w-5 h-5 text-[#166534]" />
                  ) : (
                    <XCircle className="w-5 h-5 text-[#991b1b]" />
                  )}
                  <h3 className="font-bold text-sm text-[#1e293b]">
                    Çevrimdışı (Offline) Doğrulama Sonucu
                  </h3>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    offlineResult.valid
                      ? 'bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]'
                      : 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]'
                  }`}
                >
                  {offlineResult.valid ? 'GEÇERLİ (VALID)' : 'GEÇERSİZ (INVALID)'}
                </span>
              </div>

              <p className="text-xs text-[#334155] font-medium leading-relaxed">
                {offlineResult.message}
              </p>

              {/* Step by step checklist */}
              <div className="space-y-2 text-xs bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0]">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748b]">1. RSA-SHA256 Dijital İmza:</span>
                  <span
                    className={`font-semibold ${
                      !offlineResult.tampered ? 'text-[#166534]' : 'text-[#991b1b]'
                    }`}
                  >
                    {!offlineResult.tampered ? '✓ Doğrulandı (Orijinal)' : '✗ İmza Uyuşmuyor (Tahrif Edilmiş)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748b]">2. Son Kullanma Süresi (UTC):</span>
                  <span
                    className={`font-semibold ${
                      !offlineResult.expired ? 'text-[#166534]' : 'text-[#92400e]'
                    }`}
                  >
                    {!offlineResult.expired ? '✓ Süresi Geçerli' : '✗ Süresi Dolmuş'}
                  </span>
                </div>
                {offlineResult.payload?.machine_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748b]">3. Makine ID Kilidi:</span>
                    <span
                      className={`font-semibold ${
                        offlineResult.machineMatched === true
                          ? 'text-[#166534]'
                          : offlineResult.machineMatched === false
                          ? 'text-[#991b1b]'
                          : 'text-[#92400e]'
                      }`}
                    >
                      {offlineResult.machineMatched === true
                        ? '✓ Eşleşti'
                        : offlineResult.machineMatched === false
                        ? '✗ Eşleşmedi'
                        : 'Belirtilmedi'}
                    </span>
                  </div>
                )}
              </div>

              {/* Decoded Payload */}
              {offlineResult.payload && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                    Çözümlenen Lisans Bilgileri:
                  </span>
                  <pre className="bg-[#0f172a] p-3 rounded-lg text-[11px] font-mono text-[#38bdf8] border border-slate-800 overflow-x-auto">
                    {JSON.stringify(offlineResult.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Online Verification Result */}
          {onlineResult && (
            <div
              className={`p-5 rounded-xl border ${
                onlineResult.valid
                  ? 'bg-white border-[#bfdbfe]'
                  : 'bg-white border-[#fecaca]'
              } shadow-sm space-y-3 animate-in zoom-in-95`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
                <div className="flex items-center space-x-2">
                  <Globe className="w-5 h-5 text-[#3b82f6]" />
                  <h3 className="font-bold text-sm text-[#1e293b]">Çevrimiçi (API) Doğrulama & İptal Durumu</h3>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    onlineResult.valid
                      ? 'bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]'
                      : 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]'
                  }`}
                >
                  {onlineResult.valid ? 'ONAYLANDI (ACTIVE)' : 'REDDEDİLDİ'}
                </span>
              </div>

              <p className="text-xs text-[#334155]">{onlineResult.message}</p>

              {onlineResult.error && (
                <div className="p-2.5 bg-[#fee2e2] border border-[#fecaca] rounded-lg text-xs font-mono text-[#991b1b]">
                  Hata Kodu: {onlineResult.error}
                </div>
              )}
            </div>
          )}

          {!offlineResult && !onlineResult && (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#f8fafc] border border-[#e2e8f0] mx-auto flex items-center justify-center text-[#94a3b8]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-[#1e293b] text-sm">Doğrulama Bekleniyor</h4>
              <p className="text-xs text-[#64748b] max-w-sm mx-auto">
                Sol tarafa bir lisans anahtarı yapıştırıp <strong>Çevrimdışı</strong> veya{' '}
                <strong>Çevrimiçi</strong> doğrulama butonlarına basarak kriptografik doğruluğu ve
                iptal durumunu test edin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
