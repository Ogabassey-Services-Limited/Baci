'use client';

import Link from 'next/link';
import type { RefObject } from 'react';
import { Plus, X } from 'lucide-react';
import { CdnFormatImage } from '@/components/storefront/cdn-format-image';
import { asRoute } from '@/lib/routes';
import type { Product } from '../types';
import { ComparisonSlotSearchOverlay } from './ComparisonSlotSearchOverlay';
import type { SearchResultProduct } from './comparison-search-types';

interface ComparisonSlotCellProps {
  slotIdx: number;
  product?: Product;
  isSearching: boolean;
  mainCategoryLabel?: string;
  getProductHref: (product: Product) => string;
  onRemoveProduct: (slotIdx: number) => void;
  onStartSearch: (slotIdx: number) => void;
  onCancelSearch: () => void;
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

export function ComparisonSlotCell({
  slotIdx,
  product,
  isSearching,
  mainCategoryLabel,
  getProductHref,
  onRemoveProduct,
  onStartSearch,
  onCancelSearch,
  query,
  setQuery,
  results,
  loading,
  searchError,
  onSelectProduct,
  searchInputRef,
  locale,
  currencyCode,
}: ComparisonSlotCellProps) {
  return (
    <div className="relative flex h-56 flex-col items-center justify-end border-r border-store-background-text/10 bg-store-background p-4 last:border-0">
      {product ? (
        <>
          <button
            type="button"
            onClick={() => onRemoveProduct(slotIdx)}
            className="absolute right-3 top-3 text-store-background-text/45 transition-colors hover:text-store-primary"
            aria-label="Remove product"
          >
            <X size={16} />
          </button>
          <div className="relative mb-3 size-24">
            <CdnFormatImage
              src={product.images?.[0] || product.image || '/placeholder.png'}
              alt={product.name}
              fill
              sizes="96px"
              className="object-contain mix-blend-multiply"
            />
          </div>
          <Link
            href={asRoute(getProductHref(product))}
            className="mb-1 line-clamp-2 text-center text-sm font-bold hover:text-store-primary"
          >
            {product.name}
          </Link>
          <p className="text-sm font-bold text-store-background-text">
            {product.price}
          </p>
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center">
          {isSearching ? (
            <ComparisonSlotSearchOverlay
              slotIdx={slotIdx}
              isSearching={isSearching}
              onCancel={onCancelSearch}
              query={query}
              setQuery={setQuery}
              results={results}
              loading={loading}
              searchError={searchError}
              onSelectProduct={onSelectProduct}
              searchInputRef={searchInputRef}
              locale={locale}
              currencyCode={currencyCode}
            />
          ) : (
            <button
              type="button"
              onClick={() => onStartSearch(slotIdx)}
              className="group flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-store-background-text/15 text-store-background-text/45 transition-all hover:border-store-primary/35 hover:bg-store-primary/5 hover:text-store-primary"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-store-background-text/5 group-hover:bg-store-background">
                <Plus size={20} />
              </div>
              <span className="px-2 text-center text-xs font-bold uppercase tracking-wider">
                Compare Similar {mainCategoryLabel || 'Products'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
