import { Heart, Share2, Star } from 'lucide-react';
import type { ConditionType, NormalizedProductDetails } from './product-details-helpers';

interface ProductSummaryPanelProps {
  currentOfferPrice: string;
  isLiked: boolean;
  onShare: () => void;
  onToggleSaved: () => void;
  productData: NormalizedProductDetails;
  selectedCondition: ConditionType;
  setSelectedCondition: (condition: ConditionType) => void;
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
  return (
    <>
      <div className="mb-2 flex items-start justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-red-600">
          {productData.brand}
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onShare}
            className="text-gray-400 transition-colors active:text-red-600 md:hover:text-red-600"
            aria-label="Share this product"
          >
            <Share2 size={20} />
          </button>
          <button
            type="button"
            onClick={onToggleSaved}
            className={`transition-colors active:text-red-600 ${
              isLiked
                ? 'text-red-600'
                : 'text-gray-400 md:hover:text-red-600'
            }`}
            aria-label={
              isLiked ? 'Remove from wishlist' : 'Add to wishlist'
            }
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <h1 className="mb-4 text-3xl font-extrabold text-gray-900 md:text-3xl">
        {productData.name}
      </h1>

      <div className="mb-6 flex items-center gap-4">
        <div
          className="flex items-center gap-0.5 text-yellow-400"
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
                index >= Math.floor(productData.rating) ? 'text-gray-300' : ''
              }
              aria-hidden="true"
            />
          ))}
        </div>
        <span className="text-sm font-medium text-gray-500">
          {productData.reviewCount} Reviews
        </span>
      </div>

      <div className="mb-6 text-3xl font-bold text-red-600">
        {currentOfferPrice}
      </div>

      {(productData.has_condition_offers ||
        (productData.offers && productData.offers.length > 0)) && (
        <div className="mb-6">
          <label className="mb-3 block text-sm font-bold text-gray-900">
            Condition:{' '}
            <span className="text-red-600">
              {selectedCondition === 'used'
                ? 'Premium Used'
                : selectedCondition === 'open_box'
                  ? 'Open Box'
                  : `${selectedCondition.charAt(0).toUpperCase()}${selectedCondition.slice(1)}`}
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setSelectedCondition(
                  (productData.condition?.toLowerCase() || 'new') as ConditionType
                )
              }
              className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition-all ${
                selectedCondition ===
                (productData.condition?.toLowerCase() || 'new')
                  ? 'border-red-600 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {productData.condition === 'used'
                ? 'Premium Used'
                : productData.condition === 'open_box'
                  ? 'Open Box'
                  : productData.condition === 'new'
                    ? 'New'
                    : productData.condition?.charAt(0).toUpperCase() +
                        productData.condition?.slice(1) || 'New'}
            </button>

            {productData.offers?.map((offer) => {
              const label =
                offer.condition === 'used'
                  ? 'Premium Used'
                  : offer.condition === 'open_box'
                    ? 'Open Box'
                    : `${offer.condition.charAt(0).toUpperCase()}${offer.condition.slice(1)}`;

              return (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setSelectedCondition(offer.condition)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition-all ${
                    selectedCondition === offer.condition
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
