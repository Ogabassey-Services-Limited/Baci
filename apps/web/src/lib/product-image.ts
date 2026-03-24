export const PRODUCT_IMAGE_PLACEHOLDER_URL =
  'https://picsum.photos/seed/placeholder/80/80';

export const PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL =
  'https://picsum.photos/seed/placeholder/600/400';

export function getPrimaryProductImage(
  images: Array<string | { url?: string | null }> | null | undefined
): string | null {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const firstImage = images[0];

  if (typeof firstImage === 'string') {
    return firstImage || null;
  }

  if (firstImage && typeof firstImage === 'object') {
    return firstImage.url || null;
  }

  return null;
}
