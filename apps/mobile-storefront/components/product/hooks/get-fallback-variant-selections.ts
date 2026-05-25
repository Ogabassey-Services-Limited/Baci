import { isInternalSelectionAxis } from '@/lib/product-internal-selection-axes';
import { mergeVariantAttributes } from '@/lib/product-normalization';
import type { Product } from '@/types/product';

function getFirstColorOption(product: Product) {
  const imageDrivenColor = Object.keys(product.color_images ?? {}).find(
    Boolean
  );
  if (imageDrivenColor) {
    return imageDrivenColor;
  }

  const variantColor = product.variants
    ?.map((variant) =>
      (variant.attributes?.color ?? variant.attributes?.colour)?.trim()
    )
    .find((value): value is string => Boolean(value));
  if (variantColor) {
    return variantColor;
  }

  const firstColor = product.colors?.[0];
  if (typeof firstColor === 'string') {
    return firstColor;
  }

  return firstColor?.name ?? null;
}

export function getFallbackVariantSelections(product: Product | null) {
  if (!product) {
    return {
      attributes: {} as Record<string, string>,
      color: null as string | null,
      storage: null as string | null,
    };
  }

  const mergedVariantAttributes = mergeVariantAttributes(
    product.variant_attributes,
    product.variants
  );
  const fallbackAttributes = Object.fromEntries(
    Object.entries(mergedVariantAttributes ?? {})
      .filter(
        ([axis, values]) =>
          !isInternalSelectionAxis(axis) && Array.isArray(values)
      )
      .map(([axis, values]) => [axis, values[0]])
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
  );

  return {
    attributes: fallbackAttributes,
    color: getFirstColorOption(product),
    storage: mergedVariantAttributes?.storage?.[0] ?? null,
  };
}
