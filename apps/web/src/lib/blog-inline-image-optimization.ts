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
// Codex inline images are named `inline-<n>.<ext>` (legacy) or
// `inline-<n>-<hash>.<ext>` (current), where <ext> is png/jpg/jpeg — the
// publisher generates `.avif`/`.webp` siblings for all of these. Match the full
// `inline-` family; anchor on the extension so sibling URLs (…png.avif) and
// non-inline images (featured variants) are excluded.
const INLINE_IMAGE_PATH_PATTERN = /\/inline-[^/?#]+\.(?:png|jpe?g)(?:[?#]|$)/i;

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
