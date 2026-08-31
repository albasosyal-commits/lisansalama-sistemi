import React, { useState } from 'react';
import { Calendar, Clock, Sparkles, X, Check, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { StoredLicense } from '../types';
import { api } from '../services/api';

interface ExtendLicenseModalProps {
  license: StoredLicense | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedLicense: StoredLicense, message: string) => void;
}

export const ExtendLicenseModal: React.FC<ExtendLicenseModalProps> = ({
  license,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !license) return null;

  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [customDate, setCustomDate] = useState<string>(() => {
    const current = new Date(license.expires_at);
    const initial = new Date(current.getTime() + 30 * 24 * 60 * 60 * 1000);
    return initial.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    { label: '+10 Gün (Demo)', days: 10 },
    { label: '+30 Gün (1 Ay)', days: 30 },
    { label: '+90 Gün (3 Ay)', days: 90 },
    { label: '+180 Gün (6 Ay)', days: 180 },
    { label: '+365 Gün (1 Yıl)', days: 365 },
  ];

  // Calculate new expiration preview
  const calculateNewExpiration = (): Date => {
    if (mode === 'custom' && customDate) {
      return new Date(customDate + 'T23:59:59Z');
    }
    const currentExp = new Date(license.expires_at);
    const base = currentExp.getTime() > Date.now() ? currentExp : new Date();
    return new Date(base.getTime() + selectedDays * 24 * 60 * 60 * 1000);
  };

  const newExpirationDate = calculateNewExpiration();
  const currentExpDate = new Date(license.expires_at);

  const handleExtend = async () => {
    try {
      setLoading(true);
      setError(null);

      let payload: { extendDays?: number; customExpiresAt?: string } = {};

      if (mode === 'preset') {
        payload = { extendDays: selectedDays };
      } else {
        if (!customDate) {
          setError('Lütfen geçerli bir tarih seçin.');
          setLoading(false);
          return;
        }
        payload = { customExpiresAt: new Date(customDate + 'T23:59:59Z').toISOString() };
      }

      const updated = await api.extendLicense(license.license_id, payload);
      onSuccess(
        updated,
        `"${license.customer}" lisans süresi ${new Date(updated.expires_at).toLocaleDateString(
          'tr-TR'
        )} tarihine kadar uzatıldı ve RSA anahtarı güncellendi.`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Lisans süresi uzatılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={() => {
        if (!loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 flex items-start justify-between border-b border-[#f1f5f9]">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-lg bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">Lisans Süresini Uzat</h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Müşteri: <strong className="text-[#0f172a]">{license.customer}</strong> ({license.product_name || license.product_id})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-[#fee2e2] border border-[#fecaca] rounded-lg text-xs text-[#991b1b] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs New Expiration Timeline */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748b] font-medium">Mevcut Bitiş:</span>
              <span className="font-semibold text-[#64748b]">
                {currentExpDate.toLocaleDateString('tr-TR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center justify-center py-1">
              <ArrowRight className="w-4 h-4 text-[#3b82f6]" />
            </div>
            <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-[#bfdbfe]">
              <span className="text-[#1d4ed8] font-bold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>Yeni Bitiş Tarihi:</span>
              </span>
              <span className="font-bold text-[#166534] font-mono text-sm">
                {newExpirationDate.toLocaleDateString('tr-TR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex space-x-2 border-b border-[#f1f5f9] pb-3">
            <button
              type="button"
              onClick={() => setMode('preset')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mode === 'preset'
                  ? 'bg-[#3b82f6] text-white shadow-2xs'
                  : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
              }`}
            >
              Hazır Süre Paketleri
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mode === 'custom'
                  ? 'bg-[#3b82f6] text-white shadow-2xs'
                  : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
              }`}
            >
              Özel Tarih Belirle
            </button>
          </div>

          {/* Preset Buttons */}
          {mode === 'preset' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presets.map((p) => {
                const isSelected = selectedDays === p.days;
                return (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setSelectedDays(p.days)}
                    className={`p-2.5 rounded-lg text-xs font-semibold border text-center transition cursor-pointer ${
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
            <div>
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>Yeni Son Kullanma Tarihi Seçin</span>
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

          {/* Cryptographic note */}
          <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] text-[11px] text-[#64748b] leading-relaxed">
            <strong className="text-[#1e293b]">Otomatik RSA Yeniden İmzalama:</strong> Süre uzatıldığında yeni bitiş tarihiyle lisans payload'ı RSA Private Key ile otomatik olarak tekrar imzalanır ve hem çevrimiçi hem çevrimdışı geçerli yeni bir anahtar üretilir.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] px-5 sm:px-6 py-3.5 border-t border-[#e2e8f0] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-[#334155] border border-[#cbd5e1] rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleExtend}
            disabled={loading}
            className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Uzatılıyor & İmzalanıyor...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Süreyi Uzat & İmzala</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
