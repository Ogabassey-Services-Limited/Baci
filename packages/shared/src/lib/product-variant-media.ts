interface VariantImageObject {
  url?: string | null;
}

interface ProductColorObject {
  name?: string | null;
}

interface ProductVariantMediaLike {
  attributes?: Record<string, string | null | undefined> | null;
  image?: string | VariantImageObject | null;
  images?: Array<string | VariantImageObject | null | undefined> | null;
  primary_image?: string | VariantImageObject | null;
}

type ProductColorInput =
  | Array<string | ProductColorObject | null | undefined>
  | null
  | undefined;

type ProductImageInput =
  | Array<string | VariantImageObject | null | undefined>
  | null
  | undefined;

type ProductColorImagesInput =
  | Record<string, Array<string | null | undefined> | null | undefined>
  | null
  | undefined;

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
 * Formats a color name by trimming whitespace.
 */
function normalizeColorName(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalizes an image URL from various possible input formats.
 * Strips surrounding quotes and trims whitespace.
 */
function normalizeImageUrl(
  value: string | VariantImageObject | null | undefined
) {
  let url = '';
  if (typeof value === 'string') {
    url = value;
  } else if (
    value &&
    typeof value === 'object' &&
    typeof value.url === 'string'
  ) {
    url = value.url;
  }

  if (url) {
    const trimmed = url.trim();
    return trimmed.replace(/^"|"$/g, '').trim();
  }

  return '';
}

/**
 * Normalizes the legacy colorImages record into a consistent format.
 */
function normalizeColorImages(
  colorImages: ProductColorImagesInput
): Record<string, string[]> | undefined {
  if (!colorImages || typeof colorImages !== 'object') {
    return undefined;
  }

  const normalized = Object.fromEntries(
    Object.entries(colorImages)
      .map(([color, images]) => [
        normalizeColorName(color),
        Array.from(
          new Set(
            (images ?? [])
              .map((image) => normalizeImageUrl(image ?? undefined))
              .filter(Boolean)
          )
        ),
      ])
      .filter(
        (entry): entry is [string, string[]] =>
          entry[0].length > 0 && entry[1].length > 0
      )
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
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
 * Normalizes the productColors list.
 */
function normalizeProductColors(productColors: ProductColorInput) {
  const colors = new Set<string>();

  for (const color of productColors ?? []) {
    const normalized =
      typeof color === 'string'
        ? normalizeColorName(color)
        : normalizeColorName(color?.name);

    if (normalized) {
      colors.add(normalized);
    }
  }

  return Array.from(colors);
}

/**
 * Normalizes a list of product image URLs.
 */
function normalizeProductImages(productImages: ProductImageInput) {
  return Array.from(
    new Set(
      (productImages ?? [])
        .map((image) => normalizeImageUrl(image))
        .filter(Boolean)
    )
  );
}

/**
 * Flattens all images from a colorImages record into a single list.
 */
function flattenColorImages(colorImages: Record<string, string[]>) {
  return Array.from(new Set(Object.values(colorImages).flat()));
}

/**
 * Collapses a color-image record so keys that only differ by case share a
 * single bucket. The first-seen casing wins — this matches
 * `buildOrderedColors`, which deduplicates labels case-insensitively and
 * also preserves the first casing it encounters. Without this, a legacy
 * `Black` + `black` pair would remain as two buckets in `colorImages` while
 * the color label list collapses to one entry, leaving half the images
 * unreachable on the PDP.
 */
function collapseColorImagesCaseInsensitive(
  colorImages: Record<string, string[]>
): Record<string, string[]> {
  const canonicalKeyByLookup = new Map<string, string>();
  const merged: Record<string, string[]> = {};

  for (const [key, images] of Object.entries(colorImages)) {
    const lookup = key.toLowerCase();
    const canonicalKey = canonicalKeyByLookup.get(lookup);

    if (canonicalKey) {
      merged[canonicalKey] = Array.from(
        new Set([...(merged[canonicalKey] ?? []), ...images])
      );
      continue;
    }

    canonicalKeyByLookup.set(lookup, key);
    merged[key] = Array.from(new Set(images));
  }

  return merged;
}

/**
 * Merges legacy and variant color-image records case-insensitively on the
 * color-name key. Rules:
 *
 * - Variants define the canonical casing for the output key.
 * - When a legacy key and a variant key refer to the same color ignoring
 *   case (e.g. `Black` vs `black`), the variant images REPLACE the legacy
 *   images under the variant casing. This preserves the pre-existing
 *   "variant overrides legacy per-key" contract while also eliminating the
 *   split-bucket bug where `buildOrderedColors` collapses the label but
 *   `colorImages` keeps both keys.
 * - Legacy entries whose color does not appear in variants (case-insensitive)
 *   are carried through unchanged.
 */
function mergeColorImagesCaseInsensitive(
  legacy: Record<string, string[]>,
  variants: Record<string, string[]>
): Record<string, string[]> {
  const variantKeyByLookup = new Map<string, string>();
  for (const variantKey of Object.keys(variants)) {
    variantKeyByLookup.set(variantKey.toLowerCase(), variantKey);
  }

  // Preserve the existing property order: legacy insertion order first (so
  // a legacy `Gold` that is overridden by a variant still appears in the
  // original slot), then any variant-only colors. For colors covered by a
  // variant we emit the variant images under the variant's canonical
  // casing; otherwise the legacy entry is carried through unchanged.
  const merged: Record<string, string[]> = {};
  const emittedVariantKeys = new Set<string>();

  for (const [legacyKey, legacyImages] of Object.entries(legacy)) {
    const lookup = legacyKey.toLowerCase();
    const variantKey = variantKeyByLookup.get(lookup);
    if (variantKey) {
      merged[variantKey] = Array.from(new Set(variants[variantKey] ?? []));
      emittedVariantKeys.add(variantKey);
      continue;
    }
    merged[legacyKey] = Array.from(new Set(legacyImages));
  }
  for (const [variantKey, variantImages] of Object.entries(variants)) {
    if (emittedVariantKeys.has(variantKey)) {
      continue;
    }
    merged[variantKey] = Array.from(new Set(variantImages));
  }
  return merged;
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
  variantColorImages?: Record<string, string[]>;
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

  for (const color of Object.keys(args.variantColorImages ?? {})) {
    addColor(color);
  }

  for (const color of args.productColors) {
    addColor(color);
  }

  return Array.from(ordered.values());
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
  const variantColorImages = buildVariantColorImages(variants);
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
  const resolvedColorImages = variantColorImages
    ? mergeColorImagesCaseInsensitive(
        normalizedLegacyColorImages,
        variantColorImages
      )
    : Object.keys(normalizedLegacyColorImages).length > 0
      ? normalizedLegacyColorImages
      : undefined;

  const galleryImages = buildGalleryImages(productImages, resolvedColorImages);
  const imageColorMap = buildImageColorMap(resolvedColorImages);
  const colors = buildOrderedColors({
    galleryImages,
    imageColorMap,
    productColors: normalizeProductColors(productColors),
    variantColorImages: resolvedColorImages,
  });

  return {
    colorImages: resolvedColorImages,
    colors: colors.length > 0 ? colors : undefined,
    galleryImages,
    imageColorMap,
  };
}
