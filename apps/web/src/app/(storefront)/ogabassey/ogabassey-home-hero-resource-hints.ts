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
import {
  isOgabasseyCdnImageUrl,
  rewriteOgabasseyTransformUrlFormat,
} from '@/lib/ogabassey-cdn-image-url';
import { buildOgabasseyAvifSrcSet } from '@/lib/ogabassey-image-format-sources';

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
 * The hint targets the AVIF tier the picture renders for AVIF-capable browsers
 * (the ~93% majority): Cloudflare Free ignores `Vary: Accept`, so the picture
 * ships explicit per-format `<source>`s instead of one `format=auto` body, and
 * the preload must match the `image/avif` source or it fetches bytes the
 * browser never paints. Non-AVIF browsers skip a preload whose `type` they
 * cannot decode and discover the fallback `<source>` inline in the shell.
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

  try {
    prefetchDNS(OGABASSEY_CDN_ORIGIN);
    preconnect(OGABASSEY_CDN_ORIGIN);

    const {
      props: { srcSet, sizes },
    } = getImageProps({
      alt: '',
      height: MOBILE_HERO_IMAGE_HEIGHT,
      // Explicit loader for candidate parity with MobileLcpHeroImage's
      // rendered <source> — relying on the global loaderFile leaves room for
      // the preload srcset to diverge from what the picture actually requests.
      loader: imageLoader,
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
    const imageSizes = sizes ?? MOBILE_HERO_IMAGE_SIZES;
    const fallbackSrcSet = srcSet ?? `${href} ${MOBILE_HERO_IMAGE_WIDTH}w`;

    // Preload the exact tier the picture renders. AVIF-capable browsers get
    // the `image/avif` source, so the hint must too (candidate + type parity
    // → one deduped fetch). `null` twins mean an external image with no AVIF
    // tier: fall back to preloading the decodable fallback for everyone.
    const avifHref = rewriteOgabasseyTransformUrlFormat(href, 'avif');
    const avifSrcSet = buildOgabasseyAvifSrcSet(fallbackSrcSet);

    if (avifHref && avifSrcSet) {
      preload(avifHref, {
        as: 'image',
        fetchPriority: 'high',
        imageSizes,
        imageSrcSet: avifSrcSet,
        media: MOBILE_HERO_SOURCE_MEDIA,
        type: 'image/avif',
      });
    } else {
      preload(href, {
        as: 'image',
        fetchPriority: 'high',
        imageSizes,
        imageSrcSet: fallbackSrcSet,
        media: MOBILE_HERO_SOURCE_MEDIA,
        type: getOgabasseyImagePreloadType(href),
      });
    }
  } catch (error) {
    // Fail-open: an optimization hint must never break the shell render.
    console.error('Failed to emit home hero preload hints', { error });
  }
}
