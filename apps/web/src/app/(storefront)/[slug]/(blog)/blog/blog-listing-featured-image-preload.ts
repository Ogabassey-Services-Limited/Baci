import 'server-only';
import { getImageProps } from 'next/image';
import { preload } from 'react-dom';
import { getOgabasseyImagePreloadType } from '@/app/(storefront)/ogabassey/ogabassey-image-preload-type';
import {
  BLOG_HERO_IMAGE_QUALITY,
  BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH,
  BLOG_LISTING_FEATURED_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/blog-media';
import { rewriteOgabasseyTransformUrlFormat } from '@/lib/ogabassey-cdn-image-url';
import { ogabasseyFallbackImageLoader } from '@/lib/ogabassey-image-fallback-loader';
import { buildOgabasseyAvifSrcSet } from '@/lib/ogabassey-image-format-sources';

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

  const {
    props: { sizes, srcSet },
  } = getImageProps({
    alt: '',
    fill: true,
    // Explicit shared loader for candidate parity with the rendered
    // `<picture>` — relying on the global loaderFile leaves room for the
    // preload srcset to diverge from what the picture actually requests.
    loader: ogabasseyFallbackImageLoader,
    quality: BLOG_LISTING_FEATURED_IMAGE_QUALITY,
    sizes: BLOG_LISTING_FEATURED_IMAGE_SIZES,
    src: preloadSrc,
  });
  const fallbackHref = ogabasseyFallbackImageLoader({
    quality: BLOG_LISTING_FEATURED_IMAGE_QUALITY,
    src: preloadSrc,
    width: BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH,
  });
  const imageSizes = sizes ?? BLOG_LISTING_FEATURED_IMAGE_SIZES;
  const fallbackSrcSet =
    srcSet ?? `${fallbackHref} ${BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH}w`;

  // Preload the exact tier the picture renders. AVIF-capable browsers get the
  // `image/avif` source, so the hint must too. `null` twins mean a non-CDN
  // image with no AVIF tier: preload the decodable fallback for everyone.
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
