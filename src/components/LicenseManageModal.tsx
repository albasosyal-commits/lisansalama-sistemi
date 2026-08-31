import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Copy,
  Check,
  Download,
  X,
  Cpu,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Info,
  History,
  PlusCircle,
  CheckCircle2,
} from 'lucide-react';
import { StoredLicense } from '../types';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';

interface LicenseManageModalProps {
  license: StoredLicense | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onNavigateToVerifier: (key: string) => void;
  onShowToast: (type: 'success' | 'error', message: string) => void;
}

export const LicenseManageModal: React.FC<LicenseManageModalProps> = ({
  license,
  isOpen,
  onClose,
  onRefresh,
  onNavigateToVerifier,
  onShowToast,
}) => {
  if (!isOpen || !license) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'extend' | 'key' | 'history'>('overview');

  // Extend duration state
  const [extendMode, setExtendMode] = useState<'preset' | 'custom'>('preset');
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [customDate, setCustomDate] = useState<string>(() => {
    const current = new Date(license.expires_at);
    const initial = new Date(current.getTime() + 30 * 24 * 60 * 60 * 1000);
    return initial.toISOString().split('T')[0];
  });
  const [isExtending, setIsExtending] = useState<boolean>(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  // Status toggle state
  const [statusConfirmAction, setStatusConfirmAction] = useState<
    'pause' | 'unpause' | 'revoke' | 'reactivate' | 'delete' | null
  >(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Usage toggle state
  const [usageLoading, setUsageLoading] = useState<boolean>(false);

  const [copied, setCopied] = useState<boolean>(false);

  const handleToggleUsage = async (action: 'mark_used' | 'reset_usage') => {
    try {
      setUsageLoading(true);
      await api.toggleLicenseUsage(license.license_id, action, {
        machine_id: license.machine_id || 'CLIENT-DEVICE-01',
        app_version: 'v1.0.0',
      });
      onShowToast(
        'success',
        action === 'mark_used'
          ? `"${license.customer}" lisansı "Kullanımda" (giriş yapıldı) olarak güncellendi.`
          : `"${license.customer}" lisansı "Kullanımda Değil" (sıfırlandı) durumuna alındı.`
      );
      onRefresh();
    } catch (err: any) {
      onShowToast('error', err?.message || 'Kullanım durumu güncellenemedi.');
    } finally {
      setUsageLoading(false);
    }
  };

  const presets = [
    { label: '+10 Gün (Demo)', days: 10 },
    { label: '+30 Gün (1 Ay)', days: 30 },
    { label: '+90 Gün (3 Ay)', days: 90 },
    { label: '+180 Gün (6 Ay)', days: 180 },
    { label: '+365 Gün (1 Yıl)', days: 365 },
  ];

  // Calculate new expiration date
  const calculateNewExpiration = (): Date => {
    if (extendMode === 'custom' && customDate) {
      return new Date(customDate + 'T23:59:59Z');
    }
    const currentExp = new Date(license.expires_at);
    const base = currentExp.getTime() > Date.now() ? currentExp : new Date();
    return new Date(base.getTime() + selectedDays * 24 * 60 * 60 * 1000);
  };

  const newExpDate = calculateNewExpiration();
  const currentExpDate = new Date(license.expires_at);
  const isExpired = currentExpDate.getTime() <= Date.now();

  const handleCopyKey = () => {
    navigator.clipboard.writeText(license.raw_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadKey = () => {
    const blob = new Blob([license.raw_key], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanCustomer = license.customer.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `license_${license.product_id}_${cleanCustomer}.lic`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Extend license handler
  const handleExtendDuration = async () => {
    try {
      setIsExtending(true);
      setExtendError(null);

      let payload: { extendDays?: number; customExpiresAt?: string } = {};

      if (extendMode === 'preset') {
        payload = { extendDays: selectedDays };
      } else {
        if (!customDate) {
          setExtendError('Lütfen geçerli bir tarih seçin.');
          setIsExtending(false);
          return;
        }
        payload = { customExpiresAt: new Date(customDate + 'T23:59:59Z').toISOString() };
      }

      const updated = await api.extendLicense(license.license_id, payload);
      onShowToast(
        'success',
        `"${license.customer}" lisans süresi ${new Date(updated.expires_at).toLocaleDateString(
          'tr-TR'
        )} tarihine kadar uzatıldı ve RSA anahtarı güncellendi.`
      );
      onRefresh();
      setActiveTab('overview');
    } catch (err: any) {
      setExtendError(err?.message || 'Lisans süresi uzatılamadı.');
    } finally {
      setIsExtending(false);
    }
  };

  // Handle status actions (pause, unpause, revoke, reactivate, delete)
  const handleConfirmStatusAction = async () => {
    if (!statusConfirmAction) return;

    try {
      setStatusLoading(true);
      setStatusError(null);

      if (statusConfirmAction === 'pause') {
        await api.updateLicenseStatus(license.license_id, 'paused');
        onShowToast('success', `"${license.customer}" lisansı donduruldu (paused).`);
      } else if (statusConfirmAction === 'unpause') {
        await api.updateLicenseStatus(license.license_id, 'active');
        onShowToast('success', `"${license.customer}" lisansı dondurma kaldırıldı, aktif edildi.`);
      } else if (statusConfirmAction === 'revoke') {
        await api.updateLicenseStatus(license.license_id, 'revoked');
        onShowToast('success', `"${license.customer}" lisansı iptal edildi (revoked).`);
      } else if (statusConfirmAction === 'reactivate') {
        await api.updateLicenseStatus(license.license_id, 'active');
        onShowToast('success', `"${license.customer}" lisansı yeniden aktif edildi.`);
      } else if (statusConfirmAction === 'delete') {
        await api.deleteLicense(license.license_id);
        onShowToast('success', `"${license.customer}" lisans kaydı kalıcı olarak silindi.`);
        setStatusConfirmAction(null);
        onRefresh();
        onClose();
        return;
      }

      setStatusConfirmAction(null);
      onRefresh();
    } catch (err: any) {
      setStatusError(err?.message || 'İşlem gerçekleştirilemedi.');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
      onClick={() => {
        if (!isExtending && !statusLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-[#e2e8f0] flex items-start justify-between bg-white">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <h2 className="text-base sm:text-lg font-bold text-[#1e293b]">{license.customer}</h2>
              {/* Status Badge */}
              {license.status === 'revoked' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]">
                  İptal Edildi (Revoked)
                </span>
              ) : license.status === 'paused' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ffedd5] text-[#9a3412] border border-[#fed7aa]">
                  Donduruldu (Paused)
                </span>
              ) : isExpired ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                  Süresi Doldu
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">
                  Aktif
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748b] font-mono">
              Ürün: <strong className="text-[#1e293b]">{license.product_name || license.product_id}</strong> ({license.product_id}) &bull; ID: {license.license_id}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#e2e8f0] bg-[#f8fafc] px-5 sm:px-6 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#3b82f6] text-[#1d4ed8] bg-white'
                : 'border-transparent text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Genel Bakış</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extend')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'extend'
                ? 'border-[#3b82f6] text-[#1d4ed8] bg-white'
                : 'border-transparent text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Süre Uzat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('key')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'key'
                ? 'border-[#3b82f6] text-[#1d4ed8] bg-white'
                : 'border-transparent text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Anahtar & İmza</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-[#3b82f6] text-[#1d4ed8] bg-white'
                : 'border-transparent text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>İşlem Geçmişi ({license.logs?.length || 1})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: OVERVIEW & QUICK ACTIONS */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Quick Actions Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Extend Duration Button */}
                <button
                  type="button"
                  onClick={() => setActiveTab('extend')}
                  className="p-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] flex flex-col items-center justify-center text-center transition cursor-pointer group shadow-2xs"
                >
                  <Clock className="w-5 h-5 mb-1.5 text-[#2563eb] group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs">Süre Uzat</span>
                  <span className="text-[10px] text-[#3b82f6] mt-0.5">Tarih ekle / yenile</span>
                </button>

                {/* Freeze / Unfreeze Button */}
                {license.status === 'paused' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusError(null);
                      setStatusConfirmAction('unpause');
                    }}
                    className="p-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#15803d] flex flex-col items-center justify-center text-center transition cursor-pointer group shadow-2xs"
                  >
                    <Play className="w-5 h-5 mb-1.5 text-[#16a34a] group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">Dondurmayı Kaldır</span>
                    <span className="text-[10px] text-[#16a34a] mt-0.5">Yeniden aktif et</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={license.status === 'revoked'}
                    onClick={() => {
                      setStatusError(null);
                      setStatusConfirmAction('pause');
                    }}
                    className="p-3 rounded-xl border border-[#fed7aa] bg-[#fff7ed] hover:bg-[#ffedd5] text-[#c2410c] flex flex-col items-center justify-center text-center transition cursor-pointer group shadow-2xs disabled:opacity-40"
                  >
                    <Pause className="w-5 h-5 mb-1.5 text-[#ea580c] group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">Lisansı Dondur</span>
                    <span className="text-[10px] text-[#ea580c] mt-0.5">Geçici durdur</span>
                  </button>
                )}

                {/* Revoke / Reactivate Button */}
                {license.status === 'revoked' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusError(null);
                      setStatusConfirmAction('reactivate');
                    }}
                    className="p-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#15803d] flex flex-col items-center justify-center text-center transition cursor-pointer group shadow-2xs"
                  >
                    <ShieldCheck className="w-5 h-5 mb-1.5 text-[#16a34a] group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">Yeniden Aktif Et</span>
                    <span className="text-[10px] text-[#16a34a] mt-0.5">İptali kaldır</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusError(null);
                      setStatusConfirmAction('revoke');
                    }}
                    className="p-3 rounded-xl border border-[#fecaca] bg-[#fff1f2] hover:bg-[#ffe4e6] text-[#be123c] flex flex-col items-center justify-center text-center transition cursor-pointer group shadow-2xs"
                  >
                    <ShieldAlert className="w-5 h-5 mb-1.5 text-[#e11d48] group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">İptal Et (Revoke)</span>
                    <span className="text-[10px] text-[#e11d48] mt-0.5">Kalıcı geçersiz kıl</span>
                  </button>
                )}

                {/* Test in Sandbox Button */}
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToVerifier(license.raw_key);
                    onClose();
                  }}
                  className="p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#334155] flex flex-col items-center justify-center text-center transition cursor-pointer group shadow-2xs"
                >
                  <ShieldCheck className="w-5 h-5 mb-1.5 text-[#3b82f6] group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs">Doğrula</span>
                  <span className="text-[10px] text-[#64748b] mt-0.5">Sandbox test</span>
                </button>
              </div>

              {/* License Details Grid */}
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-[#1e293b] uppercase tracking-wider">
                  Lisans Parametreleri
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#64748b] block">Müşteri:</span>
                    <span className="font-bold text-[#1e293b]">{license.customer}</span>
                  </div>
                  <div>
                    <span className="text-[#64748b] block">Ürün / Modül:</span>
                    <span className="font-bold text-[#1e293b]">
                      {license.product_name || license.product_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748b] block">Lisans Türü:</span>
                    <span className="font-semibold text-[#1e293b] capitalize">
                      {license.license_type === 'demo'
                        ? 'Demo (10 Gün)'
                        : license.license_type === 'yearly'
                        ? 'Yıllık (365 Gün)'
                        : 'Özel Süreli'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748b] block">Donanım Kilidi (HWID):</span>
                    {license.machine_id ? (
                      <span className="inline-flex items-center space-x-1 font-mono text-[11px] text-[#1e293b] bg-white px-2 py-0.5 rounded border border-[#cbd5e1]">
                        <Cpu className="w-3 h-3 text-[#3b82f6]" />
                        <span>{license.machine_id}</span>
                      </span>
                    ) : (
                      <span className="text-[#64748b]">Tüm Cihazlara Açık</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[#64748b] block">Başlangıç Tarihi:</span>
                    <span className="font-mono text-[#334155]">
                      {new Date(license.issued_at).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748b] block">Son Kullanma Tarihi:</span>
                    <span
                      className={`font-mono font-bold ${
                        isExpired ? 'text-[#991b1b]' : 'text-[#166534]'
                      }`}
                    >
                      {currentExpDate.toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {license.paused_at && (
                    <div className="col-span-2 bg-[#fff7ed] p-2.5 rounded-lg border border-[#fed7aa] text-[11px] text-[#9a3412]">
                      <strong>Dondurulma Zamanı:</strong>{' '}
                      {new Date(license.paused_at).toLocaleString('tr-TR')}
                      <p className="mt-0.5 text-[10px]">
                        Bu lisans çevrimiçi doğrulama isteklerinde geçici olarak askıya alınmış kabul edilir.
                      </p>
                    </div>
                  )}
                  {license.revoked_at && (
                    <div className="col-span-2 bg-[#fff1f2] p-2.5 rounded-lg border border-[#fecaca] text-[11px] text-[#991b1b]">
                      <strong>İptal Edilme Zamanı:</strong>{' '}
                      {new Date(license.revoked_at).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>
              </div>

              {/* Application Usage & Login Information Card */}
              <div
                className={`border rounded-xl p-4 space-y-3 transition-colors ${
                  license.is_used
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        license.is_used ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <h4 className="text-xs font-bold text-[#1e293b] uppercase tracking-wider">
                      Uygulama Giriş & Kullanım Durumu
                    </h4>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      license.is_used
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {license.is_used ? '● Kullanımda (Giriş Yapıldı)' : '○ Kullanımda Değil (Beklemede)'}
                  </span>
                </div>

                {license.is_used ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                        <span className="text-[#64748b] block text-[11px]">İlk Giriş / Aktivasyon:</span>
                        <span className="font-semibold text-[#1e293b] font-mono text-[11px]">
                          {license.first_used_at
                            ? new Date(license.first_used_at).toLocaleString('tr-TR')
                            : 'Kayıtlı'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                        <span className="text-[#64748b] block text-[11px]">Son Giriş / Doğrulama:</span>
                        <span className="font-semibold text-[#1e293b] font-mono text-[11px]">
                          {license.last_used_at
                            ? new Date(license.last_used_at).toLocaleString('tr-TR')
                            : 'Kayıtlı'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                        <span className="text-[#64748b] block text-[11px]">Toplam Oturum Sayısı:</span>
                        <span className="font-bold text-emerald-700 text-sm">
                          {license.usage_count || 1} kez
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100 sm:col-span-2">
                        <span className="text-[#64748b] block text-[11px]">Giriş Yapan Cihaz (HWID):</span>
                        <span className="font-mono text-[#1e293b] text-[11px] truncate block">
                          {license.last_machine_id || license.machine_id || 'Otomatik Tanımlandı'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                        <span className="text-[#64748b] block text-[11px]">Uygulama Sürümü:</span>
                        <span className="font-medium text-[#1e293b] text-[11px]">
                          {license.app_version || 'v1.0.0'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={usageLoading}
                        onClick={() => handleToggleUsage('reset_usage')}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${usageLoading ? 'animate-spin' : ''}`} />
                        <span>Kullanımı Sıfırla (Kullanımda Değil Yap)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                      Bu lisans başarıyla oluşturuldu ve hazır durumda, ancak <strong>henüz hiçbir istemci uygulama</strong> tarafından <code className="text-blue-600 font-mono bg-blue-50 px-1 py-0.5 rounded text-[11px]">/api/v1/verify</code> üzerinden oturum açılmadı veya doğrulanmadı. İstemci uygulama lisans ile ilk doğrulamasını gerçekleştirdiğinde durumu otomatik olarak <strong>Kullanımda</strong> olarak güncellenecektir.
                    </p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={usageLoading}
                        onClick={() => handleToggleUsage('mark_used')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${usageLoading ? 'animate-spin' : ''}`} />
                        <span>Giriş Simülasyonu Yap (Kullanımda Olarak İşaretle)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Key Quick Copy Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                    Lisans Anahtarı (.lic)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="px-2.5 py-1 bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1] rounded text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-[#16a34a]" />
                      ) : (
                        <Copy className="w-3 h-3 text-[#3b82f6]" />
                      )}
                      <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadKey}
                      className="px-2.5 py-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>.lic İndir</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={license.raw_key}
                  className="w-full bg-[#0f172a] text-[#10b981] font-mono text-[11px] p-3 rounded-lg border border-slate-800 focus:outline-none select-all"
                />
              </div>
            </div>
          )}

          {/* TAB 2: EXTEND DURATION (SÜRE UZAT) */}
          {activeTab === 'extend' && (
            <div className="space-y-4">
              {extendError && (
                <div className="p-3 bg-[#fee2e2] border border-[#fecaca] rounded-lg text-xs text-[#991b1b] flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{extendError}</span>
                </div>
              )}

              {/* Expiration Comparison Box */}
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748b] font-medium">Mevcut Bitiş Tarihi:</span>
                  <span className="font-semibold text-[#334155] font-mono">
                    {currentExpDate.toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#bfdbfe]">
                  <span className="text-[#1d4ed8] font-bold flex items-center space-x-1.5 text-xs">
                    <Sparkles className="w-4 h-4 text-[#3b82f6]" />
                    <span>Yeni Bitiş Tarihi:</span>
                  </span>
                  <span className="font-bold text-[#166534] font-mono text-sm">
                    {newExpDate.toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex space-x-2 border-b border-[#f1f5f9] pb-3">
                <button
                  type="button"
                  onClick={() => setExtendMode('preset')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    extendMode === 'preset'
                      ? 'bg-[#3b82f6] text-white shadow-2xs'
                      : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
                  }`}
                >
                  Hazır Paketler
                </button>
                <button
                  type="button"
                  onClick={() => setExtendMode('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    extendMode === 'custom'
                      ? 'bg-[#3b82f6] text-white shadow-2xs'
                      : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
                  }`}
                >
                  Özel Bitiş Tarihi Seç
                </button>
              </div>

              {/* Preset buttons */}
              {extendMode === 'preset' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {presets.map((p) => {
                    const isSelected = selectedDays === p.days;
                    return (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => setSelectedDays(p.days)}
                        className={`p-3 rounded-lg text-xs font-bold border text-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#eff6ff] border-[#3b82f6] text-[#1d4ed8] shadow-2xs'
                            : 'bg-white border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#3b82f6]" />
                    <span>Yeni Bitiş Tarihini Belirleyin:</span>
                  </label>
                  <input
                    type="date"
                    value={customDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
                  />
                </div>
              )}

              <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg text-xs text-[#166534] leading-relaxed">
                <strong>Otomatik RSA İmzalama:</strong> Süre uzatıldığında yeni bitiş tarihi lisans payload'ına işlenir ve sistemdeki RSA Private Key ile anında imzalanır. Yeni .lic dosyasını müşterinize iletebilirsiniz.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleExtendDuration}
                  disabled={isExtending}
                  className="px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {isExtending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uzatılıyor & İmzalanıyor...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Süreyi Uzat & Yeni Anahtarı Kaydet</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CRYPTOGRAPHIC PAYLOAD & SIGNATURE */}
          {activeTab === 'key' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Ham Lisans Anahtarı (Base64 Payload + RSA Signature):
                </label>
                <textarea
                  readOnly
                  rows={4}
                  value={license.raw_key}
                  className="w-full bg-[#0f172a] p-3 rounded-lg font-mono text-[11px] text-[#10b981] border border-slate-800 select-all focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-[#f8fafc] p-3.5 rounded-lg border border-[#e2e8f0]">
                <div>
                  <span className="text-[#64748b]">Ürün Kodu:</span>
                  <p className="font-bold text-[#1e293b]">{license.product_id}</p>
                </div>
                <div>
                  <span className="text-[#64748b]">Lisans Tipi:</span>
                  <p className="font-bold text-[#1e293b] capitalize">{license.license_type}</p>
                </div>
                <div>
                  <span className="text-[#64748b]">Oluşturulma (UTC):</span>
                  <p className="font-mono text-[#334155]">{license.issued_at}</p>
                </div>
                <div>
                  <span className="text-[#64748b]">Bitiş Tarihi (UTC):</span>
                  <p className="font-mono text-[#334155]">{license.expires_at}</p>
                </div>
                <div>
                  <span className="text-[#64748b]">Makine ID Kilidi:</span>
                  <p className="font-mono text-[#334155]">
                    {license.machine_id || 'Yok (Tüm Cihazlar)'}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748b]">Durum:</span>
                  <p className="font-bold text-[#1e293b] capitalize">{license.status}</p>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="px-3.5 py-2 bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#16a34a]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadKey}
                  className="px-3.5 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.lic İndir</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY LOG / HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-[#f8fafc] p-3.5 rounded-xl border border-[#e2e8f0] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#1e293b] flex items-center space-x-1.5">
                    <History className="w-4 h-4 text-[#3b82f6]" />
                    <span>Lisans Hareket Kayıtları (Activity Log)</span>
                  </h4>
                  <p className="text-[11px] text-[#64748b] mt-0.5">
                    Süre uzatma, dondurma, iptal ve aktivasyon tarihleri kronolojik sırada listelenmiştir.
                  </p>
                </div>
              </div>

              {(!license.logs || license.logs.length === 0) ? (
                <div className="text-center py-6 text-xs text-[#64748b]">
                  Henüz bir işlem kaydı bulunmamaktadır.
                </div>
              ) : (
                <div className="relative border-l-2 border-[#e2e8f0] ml-3.5 space-y-4 my-2">
                  {license.logs.map((log) => {
                    let badge = {
                      icon: <History className="w-3.5 h-3.5 text-[#475569]" />,
                      bg: 'bg-[#f8fafc] text-[#334155] border-[#e2e8f0]',
                      label: log.action,
                    };

                    if (log.action === 'created') {
                      badge = {
                        icon: <PlusCircle className="w-3.5 h-3.5 text-[#2563eb]" />,
                        bg: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
                        label: 'Oluşturuldu',
                      };
                    } else if (log.action === 'extended') {
                      badge = {
                        icon: <Clock className="w-3.5 h-3.5 text-[#16a34a]" />,
                        bg: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]',
                        label: 'Süre Uzatıldı',
                      };
                    } else if (log.action === 'paused') {
                      badge = {
                        icon: <Pause className="w-3.5 h-3.5 text-[#ea580c]" />,
                        bg: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
                        label: 'Donduruldu',
                      };
                    } else if (log.action === 'unpaused') {
                      badge = {
                        icon: <Play className="w-3.5 h-3.5 text-[#16a34a]" />,
                        bg: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]',
                        label: 'Dondurma Kaldırıldı',
                      };
                    } else if (log.action === 'revoked') {
                      badge = {
                        icon: <ShieldAlert className="w-3.5 h-3.5 text-[#e11d48]" />,
                        bg: 'bg-[#fff1f2] text-[#be123c] border-[#fecaca]',
                        label: 'İptal Edildi',
                      };
                    } else if (log.action === 'reactivated') {
                      badge = {
                        icon: <ShieldCheck className="w-3.5 h-3.5 text-[#16a34a]" />,
                        bg: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]',
                        label: 'Yeniden Aktif',
                      };
                    }

                    const dateObj = new Date(log.timestamp);

                    return (
                      <div key={log.id} className="relative pl-6">
                        <div className="absolute -left-[15px] top-1 p-0.5 bg-white rounded-full border border-[#cbd5e1]">
                          {badge.icon}
                        </div>
                        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3 space-y-1.5 hover:border-[#bfdbfe] transition">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                              {badge.label}
                            </span>
                            <span className="text-[11px] text-[#64748b] font-mono">
                              {dateObj.toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              - {dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-[#1e293b] font-medium leading-relaxed">
                            {log.description}
                          </p>
                          {log.details && (
                            <div className="bg-white p-2 rounded border border-[#e2e8f0] text-[11px] font-mono text-[#475569] space-y-0.5 mt-1">
                              {log.details.previous_expires_at && (
                                <div>
                                  <span className="text-[#64748b]">Önceki Bitiş Tarihi: </span>
                                  <span>{new Date(log.details.previous_expires_at).toLocaleDateString('tr-TR')}</span>
                                </div>
                              )}
                              {log.details.new_expires_at && (
                                <div>
                                  <span className="text-[#166534] font-bold">Yeni Bitiş Tarihi: </span>
                                  <span className="font-bold text-[#166534]">
                                    {new Date(log.details.new_expires_at).toLocaleDateString('tr-TR')}
                                  </span>
                                </div>
                              )}
                              {log.details.machine_id && (
                                <div>
                                  <span className="text-[#64748b]">Donanım Kilidi (HWID): </span>
                                  <span>{log.details.machine_id}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Delete Trigger */}
        <div className="p-4 sm:p-5 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setStatusError(null);
              setStatusConfirmAction('delete');
            }}
            className="text-[#ef4444] hover:text-[#dc2626] text-xs font-semibold flex items-center space-x-1 p-1 hover:underline cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Lisansı Kalıcı Olarak Sil</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-[#334155] border border-[#cbd5e1] rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>

      {/* Dynamic Confirmation Modals for Actions */}
      {statusConfirmAction && (
        <ConfirmModal
          isOpen={Boolean(statusConfirmAction)}
          onClose={() => {
            if (!statusLoading) setStatusConfirmAction(null);
          }}
          onConfirm={handleConfirmStatusAction}
          title={
            statusConfirmAction === 'pause'
              ? 'Lisansı Dondurmak İstiyor musunuz?'
              : statusConfirmAction === 'unpause'
              ? 'Dondurmayı Kaldırıp Aktif Et'
              : statusConfirmAction === 'revoke'
              ? 'Lisansı İptal Et (Revoke)'
              : statusConfirmAction === 'reactivate'
              ? 'Lisansı Yeniden Aktif Et'
              : 'Lisans Kaydını Sil'
          }
          description={
            statusConfirmAction === 'pause'
              ? `"${license.customer}" müşterisine ait lisansı geçici olarak dondurmak istediğinize emin misiniz?`
              : statusConfirmAction === 'unpause'
              ? `"${license.customer}" lisansının dondurulma durumunu kaldırıp tekrar aktif hale getirmek istiyor musunuz?`
              : statusConfirmAction === 'revoke'
              ? `"${license.customer}" lisansını iptal etmek istediğinize emin misiniz?`
              : statusConfirmAction === 'reactivate'
              ? `"${license.customer}" lisansını yeniden aktif etmek istiyor musunuz?`
              : `"${license.customer}" lisans kaydını sistemden kalıcı olarak silmek üzeresiniz.`
          }
          itemDetails={[
            { label: 'Müşteri', value: license.customer },
            { label: 'Ürün Kodu', value: license.product_id },
            { label: 'Mevcut Durum', value: license.status },
            {
              label: 'Bitiş Tarihi',
              value: currentExpDate.toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
            },
          ]}
          warningText={
            statusConfirmAction === 'pause'
              ? 'Dondurulduğunda, online doğrulama yapan istemcilerde lisans geçici olarak durdurulmuş görünecektir. Dilediğiniz zaman tek tıkla dondurmayı kaldırabilirsiniz.'
              : statusConfirmAction === 'revoke'
              ? 'İptal edildiğinde (Revoked), çevrimiçi doğrulama yapan istemciler anında lisansı geçersiz sayacaktır.'
              : statusConfirmAction === 'delete'
              ? 'Bu işlem geri alınamaz ve veritabanı kaydını kalıcı olarak siler.'
              : undefined
          }
          confirmText={
            statusConfirmAction === 'pause'
              ? 'Evet, Dondur'
              : statusConfirmAction === 'unpause'
              ? 'Evet, Aktif Et'
              : statusConfirmAction === 'revoke'
              ? 'Evet, İptal Et'
              : statusConfirmAction === 'reactivate'
              ? 'Evet, Aktif Et'
              : 'Evet, Kalıcı Olarak Sil'
          }
          cancelText="Vazgeç"
          variant={
            statusConfirmAction === 'delete'
              ? 'danger'
              : statusConfirmAction === 'pause' || statusConfirmAction === 'revoke'
              ? 'warning'
              : 'primary'
          }
          isLoading={statusLoading}
          error={statusError}
        />
      )}
    </div>
  );
};
