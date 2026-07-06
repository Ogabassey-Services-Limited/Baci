import 'server-only';
import { getImageProps } from 'next/image';
import { preconnect, prefetchDNS, preload } from 'react-dom';
import { getOgabasseyImagePreloadType } from '@/app/(storefront)/ogabassey/ogabassey-image-preload-type';
import {
  MOBILE_HERO_IMAGE_HEIGHT,
  MOBILE_HERO_IMAGE_QUALITY,
  MOBILE_HERO_IMAGE_SIZES,
  MOBILE_HERO_IMAGE_WIDTH,
  MOBILE_HERO_SOURCE_MEDIA,
} from '@/components/storefront/ogabassey/components/hero-mobile-image-config';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';
import imageLoader from '@/lib/image-loader';
import { isOgabasseyCdnImageUrl } from '@/lib/ogabassey-cdn-image-url';

/**
 * Early resource hints for the home hero's slide-0 LCP image.
 *
 * Mirrors `blog-post-hero-resource-hints.ts`: a `preload()` whose
 * `imageSrcSet`/`imageSizes`/`quality` match `MobileLcpHeroImage`'s rendered
 * `<picture>` exactly, so browser preload-matching dedupes them into one
 * responsive fetch. The hint is what kills the measured ~6s LCP loadDelay —
 * without it the hero URL is only discoverable after the dynamic subtree
 * streams and hydrates.
 *
 * Media-scoped to the mobile source (the field LCP problem is mobile;
 * desktop's grid streams its own images), and emitted via react-dom
 * `preload()` — NEVER as rendered `<link>` nodes, which cause PPR resume
 * drift when they precede the first critical-shell host node (see the note
 * in `ogabassey-pdp-product-resource-hints.ts`).
 */
export function preloadOgabasseyHomeHeroResources(
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
    height: MOBILE_HERO_IMAGE_HEIGHT,
    quality: MOBILE_HERO_IMAGE_QUALITY,
    sizes: MOBILE_HERO_IMAGE_SIZES,
    src: candidate,
    width: MOBILE_HERO_IMAGE_WIDTH,
  });

  const href = imageLoader({
    quality: MOBILE_HERO_IMAGE_QUALITY,
    src: candidate,
    width: MOBILE_HERO_IMAGE_WIDTH,
  });

  preload(href, {
    as: 'image',
    fetchPriority: 'high',
    imageSizes: sizes ?? MOBILE_HERO_IMAGE_SIZES,
    imageSrcSet: srcSet ?? `${href} ${MOBILE_HERO_IMAGE_WIDTH}w`,
    media: MOBILE_HERO_SOURCE_MEDIA,
    type: getOgabasseyImagePreloadType(href),
  });
}
