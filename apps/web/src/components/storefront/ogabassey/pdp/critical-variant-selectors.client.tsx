'use client';

import type { Product as CartProduct } from '@/lib/products';
import {
  canonicalizeVariantAxis,
  getAvailableOptionsForAxis,
} from '@/components/storefront/ogabassey/variant-attributes';

// Color is represented by product imagery, color_hex is only swatch metadata,
// and condition is handled by product/SKU pricing instead of visible buttons.
const NON_RENDERABLE_CRITICAL_VARIANT_AXES = new Set([
  'color',
  'color_hex',
  'condition',
]);

interface OgabasseyPdpCriticalVariantSelectorsProps {
  explicitSelectedAxes?: string[];
  onAttributeSelection: (axis: string, value: string) => void;
  renderableVariantAxes: string[];
  selectedAttributes: Record<string, string>;
  variantCount: number;
  variants: CartProduct['variants'];
}

function formatVariantAxisLabel(axis: string) {
  const labels: Record<string, string> = {
    color: 'Color',
    connectivity: 'Connectivity',
    gpu: 'GPU',
    platform: 'Platform',
    processor: 'Processor',
    ram: 'RAM',
    sim_type: 'SIM Type',
    storage: 'Storage',
  };

  return (
    labels[axis] ||
    `${axis.charAt(0).toUpperCase()}${axis.slice(1).replace(/_/g, ' ')}`
  );
}

function getVariantAxisOptions(
  variants: CartProduct['variants'],
  axis: string
) {
  const normalizedAxis = canonicalizeVariantAxis(axis);

  return Array.from(
    new Set(
      (variants || [])
        .map((variant) => {
          const normalizedAttributes = Object.fromEntries(
            Object.entries(variant.attributes || {}).map(([key, value]) => [
              canonicalizeVariantAxis(key),
              value,
            ])
          );

          return normalizedAttributes[normalizedAxis];
        })
        .filter((value): value is string => Boolean(value))
    )
  );
}

export function getRenderableCriticalVariantAxes(
  axes: string[],
  variants: CartProduct['variants']
) {
  return Array.from(new Set(axes.map(canonicalizeVariantAxis))).filter(
    (axis) =>
      axis &&
      !NON_RENDERABLE_CRITICAL_VARIANT_AXES.has(axis) &&
      getVariantAxisOptions(variants, axis).length > 0
  );
}

export function OgabasseyPdpCriticalVariantSelectors({
  explicitSelectedAxes = [],
  onAttributeSelection,
  renderableVariantAxes,
  selectedAttributes,
  variantCount,
  variants,
}: OgabasseyPdpCriticalVariantSelectorsProps) {
  if (variantCount <= 1 || renderableVariantAxes.length === 0) {
    return null;
  }

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
            const options = getVariantAxisOptions(variants, axis);

            return (
              <div data-ogabassey-pdp-commerce-variant-axis key={axis}>
                <p data-ogabassey-pdp-commerce-variant-label>
                  {label}:{' '}
                  <strong>
                    {selectedAttributes[axis] ||
                      `Select ${label.toLowerCase()}`}
                  </strong>
                </p>
                <div data-ogabassey-pdp-commerce-variant-options>
                  {options.map((value) => {
                    const isSelected = selectedAttributes[axis] === value;
                    const isAvailable = getAvailableOptionsForAxis(
                      axis,
                      variants,
                      Object.fromEntries(
                        Object.entries(selectedAttributes).filter(([key]) =>
                          explicitSelectedAxes.includes(key)
                        )
                      )
                    ).includes(value);

                    return (
                      <button
                        aria-label={`Select ${value} ${label.toLowerCase()}`}
                        aria-pressed={isSelected}
                        data-ogabassey-pdp-commerce-variant-option
                        data-selected={isSelected ? 'true' : undefined}
                        disabled={!isAvailable}
                        key={value}
                        onClick={() => onAttributeSelection(axis, value)}
                        type="button"
                      >
                        {value}
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
