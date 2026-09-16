import React, { useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Yeni şifreler eşleşmiyor.' });
      return;
    }
    const result = changePassword(currentPassword, newPassword);
    setMessage({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(onClose, 1200);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-[#e2e8f0] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <KeyRound size={16} />
            </div>
            <h3 className="font-bold text-sm text-[#1e293b]">Şifre Değiştir</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#1e293b] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Mevcut Şifre
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 bg-[#f8fafc] focus:bg-white"
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Yeni Şifre
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 bg-[#f8fafc] focus:bg-white"
              autoComplete="new-password"
              minLength={4}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Yeni Şifre (Tekrar)
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 bg-[#f8fafc] focus:bg-white"
              autoComplete="new-password"
              required
            />
          </div>

          {message && (
            <div
              className={`text-xs rounded-lg px-3 py-2 font-semibold ${
                message.type === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : 'text-[#dc2626] bg-[#fee2e2] border border-[#fecaca]'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Şifreyi Güncelle
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
