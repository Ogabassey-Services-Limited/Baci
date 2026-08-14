import { getAvailableOptionsForAxis } from '@/components/storefront/ogabassey/variant-attributes';
import {
  getVariantBackedSelections,
  hasVariantBackedAxis,
} from './cart-helpers';
import type { NormalizedProductDetails } from './product-details-helpers';

interface ProductOptionAxisGroupProps {
  axis: string;
  formatAxisLabel: (axis: string) => string;
  getAxisOptions: (axis: string) => string[];
  onSelectAttribute: (axis: string, value: string) => void;
  productData: NormalizedProductDetails;
  selectedAttributes: Record<string, string>;
}

export function ProductOptionAxisGroup({
  axis,
  formatAxisLabel,
  getAxisOptions,
  onSelectAttribute,
  productData,
  selectedAttributes,
}: ProductOptionAxisGroupProps) {
  const options = getAxisOptions(axis);
  if (options.length === 0) {
    return null;
  }

  const label = formatAxisLabel(axis);
  const isSingleOption = options.length === 1;

  const hasVariants =
    Array.isArray(productData.variants) && productData.variants.length > 0;
  const shouldFilterByVariantAvailability =
    hasVariants && hasVariantBackedAxis(axis, productData.variants);
  const availableForAxis = shouldFilterByVariantAvailability
    ? getAvailableOptionsForAxis(
        axis,
        productData.variants,
        getVariantBackedSelections(selectedAttributes, productData.variants)
      )
    : null;

  return (
    <div className="mb-8 space-y-6">
      <div>
        <label className="flex items-center justify-between text-sm font-bold text-gray-900">
          {isSingleOption ? (
            <span>{label}</span>
          ) : (
            <span>
              {label}:{' '}
              <span className="text-store-primary">
                {selectedAttributes[axis] || `Select ${label.toLowerCase()}`}
              </span>
            </span>
          )}
          {!isSingleOption && !selectedAttributes[axis] && (
            <span className="animate-pulse text-xs font-normal text-store-primary">
              * Required
            </span>
          )}
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          {options.map((value) => {
            const isAvailable =
              availableForAxis === null || availableForAxis.includes(value);
            const isSelected = selectedAttributes[axis] === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => isAvailable && onSelectAttribute(axis, value)}
                disabled={!isAvailable}
                className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                  !isAvailable
                    ? 'cursor-not-allowed border-gray-100 text-gray-300 line-through'
                    : isSelected
                      ? 'border-store-primary bg-store-primary/5 text-store-primary ring-2 ring-store-primary/20 active:scale-95'
                      : 'border-gray-200 text-gray-700 active:scale-95 md:hover:border-gray-400 md:hover:bg-gray-50'
                }`}
                aria-label={`Select ${value} ${label.toLowerCase()}${!isAvailable ? ' (unavailable)' : ''}`}
                aria-pressed={isSelected}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
