import React from 'react';
import { History, X, Clock, Play, Pause, ShieldAlert, ShieldCheck, PlusCircle, Calendar } from 'lucide-react';
import { StoredLicense } from '../types';

interface LicenseHistoryModalProps {
  license: StoredLicense | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LicenseHistoryModal: React.FC<LicenseHistoryModalProps> = ({
  license,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !license) return null;

  const logs = license.logs || [
    {
      id: 'log-init',
      timestamp: license.created_at || license.issued_at,
      action: 'created' as const,
      description: `Lisans "${license.customer}" için oluşturuldu.`,
    },
  ];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created':
        return {
          icon: <PlusCircle className="w-4 h-4 text-[#2563eb]" />,
          bg: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
          label: 'Lisans Üretildi',
        };
      case 'extended':
        return {
          icon: <Clock className="w-4 h-4 text-[#16a34a]" />,
          bg: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]',
          label: 'Süre Uzatıldı',
        };
      case 'paused':
        return {
          icon: <Pause className="w-4 h-4 text-[#ea580c]" />,
          bg: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
          label: 'Lisans Donduruldu',
        };
      case 'unpaused':
        return {
          icon: <Play className="w-4 h-4 text-[#16a34a]" />,
          bg: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]',
          label: 'Dondurma Kaldırıldı',
        };
      case 'revoked':
        return {
          icon: <ShieldAlert className="w-4 h-4 text-[#e11d48]" />,
          bg: 'bg-[#fff1f2] text-[#be123c] border-[#fecaca]',
          label: 'Lisans İptal Edildi',
        };
      case 'reactivated':
        return {
          icon: <ShieldCheck className="w-4 h-4 text-[#16a34a]" />,
          bg: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]',
          label: 'Yeniden Aktif Edildi',
        };
      default:
        return {
          icon: <History className="w-4 h-4 text-[#475569]" />,
          bg: 'bg-[#f8fafc] text-[#334155] border-[#e2e8f0]',
          label: action,
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-[#e2e8f0] flex items-start justify-between bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1e293b]">Lisans İşlem Geçmişi (Activity Log)</h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Müşteri: <strong className="text-[#1e293b]">{license.customer}</strong> ({license.product_name || license.product_id})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body / Log Timeline */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#64748b]">
              Henüz işlem kaydı bulunmamaktadır.
            </div>
          ) : (
            <div className="relative border-l-2 border-[#e2e8f0] ml-3.5 space-y-6 my-2">
              {logs.map((log) => {
                const badge = getActionBadge(log.action);
                const dateObj = new Date(log.timestamp);

                return (
                  <div key={log.id} className="relative pl-6 group">
                    {/* Circle Bullet Icon */}
                    <div className="absolute -left-[17px] top-0.5 p-1 bg-white rounded-full border border-[#cbd5e1] shadow-2xs">
                      {badge.icon}
                    </div>

                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 space-y-2 hover:border-[#bfdbfe] transition shadow-2xs">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <span className="text-[11px] text-[#64748b] font-mono flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-[#94a3b8]" />
                          <span>
                            {dateObj.toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            - {dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                      </div>

                      <p className="text-xs text-[#1e293b] font-medium leading-relaxed">
                        {log.description}
                      </p>

                      {log.details && (
                        <div className="bg-white p-2.5 rounded-lg border border-[#e2e8f0] text-[11px] text-[#475569] space-y-1 font-mono">
                          {log.details.previous_expires_at && (
                            <div>
                              <span className="text-[#64748b]">Önceki Bitiş: </span>
                              <span>
                                {new Date(log.details.previous_expires_at).toLocaleDateString('tr-TR')}
                              </span>
                            </div>
                          )}
                          {log.details.new_expires_at && (
                            <div>
                              <span className="text-[#166534] font-bold">Yeni Bitiş: </span>
                              <span className="font-bold text-[#166534]">
                                {new Date(log.details.new_expires_at).toLocaleDateString('tr-TR')}
                              </span>
                            </div>
                          )}
                          {log.details.machine_id && (
                            <div>
                              <span className="text-[#64748b]">Cihaz Kilidi: </span>
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

        {/* Footer */}
        <div className="bg-[#f8fafc] px-5 sm:px-6 py-3.5 border-t border-[#e2e8f0] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-[#334155] border border-[#cbd5e1] rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
