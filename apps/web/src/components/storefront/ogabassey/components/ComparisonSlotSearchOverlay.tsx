'use client';

import type { RefObject } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { CdnFormatImage } from '@/components/storefront/cdn-format-image';
import type { SearchResultProduct } from './comparison-search-types';

const _priceFormatterCache = new Map<string, Intl.NumberFormat>();

function getPriceFormatter(
  locale: string,
  currency: string
): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = _priceFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    });
    _priceFormatterCache.set(key, formatter);
  }
  return formatter;
}

interface ComparisonSlotSearchOverlayProps {
  slotIdx: number;
  isSearching: boolean;
  onCancel: () => void;
  query: string;
  setQuery: (query: string) => void;
  results: SearchResultProduct[];
  loading: boolean;
  searchError?: string | null;
  onSelectProduct: (product: SearchResultProduct) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  locale?: string;
  currencyCode?: string;
}

export function ComparisonSlotSearchOverlay({
  slotIdx,
  isSearching,
  onCancel,
  query,
  setQuery,
  results,
  loading,
  searchError,
  onSelectProduct,
  searchInputRef,
  locale = 'en-NG',
  currencyCode = 'NGN',
}: ComparisonSlotSearchOverlayProps) {
  if (!isSearching) {
    return null;
  }

  const priceFormatter = getPriceFormatter(locale, currencyCode);

  return (
    <div className="absolute inset-0 z-10 flex h-full w-full flex-col bg-store-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-store-background-text/55">
          Add Product
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label={`Cancel search in comparison slot ${slotIdx + 1}`}
          className="text-store-background-text/55 transition-colors hover:text-store-primary"
        >
          <X size={16} />
        </button>
      </div>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-3 text-store-background-text/45"
        />
        <input
          ref={searchInputRef}
          type="text"
          aria-label="Search products"
          placeholder="Type to search..."
          className="w-full rounded-lg border border-store-background-text/15 py-2 pl-9 pr-3 text-sm focus:border-store-primary focus:outline-hidden focus:ring-2 focus:ring-store-primary/20"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="-mx-2 mt-2 flex-1 overflow-y-auto">
        {loading && (
          <output
            className="flex justify-center p-4 text-store-background-text/45"
            aria-label="Loading products"
          >
            <Loader2 className="animate-spin" size={20} />
          </output>
        )}

        {!loading && searchError && (
          <div
            className="p-4 text-center text-xs text-store-primary"
            role="alert"
          >
            {searchError}
          </div>
        )}

        {!loading && !searchError && results.length > 0 && (
          <div className="space-y-1">
            {results.map((result) => (
              <button
                type="button"
                key={result.id}
                onClick={() => onSelectProduct(result)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-store-background-text/5"
              >
                <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-store-background-text/5">
                  <CdnFormatImage
                    src={result.image || result.imageLarge || '/placeholder.png'}
                    alt={result.name}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-store-background-text">
                    {result.name}
                  </div>
                  <div className="text-[10px] text-store-primary">
                    {priceFormatter.format(result.price)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && !searchError && query && results.length === 0 && (
          <div className="p-4 text-center text-xs text-store-background-text/45">
            No products found
          </div>
        )}
      </div>
    </div>
  );
}
