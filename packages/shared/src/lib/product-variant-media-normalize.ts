interface VariantImageObject {
  url?: string | null;
}

interface ProductColorObject {
  name?: string | null;
}

export type ProductVariantImageInput =
  | string
  | VariantImageObject
  | null
  | undefined;

export type ProductColorInput =
  | Array<string | ProductColorObject | null | undefined>
  | null
  | undefined;

export type ProductImageInput =
  | Array<string | VariantImageObject | null | undefined>
  | null
  | undefined;

export type ProductColorImagesInput =
  | Record<string, Array<string | null | undefined> | null | undefined>
  | null
  | undefined;

/**
 * Formats a color name by trimming whitespace and stripping surrounding
 * quotes. Inputs persisted to JSON fields sometimes carry stray quotes from
 * serialization round-trips (e.g. `"Black"`), which break case-insensitive
 * equality against unquoted sources. Repeated outer quotes are handled.
 */
export function normalizeColorName(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Normalizes an image URL from various possible input formats.
 * Strips surrounding quotes (including repeated outer quotes) and trims
 * whitespace.
 */
export function normalizeImageUrl(value: ProductVariantImageInput) {
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
    return trimmed.replace(/^["']+|["']+$/g, '').trim();
  }

  return '';
}

/**
 * Normalizes the legacy colorImages record into a consistent format.
 */
export function normalizeColorImages(
  colorImages: ProductColorImagesInput
): Record<string, string[]> | undefined {
  if (!colorImages || typeof colorImages !== 'object') {
    return undefined;
  }

  const normalized = Object.entries(colorImages).reduce<
    Record<string, string[]>
  >((acc, [color, images]) => {
    const key = normalizeColorName(color);
    if (!key) {
      return acc;
    }
    const incoming = (images ?? [])
      .map((image) => normalizeImageUrl(image))
      .filter(Boolean) as string[];
    if (incoming.length === 0) {
      return acc;
    }
    const existing = acc[key] ?? [];
    acc[key] = Array.from(new Set([...existing, ...incoming]));
    return acc;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * Normalizes the productColors list.
 */
export function normalizeProductColors(productColors: ProductColorInput) {
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
export function normalizeProductImages(productImages: ProductImageInput) {
  return Array.from(
    new Set(
      (productImages ?? [])
        .map((image) => normalizeImageUrl(image))
        .filter(Boolean)
    )
  );
}
