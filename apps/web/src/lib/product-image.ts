export const PRODUCT_IMAGE_PLACEHOLDER_URL = '/placeholder.png';

export const PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL = '/placeholder.png';

export function getPrimaryProductImage(
  images: Array<string | { url?: string | null }> | null | undefined
): string | null {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  for (const image of images) {
    if (typeof image === 'string') {
      const normalized = image.trim();
      if (normalized.length > 0) {
        return normalized;
      }
      continue;
    }

    if (image && typeof image === 'object') {
      const normalized = image.url?.trim();
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}
