import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  FileCode,
  Info,
} from 'lucide-react';
import { KeyMetadata, Product } from '../types';
import { CODE_SNIPPETS } from '../data/codeSnippets';
import { DEFAULT_KEY_METADATA } from '../data/defaultKeys';

interface CodeSnippetsViewProps {
  keyInfo: KeyMetadata | null;
  products: Product[];
}

export const CodeSnippetsView: React.FC<CodeSnippetsViewProps> = ({ keyInfo, products }) => {
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>('python');
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.productId || 'akilli-muhasebe-erp'
  );
  const [copied, setCopied] = useState<boolean>(false);

  const activeSnippet = CODE_SNIPPETS.find((s) => s.id === selectedSnippetId) || CODE_SNIPPETS[0];
  const publicKeyPem = (keyInfo?.publicKey && !keyInfo.publicKey.includes('...')) 
    ? keyInfo.publicKey 
    : DEFAULT_KEY_METADATA.publicKey;

  const generatedCode = activeSnippet.code(publicKeyPem, selectedProductId);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSnippet = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeSnippet.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm space-y-1">
        <h2 className="text-base sm:text-lg font-bold text-[#1e293b]">
          Diğer Projelere Entegrasyon Kodları (SDK Snippets)
        </h2>
        <p className="text-xs text-[#64748b]">
          Aşağıdaki kodları diğer projelerinize kopyalayarak lisansları <strong>çevrimdışı (internetsiz)</strong> doğrulayabilirsiniz.
        </p>
      </div>

      {/* Selector Toolbar */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Language Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CODE_SNIPPETS.map((snippet) => {
              const isSelected = selectedSnippetId === snippet.id;
              return (
                <button
                  key={snippet.id}
                  onClick={() => setSelectedSnippetId(snippet.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#3b82f6] text-white shadow-sm'
                      : 'bg-[#f8fafc] text-[#334155] hover:bg-[#f1f5f9] border border-[#cbd5e1]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{snippet.name}</span>
                </button>
              );
            })}
          </div>

          {/* Target Product selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#64748b] whitespace-nowrap">Örnek Ürün:</span>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="bg-white border border-[#cbd5e1] text-xs text-[#1e293b] rounded-lg px-3 py-1.5 focus:border-[#3b82f6] outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.productId}>
                  {p.name} ({p.productId})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Snippet Description */}
        <div className="p-3 bg-[#eff6ff] rounded-lg border border-[#bfdbfe] text-xs text-[#1e40af] flex items-start space-x-2">
          <Info className="w-4 h-4 text-[#3b82f6] flex-shrink-0 mt-0.5" />
          <div>
            <strong>{activeSnippet.name}: </strong>
            {activeSnippet.description}
          </div>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        {/* Code Header Bar */}
        <div className="bg-[#0f172a] px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            </div>
            <span className="text-xs font-mono text-slate-400 ml-2">{activeSnippet.filename}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopyalandı!' : 'Kodu Kopyala'}</span>
            </button>
            <button
              onClick={handleDownloadSnippet}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>İndir</span>
            </button>
          </div>
        </div>

        {/* Code Block */}
        <pre className="p-4 sm:p-6 bg-[#0f172a] font-mono text-xs text-[#38bdf8] leading-relaxed overflow-x-auto selection:bg-[#3b82f6] selection:text-white">
          <code>{generatedCode}</code>
        </pre>
      </div>
    </div>
  );
};
