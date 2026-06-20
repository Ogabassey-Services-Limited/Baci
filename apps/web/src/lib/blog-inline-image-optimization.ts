import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';

/**
 * Inline blog body images (the codex content pipeline) are uploaded as raw PNGs
 * served at `.../inline-N.png`. A backfill generates pre-optimized AVIF/WebP
 * siblings at `<src>.avif` / `<src>.webp` (see
 * scripts/generate... / the CDN backfill). We serve those via a `<picture>` so
 * Cloudflare can cache each format under its own URL (content negotiation on a
 * single URL is cache-unsafe behind Cloudflare).
 *
 * ONLY trusted CDN inline images are rewritten — never external URLs, and never
 * the featured-image variants (which are already optimized .webp). If a sibling
 * is missing the browser falls back to the original `<img>` PNG, so the rewrite
 * is always safe.
 */
const INLINE_IMAGE_PATH_PATTERN = /\/inline-\d+\.png(?:[?#]|$)/i;

function getTrustedCdnOrigin(): string {
  return DEFAULT_BLOG_MEDIA_CDN_ORIGIN.replace(/\/+$/, '');
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

export interface InlineImageSiblings {
  avif: string;
  webp: string;
}

/**
 * Derive the pre-generated AVIF/WebP sibling URLs for a trusted CDN inline image.
 * Caller must gate on {@link isTrustedCdnInlineImage} first. Any query/hash is
 * preserved by inserting the suffix before it.
 */
export function buildInlineImageSiblings(src: string): InlineImageSiblings {
  const match = src.match(/^([^?#]+)([?#].*)?$/);
  const path = match?.[1] ?? src;
  const suffix = match?.[2] ?? '';
  return {
    avif: `${path}.avif${suffix}`,
    webp: `${path}.webp${suffix}`,
  };
}
