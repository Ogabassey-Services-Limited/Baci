'use client';

import type { Product as CartProduct } from '@/lib/products';
import {
  formatVariantAxisLabel,
  formatVariantOptionLabel,
  getAvailableCriticalVariantOptions,
  getVariantAxisOptions,
} from './critical-variant-selector-options';

interface OgabasseyPdpCriticalVariantSelectorsProps {
  explicitSelectedAxes?: string[];
  onAttributeSelection: (axis: string, value: string) => void;
  renderableVariantAxes: string[];
  selectedAttributes: Record<string, string>;
  variantAxisOptions?: Record<string, string[]>;
  variantCount: number;
  variants: CartProduct['variants'];
}

export function OgabasseyPdpCriticalVariantSelectors({
  explicitSelectedAxes = [],
  onAttributeSelection,
  renderableVariantAxes,
  selectedAttributes,
  variantAxisOptions = {},
  variantCount,
  variants,
}: OgabasseyPdpCriticalVariantSelectorsProps) {
  if (variantCount <= 1 || renderableVariantAxes.length === 0) {
    return null;
  }

  const explicitSelectedAttributes = Object.fromEntries(
    Object.entries(selectedAttributes).filter(([key]) =>
      explicitSelectedAxes.includes(key)
    )
  );

  return (
    <div data-ogabassey-pdp-commerce-variant-picker>
      {variantCount > 1 ? (
        <p data-ogabassey-pdp-commerce-selection-hint>
          Choose options below before checkout.
        </p>
      ) : null}
      {renderableVariantAxes.length > 0 ? (
        <div data-ogabassey-pdp-commerce-variant-selectors>
          {renderableVariantAxes.map((axis) => {
            const label = formatVariantAxisLabel(axis);
            const options = getVariantAxisOptions(
              variants,
              axis,
              variantAxisOptions
            );
            const availableOptions = new Set(
              getAvailableCriticalVariantOptions(
                axis,
                variants,
                explicitSelectedAttributes,
                variantAxisOptions
              )
            );
            const selectedOptionLabel = selectedAttributes[axis]
              ? formatVariantOptionLabel(axis, selectedAttributes[axis])
              : `Select ${label.toLowerCase()}`;

            return (
              <div data-ogabassey-pdp-commerce-variant-axis key={axis}>
                <p data-ogabassey-pdp-commerce-variant-label>
                  {label}:{' '}
                  <strong>{selectedOptionLabel}</strong>
                </p>
                <div data-ogabassey-pdp-commerce-variant-options>
                  {options.map((value) => {
                    const isSelected = selectedAttributes[axis] === value;
                    const isAvailable = availableOptions.has(value);
                    const optionLabel = formatVariantOptionLabel(axis, value);

                    return (
                      <button
                        aria-label={`Select ${optionLabel} ${label.toLowerCase()}`}
                        aria-pressed={isSelected}
                        data-ogabassey-pdp-commerce-variant-option
                        data-selected={isSelected ? 'true' : undefined}
                        disabled={!isAvailable}
                        key={value}
                        onClick={() => onAttributeSelection(axis, value)}
                        type="button"
                      >
                        {optionLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
