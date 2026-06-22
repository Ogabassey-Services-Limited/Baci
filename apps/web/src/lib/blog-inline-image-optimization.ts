import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';
import imageLoader from '@/lib/image-loader';

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

function buildResponsiveUrl(src: string, width: number): string {
  return imageLoader({
    src,
    width,
    quality: INLINE_IMAGE_QUALITY,
    preferOgabasseyTransform: true,
  });
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
export function buildInlineImageSiblings(src: string): InlineImageSiblings {
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
    width: BLOG_INLINE_IMAGE_WIDTH,
    height: BLOG_INLINE_IMAGE_HEIGHT,
  };
}
