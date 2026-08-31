import React, { useState } from 'react';
import {
  FilePlus2,
  ListOrdered,
  Package,
  KeyRound,
  ShieldCheck,
  Code2,
  BookOpen,
  RefreshCw,
  Menu,
  X,
  Shield,
  Layers,
  Lock,
  Database,
} from 'lucide-react';
import { DashboardStats, KeyMetadata } from '../types';

export type TabType = 'create' | 'list' | 'products' | 'keys' | 'verifier' | 'snippets' | 'firebase' | 'docs';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  keyInfo: KeyMetadata | null;
  stats: DashboardStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export const Sidebar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  keyInfo,
  stats,
  loading,
  onRefresh,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'create' as TabType, label: 'Yeni Lisans Oluştur', icon: FilePlus2, desc: 'RSA-SHA256 İmzala' },
    { id: 'list' as TabType, label: 'Lisans Veritabanı', icon: ListOrdered, desc: 'Kayıtlar & İptal (Revoke)' },
    { id: 'products' as TabType, label: 'Ürün Yönetimi', icon: Package, desc: 'Proje & product_id' },
    { id: 'keys' as TabType, label: 'RSA Anahtarları', icon: KeyRound, desc: 'Public & Private Key' },
    { id: 'verifier' as TabType, label: 'Doğrulama Sandbox', icon: ShieldCheck, desc: 'Çevrimdışı & Çevrimiçi' },
    { id: 'snippets' as TabType, label: 'SDK & Entegrasyon', icon: Code2, desc: 'Python, Node, C#, Go' },
    { id: 'firebase' as TabType, label: 'Firebase & Firestore', icon: Database, desc: 'Bulut Veritabanı Bağlantısı' },
    { id: 'docs' as TabType, label: 'Mimari Dokümanı', icon: BookOpen, desc: 'Kriptografi Kılavuzu' },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden bg-[#0f172a] text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center text-white font-bold shadow">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="font-extrabold text-base tracking-tight">
            LİSANS<span className="text-[#3b82f6]">YÖNETİCİSİ</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3b82f6]' : ''}`} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm pt-16">
          <div className="bg-[#0f172a] border-b border-slate-800 p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition ${
                    isActive
                      ? 'bg-[#3b82f6] text-white shadow-sm'
                      : 'text-slate-300 hover:bg-[#1e293b] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop Sidebar (Geometric Balance) */}
      <aside className="hidden lg:flex w-64 bg-[#0f172a] text-white flex-col border-r border-slate-800 flex-shrink-0 sticky top-0 h-screen select-none">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#3b82f6] flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight leading-tight">
                LİSANS<span className="text-[#3b82f6]">YÖNETİCİ</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">RSA-2048 Engine</div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 mb-1">
            Menü
          </div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`sidebar-nav-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition cursor-pointer ${
                  isActive
                    ? 'bg-[#3b82f6] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-[#1e293b] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Key & Version Info Card */}
        <div className="p-4 border-t border-slate-800/90 bg-[#0b1120]">
          <div className="p-3 bg-[#1e293b] rounded-lg border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">RSA Fingerprint</span>
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            </div>
            {keyInfo ? (
              <div
                className="font-mono text-[11px] text-[#38bdf8] truncate"
                title={keyInfo.fingerprint}
              >
                {keyInfo.fingerprint.slice(0, 16)}...
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">Anahtar yükleniyor...</div>
            )}
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-700/50 flex justify-between">
              <span>Sürüm 2.4.0 (RSA-SHA256)</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

// Top Header Component (Geometric Balance)
interface HeaderBarProps {
  activeTab: TabType;
  stats: DashboardStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  stats,
  loading,
  onRefresh,
}) => {
  const titles: Record<TabType, { title: string; subtitle: string }> = {
    create: { title: 'Yeni Lisans Oluştur', subtitle: 'RSA-SHA256 dijital imzalı anahtar üretici' },
    list: { title: 'Lisans Veritabanı', subtitle: 'Tüm üretilen lisans kayıtları, arama ve iptal (revoke)' },
    products: { title: 'Ürün Yönetimi', subtitle: 'Yazılım ve proje tanımlamaları (product_id)' },
    keys: { title: 'RSA-2048 Güvenlik & Anahtarlar', subtitle: 'Public & Private Key asimetrik anahtar çifti' },
    verifier: { title: 'Lisans Doğrulama Sandbox', subtitle: 'Çevrimdışı (offline) ve çevrimiçi (online) test motoru' },
    snippets: { title: 'SDK & Entegrasyon Kodları', subtitle: 'Python, Node.js, C#, PHP ve Go doğrulama kodları' },
    firebase: { title: 'Firebase & Firestore Veritabanı', subtitle: 'Bulut Firestore bağlantı durumu, yapılandırma ve koleksiyonlar' },
    docs: { title: 'Mimari Dokümantasyon', subtitle: 'Çalışma prensibi, güvenlik önlemleri ve format özellikleri' },
  };

  const current = titles[activeTab] || { title: 'Genel Bakış', subtitle: 'Lisans Yönetim Paneli' };

  return (
    <header className="h-16 bg-white border-b border-[#e2e8f0] px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Title & Context */}
      <div>
        <h1 className="text-base sm:text-lg font-bold text-[#1e293b] leading-tight">
          {current.title}
        </h1>
        <p className="text-xs text-[#64748b] hidden sm:block">
          {current.subtitle}
        </p>
      </div>

      {/* Right Stats & Actions */}
      <div className="flex items-center space-x-4 sm:space-x-6">
        {stats && (
          <>
            <div className="text-right hidden sm:block">
              <div className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
                Aktif Lisanslar
              </div>
              <div className="font-bold text-sm text-[#1e293b]">
                {stats.activeLicenses} / {stats.totalLicenses}
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <div className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
                Sistem Durumu
              </div>
              <div className="text-[#10b981] font-bold text-sm flex items-center justify-end space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                <span>Güvenli</span>
              </div>
            </div>
          </>
        )}

        <button
          onClick={onRefresh}
          disabled={loading}
          title="Verileri Yenile"
          className="p-2 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#cbd5e1] transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3b82f6]' : ''}`} />
        </button>
      </div>
    </header>
  );
};
