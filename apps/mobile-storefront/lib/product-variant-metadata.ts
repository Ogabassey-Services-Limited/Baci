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

export interface ProductColorSwatch {
  name: string;
  value?: string;
}

export interface ResolvedProductVariantMetadata {
  colorImages?: Record<string, string[]>;
  colors?: string[];
  /**
   * Carries explicit hex (or other string) values from the product's color
   * metadata so downstream consumers (e.g. `VariantSelector`) can render the
   * exact swatch the merchant chose instead of falling back to a generic
   * name → hex lookup. Names are deduplicated case-insensitively; the first
   * entry's `value` wins on collisions.
   */
  colorSwatches?: ProductColorSwatch[];
  galleryImages?: string[];
  imageColorMap?: Record<string, string>;
  variantAttributes?: Record<string, string[]>;
}

type ResolvedMediaExtras = Pick<
  ResolvedProductVariantMetadata,
  'galleryImages' | 'imageColorMap'
>;

function getResolvedMediaExtras({
  galleryImages,
  imageColorMap,
}: ResolvedMediaExtras): ResolvedMediaExtras {
  const extras: ResolvedMediaExtras = {};

  if (galleryImages && galleryImages.length > 0) {
    extras.galleryImages = galleryImages;
  }

  if (imageColorMap && Object.keys(imageColorMap).length > 0) {
    extras.imageColorMap = imageColorMap;
  }

  return extras;
}

function normalizeProductColors(
  productColors: ProductColorInput
): ProductColorSwatch[] {
  if (!Array.isArray(productColors)) {
    return [];
  }

  // Dedupe case-insensitively while preserving the first-seen casing/value so
  // that explicit hex codes coming from `{ name, value }` objects survive.
  const seen = new Map<string, ProductColorSwatch>();

  for (const color of productColors) {
    if (typeof color === 'string') {
      const name = color.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { name });
      }
      continue;
    }

    const name = typeof color?.name === 'string' ? color.name.trim() : '';
    if (!name) continue;
    const rawValue = typeof color?.value === 'string' ? color.value.trim() : '';
    const key = name.toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, rawValue ? { name, value: rawValue } : { name });
    } else if (!existing.value && rawValue) {
      // Upgrade an entry that lacked a value when we later see one with hex.
      seen.set(key, { name: existing.name, value: rawValue });
    }
  }

  return Array.from(seen.values());
}

function getVariantColors(variants: ProductVariant[] | null | undefined) {
  const variantColors = new Set<string>();

  for (const variant of variants ?? []) {
    const color =
      variant.attributes?.color?.trim() || variant.attributes?.colour?.trim();
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
  const resolvedMediaExtras = getResolvedMediaExtras(resolvedVariantMedia);
  const resolvedColorImages = resolvedVariantMedia.colorImages;
  const imagedColors = resolvedVariantMedia.colors ?? [];
  const productColorSwatches = normalizeProductColors(productColors);
  const productColorNames = productColorSwatches.map((swatch) => swatch.name);
  const fallbackColors = Array.from(
    new Set([
      ...productColorNames,
      ...imagedColors,
      ...(mergedVariantAttributes.color ?? []),
      ...(mergedVariantAttributes.colour ?? []),
    ])
  );
  // When image-backed colors exist, preserve non-imaged colors that come from
  // real variant rows AND from product metadata (legacy `product.colors` /
  // merged variant attributes). Dropping metadata-only colors here would hide
  // valid selection options in legacy or non-variant catalogs where some
  // colors have dedicated images and others do not.
  const colors =
    imagedColors.length > 0
      ? Array.from(new Set([...fallbackColors, ...variantColors]))
      : variantColors.length > 0
        ? Array.from(new Set([...variantColors, ...fallbackColors]))
        : fallbackColors.length > 0
          ? fallbackColors
          : undefined;

  if (
    !colors &&
    !resolvedColorImages &&
    Object.keys(mergedVariantAttributes).length === 0
  ) {
    return resolvedMediaExtras;
  }

  // Intentional: when the catalog uses the legacy `colour` axis,
  // `mergedVariantAttributes` already contains it. We additionally emit
  // `color: colors` so the canonical color axis is exposed for image-driven
  // selection. Mixed catalogs are disambiguated downstream by
  // `pickColorAliasForMixedCatalog`, so emitting both keys here is safe.
  const variantAttributes =
    colors || Object.keys(mergedVariantAttributes).length > 0
      ? {
          ...mergedVariantAttributes,
          ...(colors ? { color: colors } : {}),
        }
      : undefined;

  // Surface explicit hex values from product metadata when they exist so
  // downstream renderers can show the merchant's exact swatch instead of a
  // generic name → hex fallback. We only emit this when at least one entry
  // actually carries a `value`, to avoid bloating the payload for catalogs
  // that only have color names.
  const colorSwatches =
    productColorSwatches.some((swatch) => Boolean(swatch.value)) &&
    colors &&
    colors.length > 0
      ? productColorSwatches.filter((swatch) => colors.includes(swatch.name))
      : undefined;

  return {
    colorImages: resolvedColorImages,
    colors,
    ...(colorSwatches && colorSwatches.length > 0 ? { colorSwatches } : {}),
    ...resolvedMediaExtras,
    variantAttributes,
  };
}
