import { getFirstNonBlankString, trimString } from './string-values';

export interface ProductImageAltSource {
  brand?: unknown;
  image?: unknown;
  imageLarge?: unknown;
  image_alt?: unknown;
  images?: readonly unknown[] | null;
  name?: unknown;
  seo_alt_text?: unknown;
}

export function getImagePayloadUrl(image: unknown): string {
  if (typeof image === 'string') {
    return trimString(image);
  }

  if (!image || typeof image !== 'object') {
    return '';
  }

  return trimString((image as { url?: unknown }).url);
}

export function getImagePayloadAlt(image: unknown): string {
  if (!image || typeof image !== 'object') {
    return '';
  }

  return trimString((image as { alt?: unknown }).alt);
}

export function getMatchingImagePayloadAlt(
  images: readonly unknown[] | null | undefined,
  renderedImageUrl?: unknown
): string {
  if (!Array.isArray(images)) {
    return '';
  }

  const normalizedRenderedUrl = trimString(renderedImageUrl);
  for (const image of images) {
    const alt = getImagePayloadAlt(image);
    if (!alt) {
      continue;
    }

    if (!normalizedRenderedUrl) {
      return alt;
    }

    const imageUrl = getImagePayloadUrl(image);
    if (imageUrl && imageUrl === normalizedRenderedUrl) {
      return alt;
    }
  }

  return '';
}

export function getProductImageAlt(
  product: ProductImageAltSource,
  options: {
    includeBrandFallback?: boolean;
    renderedImageUrl?: unknown;
  } = {}
): string {
  const explicitRenderedImageUrl = trimString(options.renderedImageUrl);
  const primaryImageUrl = getFirstNonBlankString(
    product.imageLarge,
    product.image
  );
  const renderedImageUrl = explicitRenderedImageUrl || primaryImageUrl;
  const matchingPayloadAlt = getMatchingImagePayloadAlt(
    product.images,
    renderedImageUrl
  );
  const renderedImageIsPrimary =
    !explicitRenderedImageUrl ||
    (primaryImageUrl && explicitRenderedImageUrl === primaryImageUrl);

  const explicitAlt = renderedImageIsPrimary
    ? getFirstNonBlankString(
        product.seo_alt_text,
        product.image_alt,
        matchingPayloadAlt
      )
    : matchingPayloadAlt;

  if (explicitAlt) {
    return explicitAlt;
  }

  const name = trimString(product.name);
  const brand = trimString(product.brand);
  if (
    options.includeBrandFallback !== false &&
    brand &&
    name &&
    !name.toLowerCase().includes(brand.toLowerCase())
  ) {
    return `${brand} ${name}`;
  }

  return name || 'Product image';
}
