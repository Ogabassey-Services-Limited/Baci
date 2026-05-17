'use client';

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Loader2,
  ScanBarcode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
} from 'lucide-react';
import Image from 'next/image';
import type React from 'react';
import { ImeiCheckerFindImei } from './imei-checker-find-imei';
import { IMEI_CHECKER_PROOF_ITEMS } from './imei-checker-proof-items';
import { SERVICE_TIERS, type ServiceTier } from './imei-checker-tiers';
import type { ProductSuggestion } from './imei-checker-types';

interface OgabasseyImeiEntryProps {
  currentTier: (typeof SERVICE_TIERS)[ServiceTier];
  deviceQuery: string;
  error: string | null;
  imei: string;
  isLoading: boolean;
  onCheck: (event: React.FormEvent) => void;
  onDeviceQueryChange: (value: string) => void;
  onDeviceSearchFocus: () => void;
  onImeiChange: (value: string) => void;
  onSelectDevice: (device: ProductSuggestion) => void;
  onSelectedTierChange: (tier: ServiceTier) => void;
  onShowTierPickerChange: (value: boolean) => void;
  searchLoading: boolean;
  selectedDevice: ProductSuggestion | null;
  selectedTier: ServiceTier;
  showSuggestions: boolean;
  showTierPicker: boolean;
  suggestions: ProductSuggestion[];
}

