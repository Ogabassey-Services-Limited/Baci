import 'server-only';
import { getImageProps } from 'next/image';
import { preconnect, prefetchDNS, preload } from 'react-dom';
import { getOgabasseyImagePreloadType } from '@/app/(storefront)/ogabassey/ogabassey-image-preload-type';
import {
  BLOG_HERO_IMAGE_QUALITY,
  BLOG_POST_HERO_IMAGE_PRELOAD_WIDTH,
  BLOG_POST_HERO_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/blog-media';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';
import {
  isOgabasseyCdnImageUrl,
  rewriteOgabasseyTransformUrlFormat,
} from '@/lib/ogabassey-cdn-image-url';
import { ogabasseyFallbackImageLoader } from '@/lib/ogabassey-image-fallback-loader';
import { buildOgabasseyAvifSrcSet } from '@/lib/ogabassey-image-format-sources';

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

  const {
    props: { srcSet, sizes },
  } = getImageProps({
    alt: '',
    fill: true,
    // Explicit shared loader for candidate parity with the rendered
    // `<picture>` — relying on the global loaderFile leaves room for the
    // preload srcset to diverge from what the picture actually requests.
    loader: ogabasseyFallbackImageLoader,
    quality: BLOG_HERO_IMAGE_QUALITY,
    sizes: BLOG_POST_HERO_IMAGE_SIZES,
    src: candidate,
  });

  const fallbackHref = ogabasseyFallbackImageLoader({
    quality: BLOG_HERO_IMAGE_QUALITY,
    src: candidate,
    width: BLOG_POST_HERO_IMAGE_PRELOAD_WIDTH,
  });
  const imageSizes = sizes ?? BLOG_POST_HERO_IMAGE_SIZES;
  const fallbackSrcSet =
    srcSet ?? `${fallbackHref} ${BLOG_POST_HERO_IMAGE_PRELOAD_WIDTH}w`;

  // Preload the exact tier the picture renders. AVIF-capable browsers get the
  // `image/avif` source, so the hint must too (candidate + type parity → one
  // deduped fetch). A `null` twin means the CDN image is not transformable —
  // fall back to preloading the decodable fallback for everyone.
  const avifHref = rewriteOgabasseyTransformUrlFormat(fallbackHref, 'avif');
  const avifSrcSet = buildOgabasseyAvifSrcSet(fallbackSrcSet);

  if (avifHref && avifSrcSet) {
    preload(avifHref, {
      as: 'image',
      fetchPriority: 'high',
      imageSizes,
      imageSrcSet: avifSrcSet,
      type: 'image/avif',
    });
    return;
  }

  preload(fallbackHref, {
    as: 'image',
    fetchPriority: 'high',
    imageSizes,
    imageSrcSet: fallbackSrcSet,
    type: getOgabasseyImagePreloadType(fallbackHref),
  });
}
