import {
  canonicalizeVariantAxis,
  formatVariantAxisLabel,
  getRenderableVariantAxes,
  mergeVariantAxisOptions,
} from '@baci/shared';
import type { Product, ProductVariant } from '@/types/product';

export type SelectedProductAttributes = Record<string, string>;

function normalizeAttributeValue(value: string) {
  return value.trim();
}

function normalizeComparableAttributeValue(value: string) {
  return normalizeAttributeValue(value).toLowerCase();
}

function normalizeVariantAttributes(
  attributes: Record<string, string> | null | undefined
) {
  const normalized: Record<string, string> = {};

  for (const [rawAxis, rawValue] of Object.entries(attributes || {})) {
    if (typeof rawValue !== 'string') {
      continue;
    }

    const axis = canonicalizeVariantAxis(rawAxis);
    const value = normalizeAttributeValue(rawValue);

    if (!axis || !value) {
      continue;
    }

    normalized[axis] = value;
  }

  return normalized;
}

export function normalizeSelectedProductAttributes(
  attributes: SelectedProductAttributes | null | undefined
) {
  return normalizeVariantAttributes(attributes);
}

/**
 * Serializes normalized product attributes into a stable encoded key.
 *
 * @param attributes - The selected product attributes from UI state.
 * @returns A deterministic encoded string suitable for cart identity.
 */
export function serializeSelectedProductAttributes(
  attributes: SelectedProductAttributes | null | undefined
) {
  const normalized = normalizeSelectedProductAttributes(attributes);

  return Object.entries(normalized)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([axis, value]) =>
        `${encodeURIComponent(axis)}=${encodeURIComponent(
          normalizeComparableAttributeValue(value)
        )}`
    )
    .join('::');
}

/**
 * Returns merged option values for every variant axis on the product.
 *
 * @param product - The product whose variant axes should be merged.
 * @returns A record of canonical axes to available option values.
 */
export function getProductVariantAxisOptions(product: Product) {
  return mergeVariantAxisOptions(
    product.variants,
    product.variant_attributes || undefined
  );
}

/**
 * Returns the ordered variant axes that should be rendered in the UI.
 *
 * @param product - The product whose renderable axes should be computed.
 * @returns The list of canonical axes suitable for selector rendering.
 */
export function getProductRenderableVariantAxes(product: Product) {
  return getRenderableVariantAxes(
    product.variants,
    product.variant_attributes || undefined
  );
}

export function getProductColorOptions(product: Product) {
  const colorOptions = new Set<string>();

  if (Array.isArray(product.colors)) {
    for (const color of product.colors) {
      if (typeof color === 'string' && color.trim()) {
        colorOptions.add(color.trim());
      } else if (
        color &&
        typeof color === 'object' &&
        typeof color.name === 'string' &&
        color.name.trim()
      ) {
        colorOptions.add(color.name.trim());
      }
    }
  }

  for (const colorName of Object.keys(product.color_images || {})) {
    if (colorName.trim()) {
      colorOptions.add(colorName.trim());
    }
  }

  for (const colorName of getProductVariantAxisOptions(product).color || []) {
    if (colorName.trim()) {
      colorOptions.add(colorName.trim());
    }
  }

  return Array.from(colorOptions).sort((left, right) =>
    left.localeCompare(right)
  );
}

/**
 * Returns the single matching variant for the provided attributes.
 * Returns `null` when there is no match or when multiple variants still match.
 */
export function findMatchingProductVariant(
  variants: ProductVariant[] | null | undefined,
  selectedAttributes: SelectedProductAttributes | null | undefined
): ProductVariant | null {
  const normalizedAttributes =
    normalizeSelectedProductAttributes(selectedAttributes);
  const selectedEntries = Object.entries(normalizedAttributes);

  if (!variants || variants.length === 0 || selectedEntries.length === 0) {
    return null;
  }

  const matches = variants.filter((variant) => {
    const variantAttributes = normalizeVariantAttributes(variant.attributes);

    return selectedEntries.every(
      ([axis, value]) =>
        normalizeComparableAttributeValue(variantAttributes[axis] || '') ===
        normalizeComparableAttributeValue(value)
    );
  });

  return matches.length === 1 ? matches[0] : null;
}

export function getMissingProductSelections(
  product: Product,
  selectedAttributes: SelectedProductAttributes | null | undefined,
  selectedVariantId: string | null
) {
  const missingSelections: string[] = [];
  const normalizedAttributes =
    normalizeSelectedProductAttributes(selectedAttributes);
  const colorAxis = canonicalizeVariantAxis('color');
  const colorOptions = getProductColorOptions(product);
  const renderableAxes = getProductRenderableVariantAxes(product);

  if (colorOptions.length > 1 && !normalizedAttributes[colorAxis]) {
    missingSelections.push(formatVariantAxisLabel('color'));
  }

  for (const axis of renderableAxes) {
    if (!normalizedAttributes[axis]) {
      missingSelections.push(formatVariantAxisLabel(axis));
    }
  }

  const hasLegacyVariants = Boolean(
    product.variants?.some(
      (variant) =>
        Object.keys(normalizeVariantAttributes(variant.attributes)).length === 0
    )
  );

  if (
    hasLegacyVariants &&
    renderableAxes.length === 0 &&
    colorOptions.length === 0 &&
    !selectedVariantId
  ) {
    missingSelections.push(formatVariantAxisLabel('option'));
  }

  return missingSelections;
}

export function getDisplayVariantAttributes(
  attributes: SelectedProductAttributes | null | undefined,
  options?: {
    exclude?: string[];
  }
): [string, string][] {
  const excludedAxes = new Set(
    (options?.exclude || [])
      .map((axis) => canonicalizeVariantAxis(axis))
      .filter((axis): axis is string => typeof axis === 'string' && axis.length > 0)
  );

  return Object.entries(normalizeSelectedProductAttributes(attributes))
    .filter(([axis]) => !excludedAxes.has(axis))
    .sort(([leftAxis], [rightAxis]) => leftAxis.localeCompare(rightAxis));
}
