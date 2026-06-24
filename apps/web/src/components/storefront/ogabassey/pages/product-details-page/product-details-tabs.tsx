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
    <div className="ogabassey-pdp-tabs">
      <div className="ogabassey-pdp-tabs__tablist" role="tablist">
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
            className="ogabassey-pdp-tabs__tab"
            data-active={activeTab === value ? 'true' : undefined}
            data-with-icon={value === 'compare' ? 'true' : undefined}
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

      <div className="ogabassey-pdp-tabs__panel-frame">
        {activeTab === 'description' && (
          <div
            role="tabpanel"
            id="tab-description"
            aria-labelledby="tab-btn-description"
            className="ogabassey-pdp-tabs__panel"
          >
            <SafeHtml
              html={productData.description || ''}
              headingLevelOffset={1}
              className="ogabassey-pdp-tabs__rich-text prose prose-headings:text-inherit prose-strong:text-inherit prose-table:text-sm"
            />
            <div className="ogabassey-pdp-tabs__summary-card">
              <h2 className="ogabassey-pdp-tabs__summary-title">
                Key Highlights
              </h2>
              <ul className="ogabassey-pdp-tabs__summary-list">
                {productData.specs.length > 0 ? (
                  productData.specs.slice(0, 5).map((spec) => (
                    <li key={`${spec.label}-${spec.value}`}>
                      <span className="ogabassey-pdp-tabs__summary-label">
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
            className="ogabassey-pdp-tabs__spec-grid"
          >
            {productData.detailedSpecs.map((section) => (
              <div
                key={section.category}
                className="ogabassey-pdp-tabs__panel ogabassey-pdp-tabs__spec-card"
              >
                <h3 className="ogabassey-pdp-tabs__spec-title">
                  {section.category}
                </h3>
                <ul className="ogabassey-pdp-tabs__spec-list">
                  {section.items.map((item) => (
                    <li
                      key={`${item.label}-${item.value}`}
                      className="ogabassey-pdp-tabs__spec-row"
                    >
                      <span className="ogabassey-pdp-tabs__spec-label">
                        {item.label}
                      </span>
                      <span className="ogabassey-pdp-tabs__spec-value">
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
            className="ogabassey-pdp-tabs__panel"
          >
            <div className="ogabassey-pdp-tabs__panel-header">
              <h3 className="ogabassey-pdp-tabs__panel-title">
                Customer Reviews
              </h3>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Coming soon"
                className="ogabassey-pdp-tabs__disabled-action"
              >
                Write a Review
              </button>
            </div>

            <div className="ogabassey-pdp-tabs__review-grid">
              <div className="ogabassey-pdp-tabs__review-score">
                <div className="ogabassey-pdp-tabs__review-number">
                  {Math.max(0, Math.min(productData.rating, 5))}
                </div>
                <div className="ogabassey-pdp-tabs__review-stars">
                  <div className="ogabassey-pdp-tabs__review-star-stack">
                    <div className="ogabassey-pdp-tabs__review-stars-empty">
                      {[...Array(5)].map((_, index) => (
                        <Star
                          key={`empty-${index}`}
                          size={20}
                          fill="currentColor"
                        />
                      ))}
                    </div>
                    <div
                      className="ogabassey-pdp-tabs__review-stars-filled"
                      style={{ width: normalizedReviewRatingWidth }}
                    >
                      <div className="ogabassey-pdp-tabs__review-stars-row">
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
                <p className="ogabassey-pdp-tabs__review-copy">
                  Based on {productData.reviewCount} reviews
                </p>
              </div>

              <div className="ogabassey-pdp-tabs__review-breakdown">
                <h4 className="ogabassey-pdp-tabs__review-breakdown-title">
                  Rating Breakdown
                </h4>
                <p className="ogabassey-pdp-tabs__review-breakdown-copy">
                  Detailed per-star review distribution is not available in the
                  current product payload yet.
                </p>
                {/* TODO: Render per-star rating bars once backend review distribution is included here. */}
              </div>
            </div>

            {productData.reviewCount === 0 ? (
              <div className="ogabassey-pdp-tabs__empty-reviews">
                <User size={32} />
                <p>
                  No reviews yet. Be the first to review this product!
                </p>
              </div>
            ) : (
              <p className="ogabassey-pdp-tabs__review-system-copy">
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
            className="ogabassey-pdp-tabs__panel"
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
