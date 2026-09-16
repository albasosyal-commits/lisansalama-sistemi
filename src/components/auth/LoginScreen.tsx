import React, { useState } from 'react';
import { ShieldCheck, Lock, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ok = login(username, password);
    if (!ok) {
      setError('Kullanıcı adı veya şifre hatalı.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden">
        <div className="px-6 py-6 bg-[#0f172a] text-white text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
            <ShieldCheck size={24} />
          </div>
          <h1 className="font-black text-lg tracking-tight">Lisans Yöneticisi</h1>
          <p className="text-xs text-slate-400 mt-1">Yönetici Girişi Gerekli</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#cbd5e1] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 bg-[#f8fafc] focus:bg-white"
                placeholder="admin"
                autoFocus
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Şifre
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#cbd5e1] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 bg-[#f8fafc] focus:bg-white"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-[#dc2626] bg-[#fee2e2] border border-[#fecaca] rounded-lg px-3 py-2 font-semibold">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
