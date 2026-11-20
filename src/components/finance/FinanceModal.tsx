import React from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const FinanceModal: React.FC<Props> = ({ title, onClose, children, footer }) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <div
      className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col"
      onClick={e => e.stopPropagation()}
    >
      <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
        <h3 className="font-bold text-[#1e293b]">{title}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100" aria-label="Kapat">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
      {footer && <div className="px-5 py-3 border-t border-[#e2e8f0] flex justify-end gap-2">{footer}</div>}
    </div>
  </div>
);
