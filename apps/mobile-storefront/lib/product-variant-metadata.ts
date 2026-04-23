import { resolveProductVariantMedia } from '@baci/shared/lib';
import {
  mergeVariantAttributes,
  type VariantAttributeSource,
} from '@/lib/product-normalization';
import type { Product, ProductVariant } from '@/types/product';

type ProductColorInput =
  | Product['colors']
  | Array<string | { name: string; value?: string | null }>
  | undefined;

interface ResolveProductVariantMetadataInput {
  colorImages?: Product['color_images'];
  productImages?: Product['images'];
  productColors?: ProductColorInput;
  sourceVariantAttributes?: VariantAttributeSource;
  variants?: ProductVariant[] | null;
}

export interface ResolvedProductVariantMetadata {
  colorImages?: Record<string, string[]>;
  colors?: string[];
  galleryImages?: string[];
  imageColorMap?: Record<string, string>;
  variantAttributes?: Record<string, string[]>;
}

function normalizeProductColors(productColors: ProductColorInput) {
  if (!Array.isArray(productColors)) {
    return [];
  }

  const normalized = new Set<string>();

  for (const color of productColors) {
    const value =
      typeof color === 'string'
        ? color.trim()
        : typeof color?.name === 'string'
          ? color.name.trim()
          : '';

    if (value) {
      normalized.add(value);
    }
  }

  return Array.from(normalized);
}

function getVariantColors(variants: ProductVariant[] | null | undefined) {
  const variantColors = new Set<string>();

  for (const variant of variants ?? []) {
    const color = variant.attributes?.color?.trim();
    if (color) {
      variantColors.add(color);
    }
  }

  return Array.from(variantColors);
}

export function resolveProductVariantMetadata({
  colorImages,
  productImages,
  productColors,
  sourceVariantAttributes,
  variants,
}: ResolveProductVariantMetadataInput): ResolvedProductVariantMetadata {
  const mergedVariantAttributes =
    mergeVariantAttributes(sourceVariantAttributes, variants) ?? {};
  const variantColors = getVariantColors(variants);
  const resolvedVariantMedia = resolveProductVariantMedia({
    colorImages,
    productColors,
    productImages,
    variants,
  });
  const resolvedColorImages = resolvedVariantMedia.colorImages;
  const fallbackColors = Array.from(
    new Set([
      ...normalizeProductColors(productColors),
      ...(resolvedVariantMedia.colors ?? []),
      ...(mergedVariantAttributes.color ?? []),
    ])
  );
  const colors =
    (resolvedVariantMedia.colors?.length ?? 0) > 0
      ? resolvedVariantMedia.colors
      : variantColors.length > 0
        ? variantColors
        : fallbackColors.length > 0
          ? fallbackColors
          : undefined;

  if (
    !colors &&
    !resolvedColorImages &&
    Object.keys(mergedVariantAttributes).length === 0
  ) {
    return {};
  }

  const variantAttributes =
    colors || Object.keys(mergedVariantAttributes).length > 0
      ? {
          ...mergedVariantAttributes,
          ...(colors ? { color: colors } : {}),
        }
      : undefined;

  return {
    colorImages: resolvedColorImages,
    colors,
    galleryImages: resolvedVariantMedia.galleryImages,
    imageColorMap: resolvedVariantMedia.imageColorMap,
    variantAttributes,
  };
}
