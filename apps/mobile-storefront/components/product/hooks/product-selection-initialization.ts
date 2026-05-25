import { isInternalSelectionAxis } from '@/lib/product-internal-selection-axes';
import { mergeVariantAttributes } from '@/lib/product-normalization';
import type { Product } from '@/types/product';

function getFirstColorOption(product: Product | null) {
  if (!product) {
    return null;
  }

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

export function getFirstImageIndexForColor(args: {
  color: string | null | undefined;
  colorImages?: Record<string, string[]>;
  images: string[];
}) {
  const color = args.color?.trim();
  if (!color) {
    return 0;
  }

  const preferredImages = args.colorImages?.[color] ?? [];
  const preferredImage = preferredImages.find(Boolean);
  if (!preferredImage) {
    return 0;
  }

  const index = args.images.indexOf(preferredImage);
  return index >= 0 ? index : 0;
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

export function getSelectionSyncSignature(product: Product | null) {
  if (!product) {
    return '';
  }

  return JSON.stringify({
    colorImages: product.color_images ?? null,
    images: product.images ?? null,
    colors: product.colors ?? null,
    id: product.id,
    variantAttributes: product.variant_attributes ?? null,
    variants:
      product.variants?.map((variant) => ({
        attributes: variant.attributes ?? null,
        id: variant.id,
        stock_quantity: variant.stock_quantity ?? null,
      })) ?? [],
  });
}
