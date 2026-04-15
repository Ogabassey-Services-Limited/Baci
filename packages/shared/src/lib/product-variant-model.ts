export type ProductVariantModel = 'legacy' | 'sku_matrix';

export interface ProductVariantModelInput {
  condition?: string | null;
  price_override?: number | null;
}

export function normalizeProductVariantModel(
  value: string | null | undefined
): ProductVariantModel {
  return value === 'sku_matrix' ? 'sku_matrix' : 'legacy';
}

export function inferProductVariantModel(options: {
  variantModel?: string | null;
  variants?: ProductVariantModelInput[] | null;
}): ProductVariantModel {
  const explicitVariantModel = normalizeProductVariantModel(
    options.variantModel
  );

  if (options.variantModel != null) {
    return explicitVariantModel;
  }

  return (options.variants || []).some(
    (variant) =>
      typeof variant.condition === 'string' && variant.condition.trim() !== ''
  )
    ? 'sku_matrix'
    : 'legacy';
}

export function getSkuMatrixValidationError(options: {
  hasVariants?: boolean | null;
  variantModel: ProductVariantModel;
  variants?: ProductVariantModelInput[] | null;
}): string | null {
  if (options.variantModel !== 'sku_matrix') {
    return null;
  }

  if (!options.hasVariants) {
    return 'sku_matrix products must enable variants.';
  }

  if (!Array.isArray(options.variants) || options.variants.length === 0) {
    return 'sku_matrix products require at least one variant row.';
  }

  if (
    options.variants.some(
      (variant) =>
        typeof variant.condition !== 'string' || variant.condition.trim() === ''
    )
  ) {
    return 'Every sku_matrix variant must include a condition.';
  }

  if (
    options.variants.some(
      (variant) =>
        typeof variant.price_override !== 'number' ||
        Number.isNaN(variant.price_override) ||
        variant.price_override < 0
    )
  ) {
    return 'Every sku_matrix variant must include a non-negative price_override.';
  }

  return null;
}
