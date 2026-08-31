import React from 'react';
import {
  FileCheck2,
  ShieldAlert,
  ClockAlert,
  Package,
} from 'lucide-react';
import { DashboardStats as StatsType } from '../types';

interface DashboardStatsProps {
  stats: StatsType | null;
  onFilterClick?: (status: string) => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats, onFilterClick }) => {
  if (!stats) return null;

  const cards = [
    {
      id: 'stat-active',
      title: 'Aktif Lisanslar',
      value: stats.activeLicenses,
      icon: FileCheck2,
      iconColor: 'text-[#10b981]',
      iconBg: 'bg-[#dcfce7]',
      badgeColor: 'bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]',
      badge: 'Geçerli & Aktif',
      filter: 'active',
    },
    {
      id: 'stat-revoked',
      title: 'İptal Edilenler (Revoked)',
      value: stats.revokedLicenses,
      icon: ShieldAlert,
      iconColor: 'text-[#ef4444]',
      iconBg: 'bg-[#fee2e2]',
      badgeColor: 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]',
      badge: 'Geçersiz Kılındı',
      filter: 'revoked',
    },
    {
      id: 'stat-expired',
      title: 'Süresi Dolanlar',
      value: stats.expiredLicenses,
      icon: ClockAlert,
      iconColor: 'text-[#f59e0b]',
      iconBg: 'bg-[#fef3c7]',
      badgeColor: 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]',
      badge: 'UTC Süresi Bitti',
      filter: 'expired',
    },
    {
      id: 'stat-products',
      title: 'Kayıtlı Ürünler',
      value: stats.totalProducts,
      icon: Package,
      iconColor: 'text-[#3b82f6]',
      iconBg: 'bg-[#eff6ff]',
      badgeColor: 'bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]',
      badge: 'Proje / Yazılım',
      filter: 'all',
    },
  ];

  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              id={card.id}
              onClick={() => onFilterClick && onFilterClick(card.filter)}
              className="bg-white border border-[#e2e8f0] rounded-xl p-4 sm:p-5 shadow-sm hover:shadow transition hover:border-[#cbd5e1] cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg ${card.iconBg}`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#1e293b] tracking-tight">
                  {card.value}
                </span>
                <span className="text-xs text-[#94a3b8] font-medium">
                  / {stats.totalLicenses} toplam
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                  {card.badge}
                </span>
                <span className="text-xs font-medium text-[#3b82f6] hover:text-[#2563eb]">
                  Listele &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* License Usage Status Summary Strip */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-[#1e293b]">Uygulama Giriş & Kullanım Durumu:</span>
          <span className="text-[#64748b] text-[11px]">
            (Lisansların istemci uygulamalar tarafından ilk oturum açma durumu)
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Kullanımda (Giriş Yapıldı):</span>
            <span className="font-bold text-emerald-900">{stats.usedCount ?? 0}</span>
          </div>

          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Kullanımda Değil (Beklemede):</span>
            <span className="font-bold text-slate-900">{stats.unusedCount ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
