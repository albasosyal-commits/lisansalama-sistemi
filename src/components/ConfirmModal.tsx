import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  itemDetails?: { label: string; value: string | React.ReactNode; isMono?: boolean }[];
  warningText?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  error?: string | null;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemDetails,
  warningText,
  confirmText = 'Evet, Sil',
  cancelText = 'Vazgeç',
  variant = 'danger',
  isLoading = false,
  error = null,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          iconBg: 'bg-[#fef3c7] text-[#b45309] border border-[#fde68a]',
          confirmBtn: 'bg-[#d97706] hover:bg-[#b45309] text-white',
          Icon: AlertTriangle,
        };
      case 'primary':
        return {
          iconBg: 'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]',
          confirmBtn: 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white',
          Icon: RefreshCw,
        };
      case 'danger':
      default:
        return {
          iconBg: 'bg-[#fee2e2] text-[#dc2626] border border-[#fecaca]',
          confirmBtn: 'bg-[#dc2626] hover:bg-[#b91c1c] text-white',
          Icon: Trash2,
        };
    }
  };

  const { iconBg, confirmBtn, Icon } = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 flex items-start justify-between border-b border-[#f1f5f9]">
          <div className="flex items-start space-x-3.5">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-bold text-[#0f172a]">
                {title}
              </h3>
              {description && (
                <p className="text-xs text-[#64748b] mt-1 leading-relaxed">{description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Error display if operation failed */}
          {error && (
            <div className="p-3 bg-[#fee2e2] border border-[#fecaca] rounded-lg text-xs text-[#991b1b] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Item details table/card */}
          {itemDetails && itemDetails.length > 0 && (
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3.5 space-y-2 text-xs">
              {itemDetails.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1 border-b border-[#f1f5f9] last:border-0 gap-0.5"
                >
                  <span className="text-[#64748b] font-medium">{item.label}:</span>
                  <span
                    className={`font-semibold text-[#0f172a] break-all ${
                      item.isMono ? 'font-mono text-[11px] text-[#334155]' : ''
                    }`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Warning box */}
          {warningText && (
            <div className="p-3 rounded-lg bg-[#fffbeb] border border-[#fef3c7] text-xs text-[#92400e] flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#d97706]" />
              <span className="leading-relaxed font-medium">{warningText}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#f8fafc] px-5 sm:px-6 py-3.5 border-t border-[#e2e8f0] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-[#334155] border border-[#cbd5e1] rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-60 ${confirmBtn}`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>İşlem yapılıyor...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
