import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';

/**
 * Inline blog body images (the codex content pipeline) are uploaded as raw PNGs
 * served at `.../inline-N-<hash>.png` with pre-optimized AVIF/WebP siblings at
 * `<src>.avif` / `<src>.webp`. We serve those via a `<picture>` so Cloudflare
 * can cache each format under its own URL (content negotiation on a single URL
 * is cache-unsafe behind Cloudflare).
 *
 * Only rewrite hashed inline images because the hash is the positive signal
 * that generated siblings exist. Never synthesize `<source>` URLs for legacy
 * plain `inline-N` images, external URLs, or featured-image variants. Browsers
 * choose a `<source>` by `srcset`/`type` before fetching and do not retry the
 * `<img>` fallback after a chosen source 404s.
 */
// Accept current `inline-<n>-<hash>.<ext>` URLs. Anchor on the extension so
// generated siblings (…png.avif) and non-inline images (featured variants) are
// excluded.
const INLINE_IMAGE_PATH_PATTERN =
  /\/inline-\d+-[a-z0-9]{8,}\.(?:png|jpe?g)(?:[?#]|$)/i;

function getTrustedCdnOrigin(): string {
  // Match the origin the rest of the blog media helpers use
  // (blog-managed-storage-paths.ts), so configured deployments are honored —
  // not just the compile-time default. NEXT_PUBLIC_ vars are inlined for the
  // client bundle, so read process.env directly to avoid the server env module.
  const origin =
    process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN ||
    DEFAULT_BLOG_MEDIA_CDN_ORIGIN;
  return origin.replace(/\/+$/, '');
}

export function isTrustedCdnInlineImage(
  src: string | null | undefined
): src is string {
  if (!src) {
    return false;
  }
  return (
    src.startsWith(`${getTrustedCdnOrigin()}/`) &&
    INLINE_IMAGE_PATH_PATTERN.test(src)
  );
}

const INLINE_IMAGE_SRCSET_WIDTHS = [384, 640, 828, 1080, 1200] as const;
const INLINE_IMAGE_FALLBACK_WIDTH = 828;
const INLINE_IMAGE_QUALITY = 70;
const CDN_IMAGE_TRANSFORM_PREFIX = '/image/';
const TRANSFORMABLE_IMAGE_EXTENSION_PATTERN = /\.(?:avif|jpe?g|png|webp)$/i;
const TRANSFORM_DIMENSION_KEYS = ['width', 'w', 'height', 'h'] as const;
const TRANSFORM_RESERVED_KEYS = new Set([
  'width',
  'w',
  'height',
  'h',
  'quality',
  'q',
  'format',
  'f',
]);
export const BLOG_INLINE_IMAGE_SIZES =
  '(max-width: 768px) calc(100vw - 3rem), 800px';
export const BLOG_INLINE_IMAGE_WIDTH = 1200;
export const BLOG_INLINE_IMAGE_HEIGHT = 675;

export interface InlineImageSiblings {
  avif: string;
  webp: string;
  fallback: string;
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrcSet: string;
  sizes: string;
  width: number;
  height: number;
}

function parseTransformSegment(transformSegment: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const part of transformSegment.split(',')) {
    const equalsIndex = part.indexOf('=');
    const key = (equalsIndex >= 0 ? part.slice(0, equalsIndex) : part).trim();
    if (key) {
      params.set(
        key,
        equalsIndex >= 0 ? part.slice(equalsIndex + 1).trim() : ''
      );
    }
  }
  return params;
}

function buildTransformSegment(
  params: Map<string, string>,
  width: number
): string {
  const pinnedQuality = params.get('quality') || params.get('q');
  const quality = pinnedQuality || String(INLINE_IMAGE_QUALITY);
  const format = params.get('format') || params.get('f') || 'auto';
  const extras = Array.from(params.entries())
    .filter(([key]) => !TRANSFORM_RESERVED_KEYS.has(key))
    .map(([key, value]) => `${key}=${value}`);

  return [
    `width=${width}`,
    `quality=${quality}`,
    `format=${format}`,
    ...extras,
  ].join(',');
}

function buildTrustedCdnTransformUrl(
  src: string,
  width: number
): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }

  if (url.origin !== getTrustedCdnOrigin()) {
    return null;
  }

  if (!url.pathname.startsWith(CDN_IMAGE_TRANSFORM_PREFIX)) {
    if (!TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(url.pathname)) {
      return null;
    }

    return `${url.origin}${CDN_IMAGE_TRANSFORM_PREFIX}width=${width},quality=${INLINE_IMAGE_QUALITY},format=auto${url.pathname}${url.search}${url.hash}`;
  }

  const remainder = url.pathname.slice(CDN_IMAGE_TRANSFORM_PREFIX.length);
  const separatorIndex = remainder.indexOf('/');
  if (separatorIndex <= 0) {
    return null;
  }

  const transformSegment = remainder.slice(0, separatorIndex);
  const assetPath = remainder.slice(separatorIndex);
  if (!TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(assetPath)) {
    return null;
  }

  const params = parseTransformSegment(transformSegment);
  for (const dimensionKey of TRANSFORM_DIMENSION_KEYS) {
    if (params.get(dimensionKey)) {
      return src;
    }
  }

  return `${url.origin}${CDN_IMAGE_TRANSFORM_PREFIX}${buildTransformSegment(params, width)}${assetPath}${url.search}${url.hash}`;
}

function buildResponsiveUrl(src: string, width: number): string {
  const transformed = buildTrustedCdnTransformUrl(src, width);
  if (transformed) {
    return transformed;
  }

  const hashIndex = src.indexOf('#');
  const base = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : '';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}w=${width}&q=${INLINE_IMAGE_QUALITY}${hash}`;
}

function buildResponsiveSrcSet(src: string): string {
  return INLINE_IMAGE_SRCSET_WIDTHS.map(
    (width) => `${buildResponsiveUrl(src, width)} ${width}w`
  ).join(', ');
}

/**
 * Derive the pre-generated AVIF/WebP sibling URLs for a trusted CDN inline image.
 * Caller must gate on {@link isTrustedCdnInlineImage} first. Any query/hash is
 * preserved by inserting the suffix before it.
 */
export function buildInlineImageSiblings(
  src: string,
  dimensions: Partial<Pick<InlineImageSiblings, 'width' | 'height'>> = {}
): InlineImageSiblings {
  const match = src.match(/^([^?#]+)([?#].*)?$/);
  const path = match?.[1] ?? src;
  const suffix = match?.[2] ?? '';
  const avif = `${path}.avif${suffix}`;
  const webp = `${path}.webp${suffix}`;

  return {
    avif,
    webp,
    fallback: buildResponsiveUrl(src, INLINE_IMAGE_FALLBACK_WIDTH),
    avifSrcSet: buildResponsiveSrcSet(avif),
    webpSrcSet: buildResponsiveSrcSet(webp),
    fallbackSrcSet: buildResponsiveSrcSet(src),
    sizes: BLOG_INLINE_IMAGE_SIZES,
    width: dimensions.width || BLOG_INLINE_IMAGE_WIDTH,
    height: dimensions.height || BLOG_INLINE_IMAGE_HEIGHT,
  };
}
