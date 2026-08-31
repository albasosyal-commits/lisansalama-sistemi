import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  ShieldCheck,
  Lock,
  RefreshCw,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { KeyMetadata } from '../types';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';
import { DEFAULT_KEY_METADATA } from '../data/defaultKeys';

interface KeyManagerProps {
  keyInfo: KeyMetadata | null;
  onRefresh: () => void;
}

export const KeyManager: React.FC<KeyManagerProps> = ({ keyInfo, onRefresh }) => {
  const [copied, setCopied] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeKeyMeta = keyInfo || DEFAULT_KEY_METADATA;
  const effectivePublicKey = (activeKeyMeta.publicKey && !activeKeyMeta.publicKey.includes('...'))
    ? activeKeyMeta.publicKey
    : DEFAULT_KEY_METADATA.publicKey;

  const handleCopy = () => {
    navigator.clipboard.writeText(effectivePublicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPem = () => {
    const blob = new Blob([effectivePublicKey], { type: 'application/x-pem-file;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'public_key.pem';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([effectivePublicKey], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'public_key.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmRegenerate = async () => {
    try {
      setRegenerating(true);
      setError(null);
      setMsg(null);
      const res = await api.regenerateKeys();
      setMsg({ type: 'success', text: res.message });
      setShowRegenerateModal(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Yeni anahtar üretilemedi');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1e293b]">
            RSA-2048 Asimetrik Anahtar Çifti
          </h2>
          <p className="text-xs text-[#64748b]">
            Kriptografik dijital imzalama (Private Key) ve çevrimdışı doğrulama (Public Key) yönetimi
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowRegenerateModal(true);
          }}
          disabled={regenerating}
          className="px-3.5 py-2 bg-white hover:bg-[#fee2e2] text-[#ef4444] border border-[#fecaca] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          <span>Yeni Anahtar Çifti Oluştur</span>
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-lg border text-xs sm:text-sm ${
            msg.type === 'success'
              ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#166534]'
              : 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b]'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Public Key display and download options */}
        <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#10b981]" />
              <h3 className="font-bold text-[#1e293b] text-sm">Genel Anahtar (Public Key)</h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] border border-[#bbf7d0] font-semibold">
              Dağıtıma Uygun (Güvenli)
            </span>
          </div>

          <p className="text-xs text-[#64748b]">
            Bu genel anahtarı (Public Key) diğer projelerinize (.py, .ts, .cs, .php, .go) gömerek veya yanlarına ekleyerek,
            <strong> hiçbir internet bağlantısına ihtiyaç duymadan</strong> lisans doğrulaması yapabilirsiniz.
          </p>

          <div className="relative">
            <textarea
              readOnly
              rows={9}
              value={effectivePublicKey}
              className="w-full bg-[#0f172a] font-mono text-xs leading-relaxed text-[#10b981] p-3.5 rounded-lg border border-slate-800 select-all focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              id="btn-copy-public-key"
              onClick={handleCopy}
              className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Kopyalandı!' : "Public Key'i Kopyala"}</span>
            </button>

            <button
              id="btn-download-pem"
              onClick={handleDownloadPem}
              className="px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#1e293b] rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-[#cbd5e1] transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>.pem Olarak İndir</span>
            </button>

            <button
              id="btn-download-txt"
              onClick={handleDownloadTxt}
              className="px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#1e293b] rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-[#cbd5e1] transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>.txt Olarak İndir</span>
            </button>
          </div>
        </div>

        {/* Right: Security & Architecture Specs */}
        <div className="lg:col-span-5 space-y-4">
          {/* Key Metadata Card */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-3.5">
            <div className="flex items-center space-x-2 text-[#1e293b] font-bold text-sm">
              <Layers className="w-4 h-4 text-[#3b82f6]" />
              <span>Anahtar Parametreleri</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#f1f5f9]">
                <span className="text-[#64748b]">Algoritma:</span>
                <span className="font-semibold text-[#1e293b]">{activeKeyMeta.algorithm}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#f1f5f9]">
                <span className="text-[#64748b]">Anahtar Uzunluğu:</span>
                <span className="font-mono font-semibold text-[#3b82f6]">{activeKeyMeta.keySize || 2048} Bit</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#f1f5f9]">
                <span className="text-[#64748b]">Format:</span>
                <span className="font-mono text-[#334155]">SPKI / PKCS#8 (PEM)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#f1f5f9]">
                <span className="text-[#64748b]">Oluşturulma Tarihi:</span>
                <span className="text-[#334155]">
                  {new Date(activeKeyMeta.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="pt-1">
                <span className="text-[#64748b] block mb-1">SHA-256 Parmak İzi (Fingerprint):</span>
                <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#cbd5e1] font-mono text-[10px] text-[#166534] break-all font-bold">
                  {activeKeyMeta.fingerprint}
                </div>
              </div>
            </div>
          </div>

          {/* Security Guarantee Card */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-[#1e293b] font-bold text-xs uppercase tracking-wider">
              <Lock className="w-4 h-4 text-[#3b82f6]" />
              <span>Gizli Anahtar (Private Key) Güvenliği</span>
            </div>
            <ul className="space-y-2 text-xs text-[#64748b] leading-relaxed list-disc list-inside">
              <li>
                <strong className="text-[#1e293b]">Asla Dışarı Sızmaz:</strong> Private Key hiçbir API cevabında istemciye gönderilmez.
              </li>
              <li>
                <strong className="text-[#1e293b]">AES-256-GCM Şifreleme:</strong> Disk üzerinde PBKDF2 + AES-256-GCM ile şifrelenmiş tutulur.
              </li>
              <li>
                <strong className="text-[#1e293b]">Tek Yönlü Doğrulama:</strong> İstemci projeler sadece Public Key ile doğrulama yapabilir; asla sahte lisans üretemezler.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Regenerate Confirmation Modal */}
      {showRegenerateModal && (
        <ConfirmModal
          isOpen={showRegenerateModal}
          onClose={() => {
            if (!regenerating) setShowRegenerateModal(false);
          }}
          onConfirm={handleConfirmRegenerate}
          title="Yeni RSA Anahtar Çifti Üret"
          description="Sistemin imzalama ve doğrulama kriptografik anahtar çiftini yenilemek istediğinize emin misiniz?"
          itemDetails={[
            { label: 'Mevcut Algoritma', value: activeKeyMeta.algorithm },
            { label: 'Mevcut Parmak İzi', value: activeKeyMeta.fingerprint.slice(0, 24) + '...', isMono: true },
          ]}
          warningText="Önemli Uyarı: Yeni anahtar üretildiğinde, bundan sonraki tüm yeni lisanslar YENİ Private Key ile imzalanacaktır. Diğer projelerinizdeki istemci yazılımların yeni lisansları doğrulayabilmesi için yeni Public Key dosyasını projelere dağıtmanız gerekecektir. Eski üretilen lisanslar ise eski public key ile doğrulanmaya devam eder."
          confirmText="Evet, Yeni Anahtar Üret"
          cancelText="Vazgeç"
          variant="warning"
          isLoading={regenerating}
          error={error}
        />
      )}
    </div>
  );
};
