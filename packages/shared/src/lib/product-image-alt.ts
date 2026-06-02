import { getFirstNonBlankString, trimString } from './string-values';

export type ProductImageAltPayload =
  | string
  | {
      alt?: unknown;
      url?: unknown;
    };

export interface ProductImageAltSource {
  brand?: unknown;
  image?: unknown;
  imageLarge?: unknown;
  image_alt?: unknown;
  image_payloads?: readonly ProductImageAltPayload[] | null;
  images?: readonly unknown[] | null;
  name?: unknown;
  seo_alt_text?: unknown;
}

export interface DerivedProductImageData {
  image: string;
  imageAlt: string;
  imagePayloads: ProductImageAltPayload[];
  images: string[];
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

function getFirstImagePayloadUrl(
  images: readonly unknown[] | null | undefined
): string {
  if (!Array.isArray(images)) {
    return '';
  }

  for (const image of images) {
    const imageUrl = getImagePayloadUrl(image);
    if (imageUrl) {
      return imageUrl;
    }
  }

  return '';
}

export function deriveProductImageData({
  image,
  images,
}: {
  image?: unknown;
  images?: readonly ProductImageAltPayload[] | null;
}): DerivedProductImageData {
  const imagePayloads = Array.isArray(images) ? images : [];
  const imageUrls: string[] = [];
  let primaryImage = trimString(image);
  let primaryImageAlt = '';

  for (const imagePayload of imagePayloads) {
    const imageUrl = getImagePayloadUrl(imagePayload);
    if (!imageUrl) {
      continue;
    }

    if (!primaryImage) {
      primaryImage = imageUrl;
    }

    if (imageUrl === primaryImage) {
      primaryImageAlt ||= getImagePayloadAlt(imagePayload);
    }

    imageUrls.push(imageUrl);
  }

  return {
    image: primaryImage || imageUrls[0] || '',
    imageAlt: primaryImageAlt,
    imagePayloads,
    images: imageUrls,
  };
}

function getProductImagePayloads(
  product: ProductImageAltSource
): readonly unknown[] | null | undefined {
  return Array.isArray(product.image_payloads)
    ? product.image_payloads
    : product.images;
}

export function getProductImageAlt(
  product: ProductImageAltSource,
  options: {
    includeBrandFallback?: boolean;
    renderedImageUrl?: unknown;
  } = {}
): string {
  const explicitRenderedImageUrl = trimString(options.renderedImageUrl);
  const imagePayloads = getProductImagePayloads(product);
  const explicitPrimaryImageUrls = [
    trimString(product.imageLarge),
    trimString(product.image),
  ].filter(Boolean);
  const fallbackPrimaryImageUrl =
    explicitPrimaryImageUrls.length > 0
      ? ''
      : getFirstImagePayloadUrl(imagePayloads);
  const primaryImageUrls = fallbackPrimaryImageUrl
    ? [...explicitPrimaryImageUrls, fallbackPrimaryImageUrl]
    : explicitPrimaryImageUrls;
  const primaryImageUrl = primaryImageUrls[0] || '';
  const renderedImageUrl = explicitRenderedImageUrl || primaryImageUrl;
  const matchingPayloadAlt = getMatchingImagePayloadAlt(
    imagePayloads,
    renderedImageUrl
  );
  const renderedImageIsPrimary =
    !explicitRenderedImageUrl ||
    primaryImageUrls.includes(explicitRenderedImageUrl);

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
