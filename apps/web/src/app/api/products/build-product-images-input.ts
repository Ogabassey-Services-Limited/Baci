export function buildProductImagesInput(
  images: Record<string, unknown>[] | undefined,
  fallbackImage: string | null | undefined,
  fallbackAlt: string
) {
  if (Array.isArray(images) && images.length > 0) return images;
  if (!fallbackImage) return [];
  return [{ url: fallbackImage, alt: fallbackAlt, order: 0 }];
}
