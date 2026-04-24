import {
  collapseColorImagesCaseInsensitive,
  mergeColorImagesCaseInsensitive,
} from './product-variant-media-merge';
import {
  normalizeColorImages,
  normalizeColorName,
  normalizeImageUrl,
  normalizeProductColors,
  normalizeProductImages,
  type ProductColorImagesInput,
  type ProductColorInput,
  type ProductImageInput,
} from './product-variant-media-normalize';

interface VariantImageObject {
  url?: string | null;
}

interface ProductVariantMediaLike {
  attributes?: Record<string, string | null | undefined> | null;
  image?: string | VariantImageObject | null;
  images?: Array<string | VariantImageObject | null | undefined> | null;
  primary_image?: string | VariantImageObject | null;
}

export interface ResolveProductVariantMediaInput {
  colorImages?: ProductColorImagesInput;
  productColors?: ProductColorInput;
  productImages?: ProductImageInput;
  variants?: ProductVariantMediaLike[] | null;
}

export interface ResolvedProductVariantMedia {
  colorImages?: Record<string, string[]>;
  colors?: string[];
  galleryImages: string[];
  imageColorMap: Record<string, string>;
}

/**
 * Extracts color-to-image mappings from product variants.
 */
function buildVariantColorImages(
  variants: ProductVariantMediaLike[] | null | undefined
): Record<string, string[]> | undefined {
  const grouped = new Map<string, Set<string>>();

  for (const variant of variants ?? []) {
    const color = normalizeColorName(
      variant.attributes?.color ?? variant.attributes?.colour
    );

    if (!color) {
      continue;
    }

    const images = [
      normalizeImageUrl(variant.primary_image),
      normalizeImageUrl(variant.image),
      ...(variant.images ?? []).map((image) => normalizeImageUrl(image)),
    ].filter(Boolean);

    if (images.length === 0) {
      continue;
    }

    const bucket = grouped.get(color) ?? new Set<string>();
    for (const image of images) {
      bucket.add(image);
    }
    grouped.set(color, bucket);
  }

  if (grouped.size === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Array.from(grouped.entries()).map(([color, images]) => [
      color,
      Array.from(images),
    ])
  );
}

/**
 * Flattens all images from a colorImages record into a single list.
 */
function flattenColorImages(colorImages: Record<string, string[]>) {
  return Array.from(new Set(Object.values(colorImages).flat()));
}

/**
 * Builds the complete list of gallery images, ensuring color-specific images
 * are represented first.
 */
function buildGalleryImages(
  productImages: ProductImageInput,
  colorImages: Record<string, string[]> | undefined
) {
  const normalizedProductImages = normalizeProductImages(productImages);
  const normalizedColorImages = colorImages
    ? flattenColorImages(colorImages)
    : [];

  return Array.from(
    new Set([...normalizedColorImages, ...normalizedProductImages])
  );
}

/**
 * Creates a reverse map from image URL to color name for filtering.
 */
function buildImageColorMap(colorImages: Record<string, string[]> | undefined) {
  const imageColorMap: Record<string, string> = {};

  if (!colorImages) {
    return imageColorMap;
  }

  for (const [color, images] of Object.entries(colorImages)) {
    for (const image of images) {
      if (!image || imageColorMap[image]) {
        continue;
      }

      imageColorMap[image] = color;
    }
  }

  return imageColorMap;
}

/**
 * Derives an ordered list of unique colors from all available sources.
 */
function buildOrderedColors(args: {
  galleryImages: string[];
  imageColorMap: Record<string, string>;
  productColors: string[];
  resolvedColorImages?: Record<string, string[]>;
}) {
  // Dedupe case-insensitively so mixed-case inputs from different sources
  // (e.g. `color_images` key `black` and `product.colors` entry `Black`)
  // do not produce duplicate swatches. The first casing encountered wins
  // and insertion order is preserved via Map iteration.
  const ordered = new Map<string, string>();

  const addColor = (color: string) => {
    const trimmed = color?.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (!ordered.has(key)) {
      ordered.set(key, trimmed);
    }
  };

  for (const image of args.galleryImages) {
    const color = args.imageColorMap[image];
    if (color) {
      addColor(color);
    }
  }

  for (const color of Object.keys(args.resolvedColorImages ?? {})) {
    addColor(color);
  }

  for (const color of args.productColors) {
    addColor(color);
  }

  return Array.from(ordered.values());
}

/**
 * Combines legacy color-image data with variant-derived color images. When
 * variant data is present the two are merged case-insensitively; otherwise
 * the legacy record is returned (or undefined when it is empty).
 */
function resolveColorImages(
  legacyColorImages: Record<string, string[]>,
  variantColorImages: Record<string, string[]> | undefined
): Record<string, string[]> | undefined {
  if (variantColorImages) {
    return mergeColorImagesCaseInsensitive(
      legacyColorImages,
      variantColorImages
    );
  }

  if (Object.keys(legacyColorImages).length > 0) {
    return legacyColorImages;
  }

  return undefined;
}

/**
 * Resolves the canonical media state for a product, combining legacy data
 * (colorImages, productColors) with modern variant-driven media.
 *
 * It merges variant media on top of legacy data, ensuring variants override
 * per-color but legacy entries for colors not in variants are preserved.
 */
export function resolveProductVariantMedia({
  colorImages,
  productColors,
  productImages,
  variants,
}: ResolveProductVariantMediaInput): ResolvedProductVariantMedia {
  const rawVariantColorImages = buildVariantColorImages(variants);
  // Collapse variant-only duplicates too: if two variants share a color
  // that differs only by case (e.g. `Black` and `black`), `buildOrderedColors`
  // merges the label case-insensitively while `colorImages` would otherwise
  // keep two separate buckets — one of them unreachable via
  // `colorImages[colorName]` on the PDP.
  const variantColorImages = rawVariantColorImages
    ? collapseColorImagesCaseInsensitive(rawVariantColorImages)
    : undefined;
  const normalizedLegacyColorImages = collapseColorImagesCaseInsensitive(
    normalizeColorImages(colorImages) ?? {}
  );

  // Merge: variant color images override legacy entries per-key, but legacy
  // entries for other colors are preserved. The merge is case-insensitive on
  // the color-name key so that a legacy `Black` bucket and a variant `black`
  // bucket collapse into a single entry — otherwise `buildOrderedColors`
  // deduplicates labels case-insensitively while `colorImages` keeps the two
  // buckets split, causing the UI to show one color label that misses half
  // its images. The legacy-only path also collapses case-variant duplicates
  // within the legacy record for the same reason.
  const resolvedColorImages = resolveColorImages(
    normalizedLegacyColorImages,
    variantColorImages
  );

  const galleryImages = buildGalleryImages(productImages, resolvedColorImages);
  const imageColorMap = buildImageColorMap(resolvedColorImages);
  const colors = buildOrderedColors({
    galleryImages,
    imageColorMap,
    productColors: normalizeProductColors(productColors),
    resolvedColorImages,
  });

  return {
    colorImages: resolvedColorImages,
    colors: colors.length > 0 ? colors : undefined,
    galleryImages,
    imageColorMap,
  };
}
