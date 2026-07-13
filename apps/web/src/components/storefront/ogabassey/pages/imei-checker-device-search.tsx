'use client';

import { Check, Loader2, Smartphone } from 'lucide-react';
import { CdnFormatImage } from '@/components/storefront/cdn-format-image';
import type { ProductSuggestion } from './imei-checker-types';

interface ImeiCheckerDeviceSearchProps {
  deviceQuery: string;
  onDeviceQueryChange: (value: string) => void;
  onDeviceSearchFocus: () => void;
  onSelectDevice: (device: ProductSuggestion) => void;
  searchLoading: boolean;
  selectedDevice: ProductSuggestion | null;
  showSuggestions: boolean;
  suggestions: ProductSuggestion[];
}

/**
 * Device-name autocomplete. Cosmetic/reassurance only — the selected device
 * is never sent with the IMEI-check request; it just confirms "yes, this is
 * what you're checking" to the customer.
 */
export function ImeiCheckerDeviceSearch({
  deviceQuery,
  onDeviceQueryChange,
  onDeviceSearchFocus,
  onSelectDevice,
  searchLoading,
  selectedDevice,
  showSuggestions,
  suggestions,
}: ImeiCheckerDeviceSearchProps) {
  return (
    <div className="mx-auto mb-8 max-w-xl">
      <p className="mb-3 text-center text-sm font-medium text-gray-500">
        What device are you checking?
      </p>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Smartphone className="text-gray-400" size={20} />
        </div>
        <input
          aria-label="Search for a device name"
          className="w-full rounded-2xl border border-gray-200 py-4 pl-12 pr-4 text-base outline-none transition-all focus:border-[var(--store-primary)]/20 focus:ring-4 focus:ring-[var(--store-primary)]/10"
          onChange={(event) => onDeviceQueryChange(event.target.value)}
          onFocus={onDeviceSearchFocus}
          placeholder="Type device name (e.g., iPhone 16, Samsung S24...)"
          type="text"
          value={deviceQuery}
        />
        {searchLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
            <Loader2 className="animate-spin text-gray-400" size={18} />
          </div>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
            {suggestions.map((product) => (
              <button
                className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left last:border-0 hover:bg-gray-50"
                key={product.id}
                onClick={() => onSelectDevice(product)}
                type="button"
              >
                {product.image && (
                  <CdnFormatImage
                    alt={product.name}
                    className="rounded-lg object-cover"
                    height={40}
                    sizes="40px"
                    src={product.image}
                    width={40}
                  />
                )}
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  {product.category && (
                    <p className="text-xs text-gray-500">
                      {product.category}
                    </p>
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
  );
}
