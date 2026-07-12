import 'server-only';
import { preconnect, prefetchDNS } from 'react-dom';
import { emitOgabasseyImagePreload } from '@/app/(storefront)/ogabassey/emit-ogabassey-image-preload';
import {
  BLOG_HERO_IMAGE_QUALITY,
  BLOG_POST_HERO_IMAGE_PRELOAD_WIDTH,
  BLOG_POST_HERO_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/blog-media';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';
import { isOgabasseyCdnImageUrl } from '@/lib/ogabassey-cdn-image-url';

/**
 * Emit early resource hints for the blog post hero LCP image.
 *
 * Mirrors the PDP hero hints (`ogabassey-pdp-product-resource-hints.ts`): the
 * blog post hero now renders an explicit per-format `<picture>` (AVIF
 * `<source>` + jpeg/png `<img>` fallback) via `CdnFormatImage`, so this hint
 * targets the SAME AVIF tier through the SAME shared builders
 * (`ogabasseyFallbackImageLoader` + `buildOgabasseyAvifSrcSet`). The preload's
 * `imageSrcSet`/`imageSizes` are byte-identical to what the rendered
 * `<source type="image/avif">` requests, so AVIF-capable browsers dedupe the
 * hint against the source into one responsive fetch. Cloudflare Free ignores
 * `Vary: Accept`, so per-format URLs (not a single `format=auto` body) are the
 * only way AVIF-capable browsers get AVIF while others get decodable bytes.
 *
 * Guarded to OgaBassey CDN-hosted images: only they carry an AVIF transform
 * twin, and only they can produce a preload URL matching what the picture
 * renders. Non-CDN heroes render a plain `<img>` (no AVIF source) and keep
 * their preload via `CdnFormatImage`'s own `preload` prop in `BlogPostShell`.
 */
export function preloadOgabasseyBlogPostHeroResources(
  src: string | null | undefined
): void {
  const candidate = src?.trim();
  if (!candidate || !isOgabasseyCdnImageUrl(candidate)) {
    return;
  }

  prefetchDNS(OGABASSEY_CDN_ORIGIN);
  preconnect(OGABASSEY_CDN_ORIGIN);

  emitOgabasseyImagePreload({
    preloadWidth: BLOG_POST_HERO_IMAGE_PRELOAD_WIDTH,
    quality: BLOG_HERO_IMAGE_QUALITY,
    sizes: BLOG_POST_HERO_IMAGE_SIZES,
    src: candidate,
  });
}
