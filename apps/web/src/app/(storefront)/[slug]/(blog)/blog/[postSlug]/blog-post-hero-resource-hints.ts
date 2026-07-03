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
import imageLoader from '@/lib/image-loader';
import { isOgabasseyCdnImageUrl } from '@/lib/ogabassey-cdn-image-url';

/**
 * Emit early resource hints for the blog post hero LCP image.
 *
 * Mirrors the PDP hero hints (`ogabassey-pdp-product-resource-hints.ts`): a
 * `preload` whose `imageSrcSet`/`imageSizes`/`quality` match the rendered
 * next/image hero so the two dedupe into one responsive fetch, plus a
 * `preconnect`/`prefetchDNS` to the media CDN.
 *
 * Guarded to OgaBassey CDN-hosted images: those are the only sources routed
 * through the CDN transform loader, so only they can produce a preload URL that
 * matches what next/image renders. Non-CDN heroes still get next/image's own
 * `preload` link.
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
    quality: BLOG_HERO_IMAGE_QUALITY,
    sizes: BLOG_POST_HERO_IMAGE_SIZES,
    src: candidate,
  });

  const href = imageLoader({
    quality: BLOG_HERO_IMAGE_QUALITY,
    src: candidate,
    width: BLOG_POST_HERO_IMAGE_PRELOAD_WIDTH,
  });

  preload(href, {
    as: 'image',
    fetchPriority: 'high',
    imageSizes: sizes ?? BLOG_POST_HERO_IMAGE_SIZES,
    imageSrcSet: srcSet ?? `${href} ${BLOG_POST_HERO_IMAGE_PRELOAD_WIDTH}w`,
    type: getOgabasseyImagePreloadType(href),
  });
}
