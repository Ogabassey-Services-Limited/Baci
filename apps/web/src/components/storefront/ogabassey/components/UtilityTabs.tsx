'use client';

import { Smartphone, Tv, Wallet, Wifi, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'airtime', icon: Smartphone, label: 'Airtime' },
  { id: 'data', icon: Wifi, label: 'Data' },
  { id: 'tv', icon: Tv, label: 'TV' },
  { id: 'power', icon: Zap, label: 'Power' },
  { id: 'betting', icon: Wallet, label: 'Betting' },
] as const;

export type UtilityTabId = (typeof TABS)[number]['id'];

interface UtilityTabsProps {
  activeTab: UtilityTabId;
  onSelect: (tab: UtilityTabId) => void;
}

export function UtilityTabs({ activeTab, onSelect }: UtilityTabsProps) {
  return (
    <div
      aria-label="Utility type"
      className="flex border-b border-gray-100 overflow-x-auto no-scrollbar"
      role="tablist"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          aria-selected={activeTab === tab.id}
          role="tab"
          tabIndex={activeTab === tab.id ? 0 : -1}
          type="button"
          onClick={() => onSelect(tab.id)}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-3 px-4 min-w-[80px] transition-colors border-b-2',
            activeTab === tab.id
              ? 'border-store-primary text-store-primary bg-store-primary/5'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          <tab.icon size={18} />
          <span className="text-xs font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