export const OgabasseyImeiEntry = ({
  currentTier,
  deviceQuery,
  error,
  imei,
  isLoading,
  onCheck,
  onDeviceQueryChange,
  onDeviceSearchFocus,
  onImeiChange,
  onSelectDevice,
  onSelectedTierChange,
  onShowTierPickerChange,
  searchLoading,
  selectedDevice,
  selectedTier,
  showSuggestions,
  showTierPicker,
  suggestions,
}: OgabasseyImeiEntryProps) => (
  <>
    <div className="max-w-3xl mx-auto text-center mb-8">
      <div className="inline-flex items-center gap-2 bg-[var(--store-primary)]/5 border border-[var(--store-primary)]/10 text-[var(--store-primary)] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
        <ShieldCheck size={14} />
        Trusted by 10,000+ Buyers
      </div>
      <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
        Don't Get Scammed.
        <br />
        <span className="text-[var(--store-primary)]">Verify First.</span>
      </h1>
      <p className="text-gray-600 text-lg mb-4 max-w-xl mx-auto leading-relaxed">
        That "Brand New" iPhone might be{' '}
        <span className="font-semibold text-gray-900">
          stolen, iCloud locked, or refurbished
        </span>
        . One quick check can save you from losing ₦500,000+.
      </p>
      <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-8">
        {['Instant Results', 'Official Database', '100% Accurate'].map(
          (label) => (
            <div className="flex items-center gap-1.5" key={label}>
              <Check size={16} className="text-[var(--store-success-text,#16a34a)]" />
              <span>{label}</span>
            </div>
          )
        )}
      </div>
    </div>

    <div className="max-w-xl mx-auto mb-8">
      <p className="text-center text-sm font-medium text-gray-500 mb-3">
        Step 1: What device are you checking?
      </p>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Smartphone className="text-gray-400" size={20} />
        </div>
        <input
          type="text"
          value={deviceQuery}
          onChange={(event) => onDeviceQueryChange(event.target.value)}
          onFocus={onDeviceSearchFocus}
          placeholder="Type device name (e.g., iPhone 16, Samsung S24...)"
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[var(--store-primary)]/10 focus:border-[var(--store-primary)]/20 outline-none text-base transition-all"
        />
        {searchLoading && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <Loader2 className="animate-spin text-gray-400" size={18} />
          </div>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
            {suggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelectDevice(product)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
              >
                {product.image && (
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={40}
                    height={40}
                    sizes="40px"
                    className="rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  {product.category && (
                    <p className="text-xs text-gray-500">{product.category}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedDevice && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[var(--store-success-text,#16a34a)]">
          <Check size={16} />
          <span>
            Checking: <strong>{selectedDevice.name}</strong>
          </span>
        </div>
      )}
    </div>

    <div className="max-w-4xl mx-auto mb-8">
      <p className="text-center text-sm font-medium text-gray-500 mb-4">
        Step 2: Choose what you want to verify:
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(SERVICE_TIERS) as ServiceTier[]).map((tierKey) => {
          const tier = SERVICE_TIERS[tierKey];
          const isSelected = selectedTier === tierKey;
          const Icon = tier.icon;

          return (
            <button
              key={tierKey}
              type="button"
              aria-label={`${tier.name}, ${tier.tagline}, ${tier.priceDisplay}`}
              aria-pressed={isSelected}
              onClick={() => onSelectedTierChange(tierKey)}
              className={`relative p-4 rounded-2xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5 shadow-lg shadow-[var(--store-primary)]/20'
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
              }`}
            >
              {'recommended' in tier && tier.recommended && (
                <div className="absolute -top-2 -right-2 bg-[var(--store-primary)] text-[var(--store-primary-text,#ffffff)] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star size={10} fill="currentColor" />
                  BEST
                </div>
              )}
              <Icon
                size={24}
                className={
                  isSelected ? 'text-[var(--store-primary)]' : 'text-gray-400'
                }
              />
              <p
                className={`font-bold text-sm mt-2 ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}
              >
                {tier.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{tier.tagline}</p>
              <p
                className={`text-sm font-bold mt-2 ${isSelected ? 'text-[var(--store-primary)]' : 'text-gray-900'}`}
              >
                {tier.priceDisplay}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => onShowTierPickerChange(!showTierPicker)}
          className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
        >
          What's included in {currentTier.name}?
          <ChevronRight
            size={14}
            className={`transition-transform ${showTierPicker ? 'rotate-90' : ''}`}
          />
        </button>
        {showTierPicker && (
          <div className="mt-3 inline-flex flex-wrap justify-center gap-2">
            {currentTier.features.map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full"
              >
                <Check size={12} className="text-[var(--store-success-text,#16a34a)]" />
                {feature}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>

    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-3 md:p-4">
        <form onSubmit={onCheck} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <ScanBarcode className="text-gray-400" size={20} />
            </div>
            <input
              type="text"
              value={imei}
              onChange={(event) =>
                onImeiChange(event.target.value.replace(/\D/g, '').slice(0, 15))
              }
              placeholder="Enter 15-digit IMEI Number"
              className="w-full pl-12 pr-4 py-4 bg-gray-50 hover:bg-white focus:bg-white border border-transparent focus:border-[var(--store-primary)]/10 rounded-2xl focus:ring-4 focus:ring-[var(--store-primary)]/10 outline-none text-lg font-mono tracking-widest transition-all placeholder:font-sans placeholder:tracking-normal text-gray-900"
            />
          </div>
          <button
            aria-label={`Verify Now · ${currentTier.priceDisplay}`}
            disabled={isLoading || imei.length < 15}
            type="submit"
            className="bg-[var(--store-primary)] text-[var(--store-primary-text,#ffffff)] font-bold text-base px-8 py-4 rounded-2xl hover:bg-[var(--store-primary)]/90 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[var(--store-primary)]/20 active:scale-95 whitespace-nowrap"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                Verify Now · {currentTier.priceDisplay}
                <Sparkles size={18} />
              </>
            )}
          </button>
        </form>
      </div>
      {error && (
        <div className="mt-4 p-4 bg-[var(--store-danger-bg,#fef2f2)] border border-[var(--store-danger-border,#fecaca)] rounded-2xl flex items-center gap-3 text-left">
          <AlertTriangle
            className="text-[var(--store-danger-text,#dc2626)] shrink-0"
            size={20}
          />
          <p className="text-sm text-[var(--store-danger-text,#b91c1c)]">{error}</p>
        </div>
      )}
      <ImeiCheckerFindImei />
    </div>

    <div className="max-w-4xl mx-auto mt-16">
      <h2 className="text-center text-xl font-bold text-gray-900 mb-8">
        Why Smart Buyers Always Verify
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {IMEI_CHECKER_PROOF_ITEMS.map(({ body, icon: Icon, title }) => (
          <div
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
            key={title}
          >
            <div className="w-12 h-12 bg-[var(--store-primary)]/5 text-[var(--store-primary)] rounded-xl flex items-center justify-center mb-4">
              <Icon size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500">{body}</p>
          </div>
        ))}
      </div>
    </div>
  </>
);
