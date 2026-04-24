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
 * Formats a color name by trimming whitespace.
 */
export function normalizeColorName(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalizes an image URL from various possible input formats.
 * Strips surrounding quotes and trims whitespace.
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
    return trimmed.replace(/^"|"$/g, '').trim();
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

  const normalized = Object.fromEntries(
    Object.entries(colorImages)
      .map(([color, images]) => [
        normalizeColorName(color),
        Array.from(
          new Set(
            (images ?? [])
              .map((image) => normalizeImageUrl(image))
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
