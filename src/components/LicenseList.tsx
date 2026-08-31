import React, { useState } from 'react';
import {
  Search,
  Filter,
  Copy,
  Check,
  Download,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Cpu,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Pause,
  Play,
  Settings,
  History,
} from 'lucide-react';
import { Product, StoredLicense } from '../types';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';
import { ExtendLicenseModal } from './ExtendLicenseModal';
import { LicenseManageModal } from './LicenseManageModal';
import { LicenseHistoryModal } from './LicenseHistoryModal';

interface LicenseListProps {
  licenses: StoredLicense[];
  products: Product[];
  onRefresh: () => void;
  onNavigateToVerifier: (key: string) => void;
}

export const LicenseList: React.FC<LicenseListProps> = ({
  licenses,
  products,
  onRefresh,
  onNavigateToVerifier,
}) => {
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedUsage, setSelectedUsage] = useState('all');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [selectedLicenseForManage, setSelectedLicenseForManage] = useState<StoredLicense | null>(null);
  const [licenseToExtend, setLicenseToExtend] = useState<StoredLicense | null>(null);
  const [licenseForHistory, setLicenseForHistory] = useState<StoredLicense | null>(null);

  // Delete modal state
  const [licenseToDelete, setLicenseToDelete] = useState<StoredLicense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Status toggle (revoke / unrevoke or pause / unpause) modal state
  const [statusModalTarget, setStatusModalTarget] = useState<{
    license: StoredLicense;
    targetStatus: 'active' | 'revoked' | 'paused';
  } | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Status calculation helper
  const getLicenseStatus = (license: StoredLicense) => {
    if (license.status === 'revoked') {
      return {
        label: 'İptal Edildi (Revoked)',
        code: 'revoked',
        color: 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]',
      };
    }
    if (license.status === 'paused') {
      return {
        label: 'Donduruldu (Paused)',
        code: 'paused',
        color: 'bg-[#ffedd5] text-[#9a3412] border border-[#fed7aa]',
      };
    }
    const isExpired = new Date(license.expires_at).getTime() <= Date.now();
    if (isExpired) {
      return {
        label: 'Süresi Doldu',
        code: 'expired',
        color: 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]',
      };
    }
    return {
      label: 'Aktif',
      code: 'active',
      color: 'bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]',
    };
  };

  // Usage calculation helper (Kullanımda vs Kullanımda Değil)
  const getUsageStatus = (license: StoredLicense) => {
    if (license.is_used) {
      return {
        isUsed: true,
        label: 'Kullanımda',
        subLabel: license.usage_count && license.usage_count > 0 ? `${license.usage_count} kez giriş yapıldı` : 'Uygulama Giriş Yaptı',
        color: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        dotColor: 'bg-emerald-500 animate-pulse',
      };
    }
    return {
      isUsed: false,
      label: 'Kullanımda Değil',
      subLabel: 'Henüz Giriş Yapılmadı',
      color: 'bg-slate-100 text-slate-600 border border-slate-200',
      dotColor: 'bg-slate-400',
    };
  };

  // Quick toggle usage
  const handleQuickToggleUsage = async (e: React.MouseEvent, lic: StoredLicense) => {
    e.stopPropagation();
    try {
      const action = lic.is_used ? 'reset_usage' : 'mark_used';
      await api.toggleLicenseUsage(lic.license_id, action, { machine_id: lic.machine_id || 'DEMO-DEVICE-1' });
      showToast('success', action === 'mark_used' ? `"${lic.customer}" lisansı "Kullanımda" yapıldı.` : `"${lic.customer}" lisansı "Kullanımda Değil" yapıldı.`);
      onRefresh();
    } catch (err: any) {
      showToast('error', err?.message || 'İşlem başarısız');
    }
  };

  // Filter licenses
  const filteredLicenses = licenses.filter((lic) => {
    const statusObj = getLicenseStatus(lic);

    if (selectedProduct !== 'all' && lic.product_id !== selectedProduct) return false;
    if (selectedStatus !== 'all' && statusObj.code !== selectedStatus) return false;
    if (selectedType !== 'all' && lic.license_type !== selectedType) return false;
    if (selectedUsage !== 'all') {
      if (selectedUsage === 'used' && !lic.is_used) return false;
      if (selectedUsage === 'unused' && lic.is_used) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCustomer = lic.customer.toLowerCase().includes(q);
      const matchId = lic.license_id.toLowerCase().includes(q);
      const matchProduct = (lic.product_name || lic.product_id).toLowerCase().includes(q);
      const matchMachine = lic.machine_id ? lic.machine_id.toLowerCase().includes(q) : false;
      return matchCustomer || matchId || matchProduct || matchMachine;
    }

    return true;
  });

  // Copy Key
  const handleCopyKey = (e: React.MouseEvent, key: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Download Key
  const handleDownloadKey = (e: React.MouseEvent, lic: StoredLicense) => {
    e.stopPropagation();
    const blob = new Blob([lic.raw_key], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanCustomer = lic.customer.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `license_${lic.product_id}_${cleanCustomer}.lic`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete Action
  const handleOpenDeleteModal = (e: React.MouseEvent, lic: StoredLicense) => {
    e.stopPropagation();
    setDeleteError(null);
    setLicenseToDelete(lic);
  };

  const handleConfirmDelete = async () => {
    if (!licenseToDelete) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await api.deleteLicense(licenseToDelete.license_id);
      showToast(
        'success',
        `"${licenseToDelete.customer}" müşterisine ait lisans kaydı başarıyla silindi.`
      );
      setLicenseToDelete(null);
      onRefresh();
    } catch (err: any) {
      setDeleteError(err?.message || 'Lisans silinemedi');
    } finally {
      setIsDeleting(false);
    }
  };

  // Status Toggle Action
  const handleOpenStatusModal = (
    e: React.MouseEvent,
    lic: StoredLicense,
    targetStatus: 'active' | 'revoked' | 'paused'
  ) => {
    e.stopPropagation();
    setStatusError(null);
    setStatusModalTarget({ license: lic, targetStatus });
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusModalTarget) return;
    const { license, targetStatus } = statusModalTarget;
    try {
      setIsTogglingStatus(true);
      setStatusError(null);
      await api.updateLicenseStatus(license.license_id, targetStatus);

      let msg = `"${license.customer}" lisansı yeniden aktif edildi.`;
      if (targetStatus === 'revoked') {
        msg = `"${license.customer}" lisansı iptal edildi (Revoked).`;
      } else if (targetStatus === 'paused') {
        msg = `"${license.customer}" lisansı geçici olarak donduruldu (Paused).`;
      }

      showToast('success', msg);
      setStatusModalTarget(null);
      onRefresh();
    } catch (err: any) {
      setStatusError(err?.message || 'Lisans durumu güncellenemedi');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Export all as JSON
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(licenses, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `licenses_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#166534]'
              : 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b]'
          }`}
        >
          <div className="flex items-center space-x-2.5 text-xs font-semibold">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#166534]" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#991b1b]" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-500 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Filter Controls */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1e293b]">Lisans Veritabanı</h2>
            <p className="text-xs text-[#64748b]">
              Lisanslara tıklayarak süresini uzatın, dondurun (pause), iptal edin veya doğrulayın
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportJSON}
              disabled={licenses.length === 0}
              className="px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#1e293b] rounded-lg text-xs font-semibold border border-[#cbd5e1] flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>JSON Dışa Aktar</span>
            </button>
            <button
              onClick={onRefresh}
              className="p-2 bg-white hover:bg-[#f8fafc] text-[#64748b] hover:text-[#1e293b] rounded-lg border border-[#cbd5e1] transition cursor-pointer"
              title="Yenile"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94a3b8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Müşteri, ID veya HWID ara..."
              className="w-full bg-white border border-[#cbd5e1] rounded-lg pl-9 pr-3.5 py-2 text-xs text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] outline-none"
            />
          </div>

          {/* Product Filter */}
          <div>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
            >
              <option value="all">Tüm Ürünler ({products.length})</option>
              {products.map((p) => (
                <option key={p.id} value={p.productId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="active">Aktif Lisanslar</option>
              <option value="paused">Dondurulmuş (Paused)</option>
              <option value="revoked">İptal Edilenler (Revoked)</option>
              <option value="expired">Süresi Dolanlar</option>
            </select>
          </div>

          {/* License Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none"
            >
              <option value="all">Tüm Tipler</option>
              <option value="demo">Demo (10 Gün)</option>
              <option value="yearly">Yıllık (365 Gün)</option>
              <option value="custom">Özel Süreli</option>
            </select>
          </div>

          {/* Usage Status Filter (Kullanımda vs Kullanımda Değil) */}
          <div>
            <select
              value={selectedUsage}
              onChange={(e) => setSelectedUsage(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] focus:border-[#3b82f6] outline-none font-medium"
            >
              <option value="all">Tüm Kullanım Durumları</option>
              <option value="used">● Kullanımda (Giriş Yapıldı)</option>
              <option value="unused">○ Kullanımda Değil (Beklemede)</option>
            </select>
          </div>
        </div>
      </div>

      {/* License Records Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#e2e8f0] flex justify-between items-center bg-white">
          <div className="font-bold text-[#1e293b] text-sm sm:text-base">
            Lisans Kayıtları
            <span className="ml-2 text-xs font-normal text-[#64748b]">
              (Yönetmek veya süre uzatmak için satıra tıklayabilirsiniz)
            </span>
          </div>
          <div className="text-[#64748b] text-xs font-semibold">
            Toplam {filteredLicenses.length} lisans listelendi
          </div>
        </div>

        {filteredLicenses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#f8fafc] border border-[#e2e8f0] mx-auto flex items-center justify-center text-[#94a3b8]">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-[#1e293b] text-sm">Kayıt Bulunamadı</h3>
            <p className="text-xs text-[#64748b] max-w-sm mx-auto">
              {licenses.length === 0
                ? 'Henüz hiç lisans üretilmemiş. "Yeni Lisans Oluştur" bölümünden başlayabilirsiniz.'
                : 'Seçili filtrelere uygun lisans kaydı bulunamadı.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#e2e8f0] uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Müşteri</th>
                  <th className="py-3.5 px-4">Ürün ID</th>
                  <th className="py-3.5 px-4">Tür</th>
                  <th className="py-3.5 px-4">Bitiş Tarihi</th>
                  <th className="py-3.5 px-4">Makine Kilidi</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Kullanım Durumu</th>
                  <th className="py-3.5 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredLicenses.map((lic) => {
                  const status = getLicenseStatus(lic);
                  const usage = getUsageStatus(lic);

                  return (
                    <tr
                      key={lic.license_id}
                      onClick={() => setSelectedLicenseForManage(lic)}
                      className="hover:bg-[#f1f5f9]/70 transition group cursor-pointer"
                      title="Lisansı Yönet / Süre Uzat / Dondur"
                    >
                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#1e293b] text-sm group-hover:text-[#2563eb] transition-colors flex items-center space-x-1.5">
                          <span>{lic.customer}</span>
                          <Settings className="w-3 h-3 text-[#94a3b8] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[10px] font-mono text-[#94a3b8] mt-0.5">
                          ID: {lic.license_id.slice(0, 8)}...
                        </div>
                      </td>

                      {/* Product ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#3b82f6]">
                          {lic.product_name || lic.product_id}
                        </div>
                        <div className="text-[10px] font-mono text-[#64748b]">
                          {lic.product_id}
                        </div>
                      </td>

                      {/* License Type */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-[#475569]">
                          {lic.license_type === 'demo'
                            ? 'Demo (10 Gün)'
                            : lic.license_type === 'yearly'
                            ? 'Yıllık'
                            : 'Özel'}
                        </span>
                        {lic.notes && (
                          <div className="text-[10px] text-[#94a3b8] mt-0.5 truncate max-w-[130px]">
                            {lic.notes}
                          </div>
                        )}
                      </td>

                      {/* Expiration Dates */}
                      <td className="py-3.5 px-4 text-[#334155]">
                        <div className="font-semibold text-[#1e293b]">
                          {new Date(lic.expires_at).toLocaleDateString('tr-TR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-[#94a3b8] mt-0.5">
                          Başlangıç:{' '}
                          {new Date(lic.issued_at).toLocaleDateString('tr-TR', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Machine ID Lock */}
                      <td className="py-3.5 px-4">
                        {lic.machine_id ? (
                          <span
                            className="inline-flex items-center space-x-1 px-2 py-0.5 bg-[#f1f5f9] border border-[#cbd5e1] rounded text-[11px] font-mono text-[#1e293b]"
                            title={lic.machine_id}
                          >
                            <Cpu className="w-3 h-3 text-[#3b82f6]" />
                            <span>{lic.machine_id.slice(0, 10)}...</span>
                          </span>
                        ) : (
                          <span className="text-[#94a3b8] text-xs">Kilitsiz</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      {/* Usage Status Badge (Kullanımda vs Kullanımda Değil) */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit ${usage.color}`}
                            title={
                              lic.is_used
                                ? `Uygulama Girişi Yapıldı\nİlk Giriş: ${lic.first_used_at ? new Date(lic.first_used_at).toLocaleString('tr-TR') : 'Belirtilmedi'}\nSon Giriş: ${lic.last_used_at ? new Date(lic.last_used_at).toLocaleString('tr-TR') : 'Belirtilmedi'}\nToplam Oturum: ${lic.usage_count || 1} kez\nCihaz: ${lic.last_machine_id || lic.machine_id || 'Standart'}`
                                : 'Lisans oluşturuldu, ancak uygulama tarafından henüz giriş yapılmadı veya doğrulanmadı.'
                            }
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${usage.dotColor}`}></span>
                            <span>{usage.label}</span>
                          </span>
                          <span className="text-[10px] text-[#64748b] mt-0.5 ml-1">
                            {usage.subLabel}
                          </span>
                        </div>
                      </td>

                      {/* Actions Toolbar */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          {/* Quick Toggle Usage (Simulate Login / Reset) */}
                          <button
                            type="button"
                            onClick={(e) => handleQuickToggleUsage(e, lic)}
                            className={`p-1.5 rounded-lg transition cursor-pointer border ${
                              lic.is_used
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                : 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                            title={
                              lic.is_used
                                ? 'Kullanımı Sıfırla (Kullanımda Değil Durumuna Al)'
                                : 'Uygulama Girişini Simüle Et (Kullanımda Olarak İşaretle)'
                            }
                          >
                            <CheckCircle2 className={`w-4 h-4 ${lic.is_used ? 'text-emerald-600' : 'text-slate-400'}`} />
                          </button>

                          {/* Süre Uzat (Clock Button) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLicenseToExtend(lic);
                            }}
                            className="p-1.5 text-[#2563eb] hover:bg-[#eff6ff] rounded-lg transition cursor-pointer border border-transparent hover:border-[#bfdbfe]"
                            title="Lisans Süresini Uzat"
                          >
                            <Clock className="w-4 h-4" />
                          </button>

                          {/* Dondur / Çöz (Pause / Unpause Button) */}
                          {lic.status === 'paused' ? (
                            <button
                              onClick={(e) => handleOpenStatusModal(e, lic, 'active')}
                              className="p-1.5 text-[#16a34a] hover:bg-[#f0fdf4] rounded-lg transition cursor-pointer border border-transparent hover:border-[#bbf7d0]"
                              title="Dondurmayı Kaldır (Aktif Et)"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              disabled={lic.status === 'revoked'}
                              onClick={(e) => handleOpenStatusModal(e, lic, 'paused')}
                              className="p-1.5 text-[#ea580c] hover:bg-[#fff7ed] rounded-lg transition cursor-pointer border border-transparent hover:border-[#fed7aa] disabled:opacity-30"
                              title="Lisansı Dondur (Pause)"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}

                          {/* Copy Key */}
                          <button
                            onClick={(e) => handleCopyKey(e, lic.raw_key, lic.license_id)}
                            className="p-1.5 text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] rounded-lg transition cursor-pointer"
                            title="Lisans Anahtarını Kopyala"
                          >
                            {copiedId === lic.license_id ? (
                              <Check className="w-4 h-4 text-[#10b981]" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          {/* Download Key */}
                          <button
                            onClick={(e) => handleDownloadKey(e, lic)}
                            className="p-1.5 text-[#64748b] hover:text-[#3b82f6] hover:bg-[#f1f5f9] rounded-lg transition cursor-pointer"
                            title=".lic Dosyasını İndir"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* İşlem Geçmişi (Activity Log) Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLicenseForHistory(lic);
                            }}
                            className="p-1.5 text-[#64748b] hover:text-[#2563eb] hover:bg-[#eff6ff] rounded-lg transition cursor-pointer"
                            title="Lisans İşlem Geçmişini Görüntüle (Activity Log)"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Test in Verifier */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToVerifier(lic.raw_key);
                            }}
                            className="p-1.5 text-[#64748b] hover:text-[#10b981] hover:bg-[#f1f5f9] rounded-lg transition cursor-pointer"
                            title="Doğrulama Sandbox'ında Test Et"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>

                          {/* Revoke / Reactivate Status Modal */}
                          <button
                            onClick={(e) =>
                              handleOpenStatusModal(
                                e,
                                lic,
                                lic.status === 'revoked' ? 'active' : 'revoked'
                              )
                            }
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              lic.status === 'revoked'
                                ? 'text-[#64748b] hover:text-[#10b981] hover:bg-[#dcfce7]'
                                : 'text-[#64748b] hover:text-[#ef4444] hover:bg-[#fee2e2]'
                            }`}
                            title={
                              lic.status === 'revoked'
                                ? 'Lisansı Yeniden Aktif Et'
                                : 'Lisansı İptal Et (Revoke)'
                            }
                          >
                            {lic.status === 'revoked' ? (
                              <ShieldCheck className="w-4 h-4" />
                            ) : (
                              <ShieldAlert className="w-4 h-4" />
                            )}
                          </button>

                          {/* Delete Modal Trigger */}
                          <button
                            id={`btn-delete-license-${lic.license_id}`}
                            onClick={(e) => handleOpenDeleteModal(e, lic)}
                            className="p-1.5 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fee2e2] rounded-lg transition cursor-pointer"
                            title="Lisans Kaydını Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full License Management Modal (Opened by clicking row or customer) */}
      {selectedLicenseForManage && (
        <LicenseManageModal
          license={selectedLicenseForManage}
          isOpen={Boolean(selectedLicenseForManage)}
          onClose={() => setSelectedLicenseForManage(null)}
          onRefresh={onRefresh}
          onNavigateToVerifier={onNavigateToVerifier}
          onShowToast={showToast}
        />
      )}

      {/* Quick Extend Duration Modal */}
      {licenseToExtend && (
        <ExtendLicenseModal
          license={licenseToExtend}
          isOpen={Boolean(licenseToExtend)}
          onClose={() => setLicenseToExtend(null)}
          onSuccess={(_updated, msg) => {
            showToast('success', msg);
            onRefresh();
          }}
        />
      )}

      {/* Standalone License Activity Log Modal */}
      {licenseForHistory && (
        <LicenseHistoryModal
          license={licenseForHistory}
          isOpen={Boolean(licenseForHistory)}
          onClose={() => setLicenseForHistory(null)}
        />
      )}

      {/* Status Toggle (Pause / Unpause / Revoke / Reactivate) Confirmation Modal */}
      {statusModalTarget && (
        <ConfirmModal
          isOpen={Boolean(statusModalTarget)}
          onClose={() => {
            if (!isTogglingStatus) setStatusModalTarget(null);
          }}
          onConfirm={handleConfirmToggleStatus}
          title={
            statusModalTarget.targetStatus === 'paused'
              ? 'Lisansı Dondurmak İstiyor musunuz?'
              : statusModalTarget.targetStatus === 'revoked'
              ? 'Lisansı İptal Et (Revoke)'
              : statusModalTarget.license.status === 'paused'
              ? 'Lisans Dondurmasını Kaldır (Aktif Et)'
              : 'Lisansı Yeniden Aktif Et'
          }
          description={
            statusModalTarget.targetStatus === 'paused'
              ? `"${statusModalTarget.license.customer}" müşterisine ait lisansı geçici olarak dondurmak (pause) istediğinize emin misiniz?`
              : statusModalTarget.targetStatus === 'revoked'
              ? `"${statusModalTarget.license.customer}" müşterisine ait lisansı geçersiz kılmak istediğinize emin misiniz?`
              : `"${statusModalTarget.license.customer}" müşterisine ait lisansı yeniden geçerli ve aktif duruma getirmek istiyor musunuz?`
          }
          itemDetails={[
            { label: 'Müşteri', value: statusModalTarget.license.customer },
            { label: 'Ürün Kodu', value: statusModalTarget.license.product_id },
            { label: 'Mevcut Durum', value: statusModalTarget.license.status },
          ]}
          warningText={
            statusModalTarget.targetStatus === 'paused'
              ? 'Lisans dondurulduğunda, çevrimiçi kontrol yapan istemcilerde geçici olarak durdurulmuş (LICENSE_PAUSED) olarak görünecektir. Dilediğiniz zaman tek tıkla tekrar aktif edebilirsiniz.'
              : statusModalTarget.targetStatus === 'revoked'
              ? 'Çevrimiçi (API) sorgulama yapan tüm istemcilerde bu lisans anında GEÇERSİZ / İPTAL EDİLDİ olarak görünecektir.'
              : 'Lisans tekrar aktif hale getirilerek tüm kontrollerde geçerli sayılacaktır.'
          }
          confirmText={
            statusModalTarget.targetStatus === 'paused'
              ? 'Evet, Lisansı Dondur'
              : statusModalTarget.targetStatus === 'revoked'
              ? 'Evet, Lisansı İptal Et'
              : 'Evet, Aktif Et'
          }
          cancelText="Vazgeç"
          variant={
            statusModalTarget.targetStatus === 'revoked'
              ? 'danger'
              : statusModalTarget.targetStatus === 'paused'
              ? 'warning'
              : 'primary'
          }
          isLoading={isTogglingStatus}
          error={statusError}
        />
      )}

      {/* Delete Confirmation Modal */}
      {licenseToDelete && (
        <ConfirmModal
          isOpen={Boolean(licenseToDelete)}
          onClose={() => {
            if (!isDeleting) setLicenseToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Lisans Kaydını Sil"
          description="Bu lisans kaydını sistemden kalıcı olarak silmek üzeresiniz."
          itemDetails={[
            { label: 'Müşteri', value: licenseToDelete.customer },
            {
              label: 'Ürün',
              value: `${licenseToDelete.product_name || licenseToDelete.product_id} (${licenseToDelete.product_id})`,
            },
            {
              label: 'Lisans Türü',
              value:
                licenseToDelete.license_type === 'demo'
                  ? 'Demo (10 Gün)'
                  : licenseToDelete.license_type === 'yearly'
                  ? 'Yıllık'
                  : 'Özel Süreli',
            },
            { label: 'Lisans ID', value: licenseToDelete.license_id, isMono: true },
            {
              label: 'Son Kullanma Tarihi',
              value: new Date(licenseToDelete.expires_at).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
            },
            {
              label: 'Donanım Kilidi (HWID)',
              value: licenseToDelete.machine_id || 'Yok (Serbest)',
              isMono: Boolean(licenseToDelete.machine_id),
            },
          ]}
          warningText="Dikkat: Bu işlem veritabanından kaydı tamamen kaldırır. Eğer müşteri bu anahtarı kullanıyorsa ve yazılım sadece offline doğrulama yapıyorsa süre dolana kadar çalışabilir, ancak sunucudaki kayıt ve online takip sonlandırılacaktır."
          confirmText="Evet, Kalıcı Olarak Sil"
          cancelText="Vazgeç"
          variant="danger"
          isLoading={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
};
