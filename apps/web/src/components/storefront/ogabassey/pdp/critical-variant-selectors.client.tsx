'use client';

import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import type { Product as CartProduct } from '@/lib/products';
import {
  canonicalizeVariantAxis,
  getAvailableOptionsForAxis,
} from '@/components/storefront/ogabassey/variant-attributes';

// Color is represented by product imagery, and color_hex is only swatch metadata.
const NON_RENDERABLE_CRITICAL_VARIANT_AXES = new Set([
  'color',
  'color_hex',
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
    condition: 'Condition',
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
  const options = new Set<string>();

  for (const variant of variants || []) {
    const normalizedAttributes: Record<string, string> = {};

    for (const [key, value] of Object.entries(variant.attributes || {})) {
      const attributeAxis = canonicalizeVariantAxis(key);
      const trimmedValue = value.trim();

      if (attributeAxis && trimmedValue) {
        normalizedAttributes[attributeAxis] = trimmedValue;
      }
    }

    const value =
      normalizedAxis === 'condition'
        ? normalizeCanonicalProductCondition(variant.condition)
        : normalizedAttributes[normalizedAxis];

    if (value) {
      options.add(value);
    }
  }

  return Array.from(options);
}

function isRenderableCriticalVariantAxis(
  axis: string,
  variants: CartProduct['variants']
) {
  if (!axis || NON_RENDERABLE_CRITICAL_VARIANT_AXES.has(axis)) {
    return false;
  }

  const options = getVariantAxisOptions(variants, axis);

  if (axis === 'condition') {
    return options.length > 1;
  }

  return options.length > 0;
}

export function getRenderableCriticalVariantAxes(
  axes: string[],
  variants: CartProduct['variants']
) {
  return Array.from(new Set(axes.map(canonicalizeVariantAxis))).filter(
    (axis) => isRenderableCriticalVariantAxis(axis, variants)
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
            const options = getVariantAxisOptions(variants, axis);
            const availableOptions = new Set(
              getAvailableOptionsForAxis(
                axis,
                variants,
                explicitSelectedAttributes
              )
            );

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
                    const isAvailable = availableOptions.has(value);

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
