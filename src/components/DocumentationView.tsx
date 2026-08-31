import React from 'react';
import {
  BookOpen,
  Lock,
  Cpu,
  FileCheck2,
  Zap,
  Clock,
} from 'lucide-react';

export const DocumentationView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm space-y-1">
        <h2 className="text-base sm:text-lg font-bold text-[#1e293b]">
          Lisans Sistemi Mimari Kılavuzu & Dokümantasyon
        </h2>
        <p className="text-xs text-[#64748b]">
          RSA-2048 Asimetrik Kriptografi ile internetsiz çevrimdışı ve opsiyonel çevrimiçi doğrulama mantığı
        </p>
      </div>

      {/* Architecture Flow Diagram (Visual) */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-[#1e293b] text-base flex items-center space-x-2">
          <Zap className="w-5 h-5 text-[#f59e0b]" />
          <span>Genel Çalışma Akışı (Architecture Workflow)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Step 1 */}
          <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-[#3b82f6] text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <span className="text-[10px] uppercase font-bold text-[#3b82f6] tracking-wider">
                Yönetici Paneli
              </span>
            </div>
            <h4 className="font-bold text-sm text-[#1e293b]">Lisans Üretimi & İmzalama</h4>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Müşteri, ürün ve süre bilgileri JSON payload yapılır. Sunucudaki <strong>RSA-2048 Private Key</strong> ile SHA256 dijital imzası oluşturulup <code className="text-[#1d4ed8] font-mono">base64(payload).base64(imza)</code> olarak birleştirilir.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-[#10b981] text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <span className="text-[10px] uppercase font-bold text-[#166534] tracking-wider">
                İstemci Proje (Client)
              </span>
            </div>
            <h4 className="font-bold text-sm text-[#1e293b]">Çevrimdışı (Offline) Doğrulama</h4>
            <p className="text-xs text-[#64748b] leading-relaxed">
              İstemci yazılım içine gömülen <strong>RSA Public Key</strong> ile imzanın orijinal olup olmadığını ve UTC son kullanma tarihini <strong>sıfır internet ihtiyacı ile</strong> doğrular.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-[#0f172a] text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">
                Opsiyonel Çevrimiçi
              </span>
            </div>
            <h4 className="font-bold text-sm text-[#1e293b]">Online İptal (Revoke) Kontrolü</h4>
            <p className="text-xs text-[#64748b] leading-relaxed">
              İstemci internete bağlıysa <code className="text-[#3b82f6] font-mono">POST /api/v1/verify</code> servisine istek atarak lisansın yönetici tarafından iptal edilip edilmediğini anlık sorgulayabilir.
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Technical Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Format Spec */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-[#3b82f6] font-bold text-sm">
            <FileCheck2 className="w-4 h-4" />
            <span className="text-[#1e293b]">Lisans Anahtarı Formatı</span>
          </div>
          <p className="text-xs text-[#64748b]">
            Lisans anahtarları noktayla ayrılmış iki Base64 bileşeninden oluşur:
          </p>
          <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-[#10b981] break-all">
            base64(JSON_PAYLOAD) . base64(RSA_SHA256_SIGNATURE)
          </div>
          <div className="text-xs text-[#64748b] space-y-1.5 pt-1">
            <div>
              <strong className="text-[#1e293b]">1. Payload:</strong> Müşteri adı, ürün kodu, veriliş tarihi, bitiş tarihi ve opsiyonel makine ID.
            </div>
            <div>
              <strong className="text-[#1e293b]">2. İmza:</strong> Payload metninin RSA Private Key ile imzalanmış kriptografik mührüdür. Payload içindeki tek 1 harf bile değiştirilse imza geçersiz sayılır.
            </div>
          </div>
        </div>

        {/* Machine Lock Spec */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-[#10b981] font-bold text-sm">
            <Cpu className="w-4 h-4" />
            <span className="text-[#1e293b]">Donanım Kilidi (Machine ID / HWID)</span>
          </div>
          <p className="text-xs text-[#64748b]">
            Lisansın başka bilgisayarlara kopyalanıp çalıştırılmasını engellemek için:
          </p>
          <ul className="text-xs text-[#64748b] space-y-1.5 list-disc list-inside">
            <li>
              Müşterinin bilgisayarında anakart seri no, CPU ID veya MAC adresinden SHA256 bir özet üretilir (örn. <code className="text-[#166534] font-mono">HWID-8B9A-21C4</code>).
            </li>
            <li>
              Bu kod lisans oluşturulurken <code className="text-[#166534] font-mono">machine_id</code> alanına yazılır.
            </li>
            <li>
              İstemci yazılım lisansı doğrulamadan önce kendi donanım kimliğiyle lisans içindeki kodun aynı olduğunu teyit eder.
            </li>
          </ul>
        </div>

        {/* Security at Rest */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-[#f59e0b] font-bold text-sm">
            <Lock className="w-4 h-4" />
            <span className="text-[#1e293b]">Sunucu Güvenliği (At-Rest Encryption)</span>
          </div>
          <p className="text-xs text-[#64748b]">
            Sunucudaki Private Key diske düz metin (plain text) olarak ASLA kaydedilmez.
          </p>
          <ul className="text-xs text-[#64748b] space-y-1.5 list-disc list-inside">
            <li>PBKDF2 anahtar türetme algoritması (100.000 iterasyon) kullanılır.</li>
            <li>AES-256-GCM ile kimlik doğrulamalı (authenticated) şifreleme uygulanır.</li>
            <li>Sunucu API'leri hiçbir zaman Private Key çıktısı vermez.</li>
          </ul>
        </div>

        {/* UTC Time Standard */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-[#3b82f6] font-bold text-sm">
            <Clock className="w-4 h-4" />
            <span className="text-[#1e293b]">UTC Saat Standardı ve Zaman Sahteciliği</span>
          </div>
          <p className="text-xs text-[#64748b]">
            Tüm tarihler ISO 8601 UTC formatında saklanır (<code className="text-[#3b82f6] font-mono">YYYY-MM-DDTHH:mm:ssZ</code>).
          </p>
          <p className="text-xs text-[#64748b]">
            Yerel saat dilimlerindeki karışıklıklar önlenir. Çevrimdışı doğrulamada sistem saatinin geriye alınması riskine karşı istemci yazılımlarda son çalışma tarihini yerel şifreli bir dosyada saklayıp monotonic zaman kontrolü yapılması tavsiye edilir.
          </p>
        </div>
      </div>
    </div>
  );
};
