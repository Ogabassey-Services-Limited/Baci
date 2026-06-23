import { DEFAULT_MEDIA_CDN_ORIGIN } from '@/config/cdn';

const OGABASSEY_CDN_HOSTNAME = new URL(DEFAULT_MEDIA_CDN_ORIGIN).hostname;
const OGABASSEY_IMAGE_TRANSFORM_PREFIX = '/image/';
const OGABASSEY_PRODUCT_IMAGE_PATH_PREFIX = '/core-assets/products/';
const OGABASSEY_LEGACY_PRODUCT_IMAGE_PATH_PREFIX = '/products/';
const TRANSFORMABLE_IMAGE_EXTENSION_PATTERN = /\.(avif|jpe?g|png|webp)$/i;

export function isOgabasseyCdnImageUrl(src: string): boolean {
  try {
    return new URL(src).hostname === OGABASSEY_CDN_HOSTNAME;
  } catch {
    return false;
  }
}

export function normalizeOgabasseyCdnImageUrl(src: string): string {
  return (
    unwrapOgabasseyTransformUrl(src) ??
    normalizeOgabasseyLegacyProductImageUrl(src) ??
    src
  );
}

export function buildOgabasseyCdnImageLoaderUrl(
  src: string,
  width: number,
  quality: number
): string {
  const normalizedSrc = normalizeOgabasseyCdnImageUrl(src);
  let url: URL;

  try {
    url = new URL(normalizedSrc);
  } catch {
    return normalizedSrc;
  }

  if (
    url.hostname !== OGABASSEY_CDN_HOSTNAME ||
    !isTransformableOgabasseyAssetPath(url.pathname)
  ) {
    return normalizedSrc;
  }

  return `${url.origin}${OGABASSEY_IMAGE_TRANSFORM_PREFIX}width=${width},quality=${quality},format=auto${url.pathname}${url.search}${url.hash}`;
}

function isTransformableOgabasseyAssetPath(pathname: string): boolean {
  return (
    (pathname.startsWith(OGABASSEY_PRODUCT_IMAGE_PATH_PREFIX) ||
      pathname.startsWith('/core-assets/blog/')) &&
    TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(pathname)
  );
}

function unwrapOgabasseyTransformUrl(src: string): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }

  if (
    url.hostname !== OGABASSEY_CDN_HOSTNAME ||
    !url.pathname.startsWith(OGABASSEY_IMAGE_TRANSFORM_PREFIX)
  ) {
    return null;
  }

  const remainder = url.pathname.slice(OGABASSEY_IMAGE_TRANSFORM_PREFIX.length);
  const separatorIndex = remainder.indexOf('/');
  if (separatorIndex <= 0) {
    return null;
  }

  const assetPath = remainder.slice(separatorIndex);
  if (!TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(assetPath)) {
    return null;
  }

  return `${url.origin}${assetPath}${url.search}${url.hash}`;
}

function normalizeOgabasseyLegacyProductImageUrl(src: string): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }

  if (
    url.hostname !== OGABASSEY_CDN_HOSTNAME ||
    !url.pathname.startsWith(OGABASSEY_LEGACY_PRODUCT_IMAGE_PATH_PREFIX) ||
    !TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(url.pathname)
  ) {
    return null;
  }

  const productAssetPath = url.pathname.slice(
    OGABASSEY_LEGACY_PRODUCT_IMAGE_PATH_PREFIX.length
  );
  const normalizedPath = `${OGABASSEY_PRODUCT_IMAGE_PATH_PREFIX}${productAssetPath}`;

  return `${url.origin}${normalizedPath}${url.search}${url.hash}`;
}
