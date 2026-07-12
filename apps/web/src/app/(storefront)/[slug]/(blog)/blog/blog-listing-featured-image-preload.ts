import 'server-only';
import { emitOgabasseyImagePreload } from '@/app/(storefront)/ogabassey/emit-ogabassey-image-preload';
import {
  BLOG_HERO_IMAGE_QUALITY,
  BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH,
  BLOG_LISTING_FEATURED_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/blog-media';

// Must stay in lockstep with the featured-story <Image> quality so the preload
// URL and the rendered image resolve to the same CDN transform (one fetch).
const BLOG_LISTING_FEATURED_IMAGE_QUALITY = BLOG_HERO_IMAGE_QUALITY;

function resolvePreloadableBlogImage(src: string | null | undefined) {
  const candidate = src?.trim();
  if (!candidate || candidate.startsWith('//')) {
    return null;
  }

  if (candidate.startsWith('/')) {
    return candidate === '/placeholder.png' ? null : candidate;
  }

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? candidate
      : null;
  } catch {
    return null;
  }
}

/**
 * Early high-priority preload for the blog listing featured-story LCP hero.
 *
 * The featured story renders an explicit per-format `<picture>` (AVIF
 * `<source>` + jpeg/png `<img>` fallback) via `CdnFormatImage`, so this hint
 * targets the SAME AVIF tier through the SAME shared builders
 * (`ogabasseyFallbackImageLoader` + `buildOgabasseyAvifSrcSet`) — byte-identical
 * `imageSrcSet`/`imageSizes` so AVIF-capable browsers dedupe the hint against
 * the rendered `<source>` into one fetch. Cloudflare Free ignores
 * `Vary: Accept`, so per-format URLs (not a single `format=auto` body) are the
 * only way AVIF-capable browsers get AVIF while non-AVIF browsers get decodable
 * bytes. External/non-CDN heroes have no AVIF twin — preload the decodable
 * fallback for everyone, exactly what the rendered plain `<img>` requests.
 */
export function preloadBlogListingFeaturedImage(
  src: string | null | undefined
): void {
  const preloadSrc = resolvePreloadableBlogImage(src);
  if (!preloadSrc) return;

  emitOgabasseyImagePreload({
    preloadWidth: BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH,
    quality: BLOG_LISTING_FEATURED_IMAGE_QUALITY,
    sizes: BLOG_LISTING_FEATURED_IMAGE_SIZES,
    src: preloadSrc,
  });
}
