import { DEFAULT_MEDIA_CDN_ORIGIN } from '@/config/cdn';

const OGABASSEY_CDN_HOSTNAME = new URL(DEFAULT_MEDIA_CDN_ORIGIN).hostname;
const OGABASSEY_IMAGE_TRANSFORM_PREFIX = '/image/';
const OGABASSEY_PRODUCT_IMAGE_PATH_PREFIX = '/core-assets/products/';
const OGABASSEY_LEGACY_PRODUCT_IMAGE_PATH_PREFIX = '/products/';
const TRANSFORMABLE_IMAGE_EXTENSION_PATTERN = /\.(avif|jpe?g|png|webp)$/i;
const TRANSFORM_FORMAT_TOKEN_PATTERN =
  /(^|,)(format=)(auto|avif|jpe?g|png|webp)(?=,|$)/i;
const TRANSFORM_FORMAT_TOKEN_REPLACE_PATTERN =
  /(^|,)(format=)(auto|avif|jpe?g|png|webp)(?=,|$)/gi;

/**
 * Formats the CDN transformer accepts in the URL options segment
 * (infra/cdn-transformer/request-parser.mjs). `auto` negotiates on the Accept
 * header server-side and MUST NOT appear in newly rendered browser URLs:
 * Cloudflare Free stores ONE body per URL and ignores `Vary: Accept`, so a
 * warm `format=auto` entry serves whichever format its first requester
 * negotiated to EVERY later client — AVIF bytes to browsers that cannot
 * decode them. Browser-facing markup ships explicit per-format URLs instead
 * (an `image/avif` `<picture>` source plus a universally decodable fallback),
 * giving each format its own cache key.
 */
export type OgabasseyCdnImageFormat = 'auto' | 'avif' | 'jpeg' | 'png' | 'webp';

/**
 * The universally decodable format for a source asset — the `<img>` fallback
 * tier. Mirrors the transformer's own `format=auto` outcome for clients with
 * no modern-format support (`pickFormat` in
 * infra/cdn-transformer/request-parser.mjs): PNG sources stay PNG (preserves
 * transparency), everything else transcodes to JPEG.
 */
export function resolveOgabasseyCdnFallbackFormat(
  pathname: string
): 'jpeg' | 'png' {
  return /\.png$/i.test(pathname) ? 'png' : 'jpeg';
}

export function isOgabasseyCdnImageUrl(src: string): boolean {
  try {
    return new URL(src).hostname === OGABASSEY_CDN_HOSTNAME;
  } catch {
    return false;
  }
}

export function normalizeOgabasseyCdnImageUrl(src: string): string {
  const unwrapped = unwrapOgabasseyTransformUrl(src);
  if (unwrapped) {
    return normalizeOgabasseyLegacyProductImageUrl(unwrapped) ?? unwrapped;
  }

  return normalizeOgabasseyLegacyProductImageUrl(src) ?? src;
}

/**
 * Build the CDN transform URL a browser should request for a managed asset.
 *
 * `format` defaults to the source's universally decodable fallback tier
 * (see `resolveOgabasseyCdnFallbackFormat`) — NEVER `format=auto`: on the
 * Cloudflare Free plan an Accept-negotiated URL is a single shared cache body,
 * which served immutable AVIF bytes to non-AVIF browsers (probe-verified
 * 2026-07-08). Callers building the modern tier pass `'avif'` explicitly;
 * `'auto'` remains accepted for server-side legacy needs only.
 */
export function buildOgabasseyCdnImageLoaderUrl(
  src: string,
  width: number,
  quality: number,
  format?: OgabasseyCdnImageFormat
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

  const resolvedFormat =
    format ?? resolveOgabasseyCdnFallbackFormat(url.pathname);

  return `${url.origin}${OGABASSEY_IMAGE_TRANSFORM_PREFIX}width=${width},quality=${quality},format=${resolvedFormat}${url.pathname}${url.search}${url.hash}`;
}

/**
 * Rewrite the `format=` token of an ALREADY-BUILT OgaBassey transform URL to
 * another format tier. Returns `null` when `url` is not an OgaBassey
 * transform URL carrying a format token — callers treat that as "no
 * alternate tier exists" and skip emitting one.
 *
 * Deriving the AVIF tier by rewriting the fallback URL (instead of building
 * it independently) guarantees the two tiers differ ONLY in the format token,
 * so `<source type="image/avif">` and `<img>` candidates — and their preload
 * hints — stay byte-identical apart from the format segment.
 */
export function rewriteOgabasseyTransformUrlFormat(
  url: string,
  format: OgabasseyCdnImageFormat
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (
    parsed.hostname !== OGABASSEY_CDN_HOSTNAME ||
    !parsed.pathname.startsWith(OGABASSEY_IMAGE_TRANSFORM_PREFIX)
  ) {
    return null;
  }

  const remainder = parsed.pathname.slice(
    OGABASSEY_IMAGE_TRANSFORM_PREFIX.length
  );
  const separatorIndex = remainder.indexOf('/');
  if (separatorIndex <= 0) {
    return null;
  }

  const optionsSegment = remainder.slice(0, separatorIndex);
  if (!TRANSFORM_FORMAT_TOKEN_PATTERN.test(optionsSegment)) {
    return null;
  }

  const rewrittenOptions = optionsSegment.replace(
    TRANSFORM_FORMAT_TOKEN_REPLACE_PATTERN,
    `$1$2${format}`
  );

  return `${parsed.origin}${OGABASSEY_IMAGE_TRANSFORM_PREFIX}${rewrittenOptions}${remainder.slice(separatorIndex)}${parsed.search}${parsed.hash}`;
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
  if (!isTransformableOrLegacyOgabasseyAssetPath(assetPath)) {
    return null;
  }

  return `${url.origin}${assetPath}${url.search}${url.hash}`;
}

function isTransformableOrLegacyOgabasseyAssetPath(pathname: string): boolean {
  return (
    isTransformableOgabasseyAssetPath(pathname) ||
    (pathname.startsWith(OGABASSEY_LEGACY_PRODUCT_IMAGE_PATH_PREFIX) &&
      TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(pathname))
  );
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
