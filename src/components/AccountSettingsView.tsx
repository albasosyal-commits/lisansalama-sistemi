import React, { useState } from 'react';
import { User, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const AccountSettingsView: React.FC = () => {
  const { username, changeUsername, changePassword } = useAuth();

  // Kullanıcı adı değiştirme formu
  const [newUsername, setNewUsername] = useState('');
  const [usernamePassword, setUsernamePassword] = useState('');
  const [usernameMessage, setUsernameMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Şifre değiştirme formu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = changeUsername(usernamePassword, newUsername);
    setUsernameMessage({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) {
      setNewUsername('');
      setUsernamePassword('');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Yeni şifreler eşleşmiyor.' });
      return;
    }
    const result = changePassword(currentPassword, newPassword);
    setPasswordMessage({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Mevcut Hesap Bilgisi */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shrink-0">
          <ShieldCheck size={18} />
        </div>
        <div>
          <div className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">Mevcut Yönetici Hesabı</div>
          <div className="font-black text-[#1e293b] text-sm">{username}</div>
        </div>
      </div>

      {/* Kullanıcı Adı Değiştir */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <User size={16} />
          </div>
          <h3 className="font-bold text-sm text-[#1e293b]">Kullanıcı Adını Değiştir</h3>
        </div>
        <form onSubmit={handleUsernameSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Yeni Kullanıcı Adı
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 bg-[#f8fafc] focus:bg-white"
              placeholder="yeni-kullanici-adi"
              minLength={3}
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Onay İçin Mevcut Şifre
            </label>
            <input
              type="password"
              value={usernamePassword}
              onChange={(e) => setUsernamePassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 bg-[#f8fafc] focus:bg-white"
              autoComplete="current-password"
              required
            />
          </div>
          {usernameMessage && (
            <div
              className={`text-xs rounded-lg px-3 py-2 font-semibold ${
                usernameMessage.type === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : 'text-[#dc2626] bg-[#fee2e2] border border-[#fecaca]'
              }`}
            >
              {usernameMessage.text}
            </div>
          )}
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Kullanıcı Adını Güncelle
          </button>
        </form>
      </div>

      {/* Şifre Değiştir */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <KeyRound size={16} />
          </div>
          <h3 className="font-bold text-sm text-[#1e293b]">Şifre Değiştir</h3>
        </div>
        <form onSubmit={handlePasswordSubmit} className="p-5 space-y-3.5">
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
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          {passwordMessage && (
            <div
              className={`text-xs rounded-lg px-3 py-2 font-semibold ${
                passwordMessage.type === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : 'text-[#dc2626] bg-[#fee2e2] border border-[#fecaca]'
              }`}
            >
              {passwordMessage.text}
            </div>
          )}
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Şifreyi Güncelle
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccountSettingsView;
