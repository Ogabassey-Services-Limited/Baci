import { ArrowRightLeft, Star, User } from 'lucide-react';
import { formatCanonicalProductConditionLabel } from '@baci/shared/lib';
import { SafeHtml } from '@/components/ui/safe-html';
import { ProductComparisonTable } from '../../components/ProductComparisonTable';
import type { NormalizedProductDetails } from './product-details-helpers';
import type { ProductDetailsActiveTab } from './use-product-details-state';

interface ProductDetailsTabsProps {
  activeTab: ProductDetailsActiveTab;
  normalizedReviewRatingWidth: string;
  onSelectTab: (tab: ProductDetailsActiveTab) => void;
  productData: NormalizedProductDetails;
  storeSlug: string;
}

export function ProductDetailsTabs({
  activeTab,
  normalizedReviewRatingWidth,
  onSelectTab,
  productData,
  storeSlug,
}: ProductDetailsTabsProps) {
  const conditionLabel =
    formatCanonicalProductConditionLabel(productData.condition) ??
    productData.condition;

  return (
    <div className="mt-8">
      <div
        className="hide-scrollbar mb-8 flex overflow-x-auto border-b border-gray-200"
        role="tablist"
      >
        {[
          ['description', 'Description'],
          ['specs', 'Specifications'],
          ['reviews', `Reviews (${productData.reviewCount})`],
          ['compare', 'Compare'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelectTab(value as ProductDetailsActiveTab)}
            className={`whitespace-nowrap px-6 pb-4 text-lg font-semibold transition-colors ${
              activeTab === value
                ? 'border-b-2 border-[var(--store-primary)] text-[var(--store-primary)]'
                : 'text-gray-500 md:hover:text-gray-800'
            } ${value === 'compare' ? 'flex items-center gap-2' : ''}`}
            role="tab"
            aria-selected={activeTab === value}
            aria-controls={`tab-${value}`}
            id={`tab-btn-${value}`}
          >
            {value === 'compare' && <ArrowRightLeft size={18} />}
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'description' && (
          <div
            role="tabpanel"
            id="tab-description"
            aria-labelledby="tab-btn-description"
            className="prose max-w-none animate-in fade-in text-gray-600 duration-300"
          >
            <SafeHtml
              html={productData.description || ''}
              headingLevelOffset={1}
              className="prose-headings:text-inherit prose-strong:text-inherit prose-table:text-sm mb-4"
            />
            <div className="mb-6 mt-6">
              <h2 className="mb-3 text-lg font-bold text-gray-900">
                Key Highlights
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-gray-600">
                {productData.specs.length > 0 ? (
                  productData.specs.slice(0, 5).map((spec) => (
                    <li key={`${spec.label}-${spec.value}`}>
                      <span className="font-medium text-gray-900">
                        {spec.label}:
                      </span>{' '}
                      {spec.value}
                    </li>
                  ))
                ) : (
                  <>
                    {productData.displaySize && <li>{productData.displaySize} Display</li>}
                    {productData.ram && <li>{productData.ram} RAM</li>}
                    {productData.storage[0] && <li>{productData.storage[0]} Storage</li>}
                    {conditionLabel && <li>Condition: {conditionLabel}</li>}
                    <li>{productData.brand} Official Warranty</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'specs' && (
          <div
            role="tabpanel"
            id="tab-specs"
            aria-labelledby="tab-btn-specs"
            className="grid animate-in grid-cols-1 gap-8 fade-in duration-300 md:grid-cols-2"
          >
            {productData.detailedSpecs.map((section) => (
              <div
                key={section.category}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-6"
              >
                <h3 className="mb-4 text-lg font-bold text-gray-900">
                  {section.category}
                </h3>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li
                      key={`${item.label}-${item.value}`}
                      className="flex flex-col gap-1 border-b border-gray-200 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <span className="w-32 shrink-0 text-sm font-medium text-gray-500">
                        {item.label}
                      </span>
                      <span className="text-left text-sm font-semibold text-gray-900 sm:text-right">
                        {item.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div
            role="tabpanel"
            id="tab-reviews"
            aria-labelledby="tab-btn-reviews"
            className="space-y-6 animate-in fade-in duration-300"
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                Customer Reviews
              </h3>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Coming soon"
                className="cursor-not-allowed text-sm font-bold text-[var(--store-primary)]/60"
              >
                Write a Review
              </button>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
                <div className="mb-2 text-5xl font-extrabold text-gray-900">
                  {Math.max(0, Math.min(productData.rating, 5))}
                </div>
                <div className="mb-2 flex justify-center">
                  <div className="relative inline-flex">
                    <div className="flex gap-1 text-gray-200">
                      {[...Array(5)].map((_, index) => (
                        <Star
                          key={`empty-${index}`}
                          size={20}
                          fill="currentColor"
                        />
                      ))}
                    </div>
                    <div
                      className="absolute inset-0 overflow-hidden text-[color:var(--store-rating,#facc15)]"
                      style={{ width: normalizedReviewRatingWidth }}
                    >
                      <div className="flex w-max gap-1">
                        {[...Array(5)].map((_, index) => (
                          <Star
                            key={`filled-${index}`}
                            size={20}
                            fill="currentColor"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Based on {productData.reviewCount} reviews
                </p>
              </div>

              <div className="col-span-2 rounded-2xl border border-dashed border-gray-200 bg-white p-6">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
                  Rating Breakdown
                </h4>
                <p className="mt-3 text-sm leading-6 text-gray-500">
                  Detailed per-star review distribution is not available in the
                  current product payload yet.
                </p>
                {/* TODO: Render per-star rating bars once backend review distribution is included here. */}
              </div>
            </div>

            {productData.reviewCount === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <User size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  No reviews yet. Be the first to review this product!
                </p>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-500">
                Reviews are loaded from the store&apos;s review system.
              </p>
            )}
          </div>
        )}

        {activeTab === 'compare' && (
          <div
            role="tabpanel"
            id="tab-compare"
            aria-labelledby="tab-btn-compare"
            className="animate-in fade-in duration-300"
          >
            <ProductComparisonTable
              mainProduct={productData}
              storeSlug={storeSlug}
            />
          </div>
        )}
      </div>
    </div>
  );
}
