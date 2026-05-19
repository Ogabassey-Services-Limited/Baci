import { normalizeCanonicalProductCondition } from './product-condition';

export interface ProductSelectionRequiredInput {
  available_conditions?: readonly unknown[] | null;
  has_condition_offers?: boolean | null;
  has_variants?: boolean | null;
  variant_model?: string | null;
  variants?: readonly unknown[] | null;
}

export interface ProductSelectionRequiredOptions {
  metadataTrust?: 'trusted-product-row' | 'legacy-saved-record';
}

function hasSelectionMetadata(product: ProductSelectionRequiredInput) {
  return (
    typeof product.has_variants === 'boolean' ||
    typeof product.has_condition_offers === 'boolean' ||
    typeof product.variant_model === 'string' ||
    Array.isArray(product.available_conditions) ||
    Array.isArray(product.variants)
  );
}

function normalizeConditionForCounting(condition: unknown) {
  if (typeof condition !== 'string') {
    return null;
  }

  const trimmed = condition.trim();
  if (!trimmed) {
    return null;
  }

  return normalizeCanonicalProductCondition(trimmed) || trimmed.toLowerCase();
}

function countAvailableConditions(conditions: readonly unknown[] | null | undefined) {
  return new Set(
    (conditions || [])
      .map((condition) => normalizeConditionForCounting(condition))
      .filter((condition): condition is string => Boolean(condition))
  ).size;
}

export function requiresProductSelection(
  product: ProductSelectionRequiredInput,
  options: ProductSelectionRequiredOptions = {}
) {
  // product_variants is canonical for selected SKU identity, condition, and
  // non-color axes. Parent products.variant_attributes is projection/fallback.
  if (
    options.metadataTrust === 'legacy-saved-record' &&
    !hasSelectionMetadata(product)
  ) {
    return true;
  }

  if (product.variant_model === 'sku_matrix') {
    return true;
  }

  if (product.has_variants === true) {
    return true;
  }

  if (product.has_condition_offers === true) {
    return true;
  }

  return countAvailableConditions(product.available_conditions) > 1;
}
