import { DEFAULT_IMAGE_QUALITY } from '@/config/cdn';
import {
  buildOgabasseyCdnImageLoaderUrl,
  isOgabasseyCdnImageUrl,
  resolveOgabasseyCdnFallbackFormat,
} from '@/lib/ogabassey-cdn-image-url';

const LANDSCAPE_DIMENSIONS = { width: 1200, height: 675 } as const;
const FALLBACK_DIMENSIONS = { width: 1200, height: 630 } as const;

export type BlogPostSocialImage = {
  url: string;
  width?: number;
  height?: number;
  type?: `image/${string}`;
};

function getAbsoluteHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function getImageMimeType(url: string): `image/${string}` | undefined {
  const pathname = getImagePathname(url);
  if (!pathname) return undefined;

  const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (!extension) return undefined;

  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'avif') return 'image/avif';
  return undefined;
}

function getImagePathname(url: string): string | undefined {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}

function getPositiveDimension(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getCompatibilityImageUrl(storeUrl: string, postSlug: string): string {
  const baseUrl = storeUrl.endsWith('/') ? storeUrl : `${storeUrl}/`;
  try {
    return new URL(
      `blog/${encodeURIComponent(postSlug)}/opengraph-image`,
      baseUrl
    ).toString();
  } catch {
    return `/blog/${encodeURIComponent(postSlug)}/opengraph-image`;
  }
}

function projectDirectImage(
  sourceUrl: string,
  dimensions?: { width?: number; height?: number }
): BlogPostSocialImage | null {
  const mimeType = getImageMimeType(sourceUrl);
  if (!mimeType) {
    return null;
  }
  const isLandscape =
    dimensions?.width === LANDSCAPE_DIMENSIONS.width &&
    dimensions.height === LANDSCAPE_DIMENSIONS.height;

  if (isOgabasseyCdnImageUrl(sourceUrl)) {
    const url = buildOgabasseyCdnImageLoaderUrl(
      sourceUrl,
      1200,
      DEFAULT_IMAGE_QUALITY
    );
    const transformedMimeType =
      url !== sourceUrl
        ? (`image/${resolveOgabasseyCdnFallbackFormat(getImagePathname(sourceUrl) ?? '')}` as const)
        : mimeType;
    const transformedDimensions =
      url !== sourceUrl && !isLandscape
        ? getTransformedDimensions(dimensions)
        : isLandscape
          ? LANDSCAPE_DIMENSIONS
          : dimensions;
    return {
      url,
      ...transformedDimensions,
      ...(transformedMimeType ? { type: transformedMimeType } : {}),
    };
  }

  return {
    url: sourceUrl,
    ...(isLandscape ? LANDSCAPE_DIMENSIONS : dimensions),
    ...(mimeType ? { type: mimeType } : {}),
  };
}

function getTransformedDimensions(dimensions?: {
  width?: number;
  height?: number;
}): { width: number; height: number } | undefined {
  const width = getPositiveDimension(dimensions?.width);
  const height = getPositiveDimension(dimensions?.height);
  if (width === undefined || height === undefined) return undefined;

  const transformedWidth = Math.min(LANDSCAPE_DIMENSIONS.width, width);
  const transformedHeight = Math.round((transformedWidth * height) / width);
  return transformedHeight > 0
    ? { width: transformedWidth, height: transformedHeight }
    : undefined;
}

/**
 * Projects cached blog-post media into direct social metadata. Transformable
 * OgaBassey assets are pinned to JPEG/PNG; immutable uploaded variants under
 * /media keep their explicit native format. Unrecognized HTTP(S) assets use
 * the compatibility route so social metadata never advertises a non-image.
 */
export function getBlogPostSocialImage(
  storeUrl: string,
  postSlug: string,
  featuredImageUrl: unknown,
  featuredImageVariants: unknown,
  featuredImageWidth?: unknown,
  featuredImageHeight?: unknown
): BlogPostSocialImage {
  const variants = isRecord(featuredImageVariants) ? featuredImageVariants : {};
  const landscapeUrl = getAbsoluteHttpUrl(variants.landscape_16x9);
  const originalUrl = getAbsoluteHttpUrl(featuredImageUrl);

  if (landscapeUrl) {
    const directImage = projectDirectImage(landscapeUrl, LANDSCAPE_DIMENSIONS);
    if (directImage) {
      return directImage;
    }
  }

  if (originalUrl) {
    const width = getPositiveDimension(featuredImageWidth);
    const height = getPositiveDimension(featuredImageHeight);
    const directImage = projectDirectImage(
      originalUrl,
      width !== undefined && height !== undefined
        ? { width, height }
        : undefined
    );
    if (directImage) {
      return directImage;
    }
  }

  return {
    url: getCompatibilityImageUrl(storeUrl, postSlug),
    ...FALLBACK_DIMENSIONS,
    type: 'image/png',
  };
}
