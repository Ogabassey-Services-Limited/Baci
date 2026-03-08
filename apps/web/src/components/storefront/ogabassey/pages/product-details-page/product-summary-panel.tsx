'use client';

import { Heart, Share2, Star } from 'lucide-react';
import type {
  ConditionType,
  NormalizedProductDetails,
} from './product-details-helpers';

interface ProductSummaryPanelProps {
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
  currentOfferPrice,
  isLiked,
  onShare,
  onToggleSaved,
  productData,
  selectedCondition,
  setSelectedCondition,
}: ProductSummaryPanelProps) {
  const baseCondition = productData.condition || 'new';

  return (
    <>
      <div className="mb-2 flex items-start justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--store-primary)]">
          {productData.brand}
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onShare}
            className="text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_45%,transparent)] transition-colors active:text-[var(--store-primary)] md:hover:text-[var(--store-primary)]"
            aria-label="Share this product"
          >
            <Share2 size={20} />
          </button>
          <button
            type="button"
            onClick={onToggleSaved}
            className={`transition-colors active:text-[var(--store-primary)] ${
              isLiked
                ? 'text-[var(--store-primary)]'
                : 'text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_45%,transparent)] md:hover:text-[var(--store-primary)]'
            }`}
            aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <h1 className="mb-4 text-3xl font-extrabold text-[var(--store-background-text,#111827)] md:text-3xl">
        {productData.name}
      </h1>

      <div className="mb-6 flex items-center gap-4">
        <div
          className="flex items-center gap-0.5 text-[color:var(--store-rating,#facc15)]"
          role="img"
          aria-label={`Rated ${productData.rating} out of 5 stars`}
        >
          {[...Array(5)].map((_, index) => (
            <Star
              key={index}
              size={18}
              fill={
                index < Math.floor(productData.rating) ? 'currentColor' : 'none'
              }
              className={
                index >= Math.floor(productData.rating)
                  ? 'text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_18%,transparent)]'
                  : ''
              }
              aria-hidden="true"
            />
          ))}
        </div>
        <span className="text-sm font-medium text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_60%,transparent)]">
          {productData.reviewCount} Reviews
        </span>
      </div>

      <div className="mb-6 text-3xl font-bold text-[var(--store-primary)]">
        {currentOfferPrice}
      </div>

      {(productData.has_condition_offers ||
        (productData.offers && productData.offers.length > 0)) && (
        <div className="mb-6">
          <label className="mb-3 block text-sm font-bold text-[var(--store-background-text,#111827)]">
            Condition:{' '}
            <span className="text-[var(--store-primary)]">
              {formatConditionLabel(selectedCondition)}
            </span>
          </label>
          <div role="group" aria-label="Product condition" className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedCondition(baseCondition)}
              aria-pressed={selectedCondition === baseCondition}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition-all ${
                selectedCondition === baseCondition
                  ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5 text-[var(--store-primary)]'
                  : 'border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_15%,transparent)] text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_70%,transparent)] hover:border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_30%,transparent)]'
              }`}
            >
              {formatConditionLabel(baseCondition)}
            </button>

            {productData.offers?.map((offer) => (
              <button
                key={offer.id}
                type="button"
                onClick={() => setSelectedCondition(offer.condition)}
                aria-pressed={selectedCondition === offer.condition}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition-all ${
                  selectedCondition === offer.condition
                    ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5 text-[var(--store-primary)]'
                    : 'border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_15%,transparent)] text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_70%,transparent)] hover:border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_30%,transparent)]'
                }`}
              >
                {formatConditionLabel(offer.condition)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
