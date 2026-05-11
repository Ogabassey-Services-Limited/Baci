'use client';

import { Heart, Share2, Star } from 'lucide-react';
import type {
  ConditionType,
  NormalizedProductDetails,
} from '@/components/storefront/ogabassey/pages/product-details-page/product-details-helpers';
import { isConditionType } from '@/components/storefront/ogabassey/pages/product-details-page/product-details-helpers';

function asConditionType(
  value: string | null | undefined
): ConditionType | null {
  return isConditionType(value)
    ? value
    : null;
}

interface ProductSummaryPanelProps {
  availableConditions: ConditionType[];
  currentOfferPrice: string;
  isLiked: boolean;
  onShare: () => void;
  onToggleSaved: () => void;
  productData: NormalizedProductDetails;
  selectedCondition: ConditionType;
  setSelectedCondition: (condition: ConditionType) => void;
}

function formatConditionLabel(condition?: string | null) {
  if (!condition) {
    return 'New';
  }

  if (condition === 'used') {
    return 'Premium Used';
  }

  if (condition === 'open_box') {
    return 'Open Box';
  }

  return `${condition.charAt(0).toUpperCase()}${condition.slice(1)}`;
}

export function ProductSummaryPanel({
  availableConditions,
  currentOfferPrice,
  isLiked,
  onShare,
  onToggleSaved,
  productData,
  selectedCondition,
  setSelectedCondition,
}: ProductSummaryPanelProps) {
  const baseCondition = asConditionType(productData.condition) ?? 'new';
  const conditionOptions =
    availableConditions.length > 0 ? availableConditions : [baseCondition];

  return (
    <>
      <div className="mb-2 flex items-start justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-(--store-primary)">
          {productData.brand}
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onShare}
            className="text-[color-mix(in_srgb,var(--store-background-text,#111827)_45%,transparent)] transition-colors active:text-(--store-primary) md:hover:text-(--store-primary)"
            aria-label="Share this product"
          >
            <Share2 size={20} />
          </button>
          <button
            type="button"
            onClick={onToggleSaved}
            className={`transition-colors active:text-(--store-primary) ${
              isLiked
                ? 'text-(--store-primary)'
                : 'text-[color-mix(in_srgb,var(--store-background-text,#111827)_45%,transparent)] md:hover:text-(--store-primary)'
            }`}
            aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <h1 className="mb-4 text-3xl font-extrabold text-(--store-background-text,#111827) md:text-3xl">
        {productData.name}
      </h1>

      <div className="mb-6 flex items-center gap-4">
        <div
          className="flex items-center gap-0.5 text-(--store-rating,#facc15)"
          role="img"
          aria-label={`Rated ${productData.rating} out of 5 stars`}
        >
          {[...Array(5)].map((_, index) => {
            const filled = Math.floor(productData.rating);
            const fraction = productData.rating - filled;
            const isFull = index < filled;
            const isPartial = index === filled && fraction > 0;
            const isEmpty = !isFull && !isPartial;

            if (isPartial) {
              return (
                <span key={index} className="relative inline-flex" style={{ width: 18, height: 18 }} aria-hidden="true">
                  <span className="absolute inset-0 overflow-hidden" style={{ width: `${fraction * 100}%` }}>
                    <Star size={18} fill="currentColor" className="shrink-0" />
                  </span>
                  <Star size={18} fill="none" className="text-[color-mix(in_srgb,var(--store-background-text,#111827)_18%,transparent)]" />
                </span>
              );
            }

            return (
              <Star
                key={index}
                size={18}
                fill={isFull ? 'currentColor' : 'none'}
                className={isEmpty ? 'text-[color-mix(in_srgb,var(--store-background-text,#111827)_18%,transparent)]' : ''}
                aria-hidden="true"
              />
            );
          })}
        </div>
        <span className="text-sm font-medium text-[color-mix(in_srgb,var(--store-background-text,#111827)_60%,transparent)]">
          {productData.reviewCount} Reviews
        </span>
      </div>

      <div className="mb-6 text-3xl font-bold text-(--store-primary)">
        {currentOfferPrice}
      </div>

      {conditionOptions.length > 1 && (
        <div className="mb-6">
          <label className="mb-3 block text-sm font-bold text-(--store-background-text,#111827)">
            Condition:{' '}
            <span className="text-(--store-primary)">
              {formatConditionLabel(selectedCondition)}
            </span>
          </label>
          <div role="group" aria-label="Product condition" className="flex flex-wrap gap-3">
            {conditionOptions.map((condition) => (
              <button
                key={condition}
                type="button"
                onClick={() => setSelectedCondition(condition)}
                aria-pressed={selectedCondition === condition}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition-all ${
                  selectedCondition === condition
                    ? 'border-(--store-primary) bg-(--store-primary)/5 text-(--store-primary)'
                    : 'border-[color-mix(in_srgb,var(--store-background-text,#111827)_15%,transparent)] text-[color-mix(in_srgb,var(--store-background-text,#111827)_70%,transparent)] hover:border-[color-mix(in_srgb,var(--store-background-text,#111827)_30%,transparent)]'
                }`}
              >
                {formatConditionLabel(condition)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
