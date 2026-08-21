import {
  formatCanonicalProductConditionLabel,
  normalizeCanonicalProductCondition,
} from '@baci/shared/lib';
import type { Product as CartProduct } from '@/lib/products';
import { isDisplayOnlyVariantAxis, isRenderableVariantAxis } from '@/lib/storefront-specs/non-renderable-variant-axes';
import {
  canonicalizeVariantAxis,
  getAvailableOptionsForAxis,
} from '@/components/storefront/ogabassey/variant-attributes';

export function formatVariantAxisLabel(axis: string) {
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

export function formatVariantOptionLabel(axis: string, value: string) {
  if (axis === 'condition') {
    return formatCanonicalProductConditionLabel(value) || value;
  }

  return value;
}

export function getVariantAxisOptions(
  variants: CartProduct['variants'],
  axis: string,
  fallbackAxisOptions: Record<string, string[]> = {}
) {
  const normalizedAxis = canonicalizeVariantAxis(axis);
  const options = new Set<string>();

  for (const variant of variants || []) {
    const normalizedAttributes: Record<string, string> = {};

    for (const [key, value] of Object.entries(variant.attributes || {})) {
      const attributeAxis = canonicalizeVariantAxis(key);
      const trimmedValue = typeof value === 'string' ? value.trim() : '';

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

  if (options.size > 0) {
    return Array.from(options);
  }

  const fallbackOptions = fallbackAxisOptions[normalizedAxis] ?? [];
  if (fallbackOptions.length !== 1) {
    return [];
  }

  for (const fallbackValue of fallbackOptions) {
    const normalizedValue =
      normalizedAxis === 'condition'
        ? normalizeCanonicalProductCondition(fallbackValue)
        : fallbackValue.trim();

    if (normalizedValue) {
      options.add(normalizedValue);
    }
  }

  return Array.from(options);
}

function isRenderableCriticalVariantAxis(
  axis: string,
  variants: CartProduct['variants'],
  fallbackAxisOptions: Record<string, string[]> = {}
) {
  const options = getVariantAxisOptions(variants, axis, fallbackAxisOptions);
  return isRenderableVariantAxis(axis, options.length);
}

export function getRenderableCriticalVariantAxes(
  axes: string[],
  variants: CartProduct['variants'],
  fallbackAxisOptions: Record<string, string[]> = {}
) {
  return Array.from(new Set(axes.map(canonicalizeVariantAxis))).filter((axis) =>
    isRenderableCriticalVariantAxis(axis, variants, fallbackAxisOptions)
  );
}

export function getAvailableCriticalVariantOptions(
  axis: string,
  variants: CartProduct['variants'],
  explicitSelectedAttributes: Record<string, string>,
  fallbackAxisOptions: Record<string, string[]> = {}
) {
  const constraintSelections = Object.fromEntries(
    Object.entries(explicitSelectedAttributes).filter(([entryAxis]) => {
      const normalizedAxis = canonicalizeVariantAxis(entryAxis);
      return !isDisplayOnlyVariantAxis(normalizedAxis);
    })
  );
  const options = getAvailableOptionsForAxis(
    axis,
    variants,
    constraintSelections
  );

  if (options.length > 0) {
    return options;
  }

  const variantBackedOptions = getVariantAxisOptions(variants, axis);
  if (variantBackedOptions.length > 0) {
    return [];
  }

  return getVariantAxisOptions(variants, axis, fallbackAxisOptions);
}
