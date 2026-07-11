import 'server-only';
import { getImageProps } from 'next/image';
import { preconnect, prefetchDNS, preload } from 'react-dom';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';
import {
  isOgabasseyCdnImageUrl,
  rewriteOgabasseyTransformUrlFormat,
} from '@/lib/ogabassey-cdn-image-url';
import { ogabasseyFallbackImageLoader } from '@/lib/ogabassey-image-fallback-loader';
import { buildOgabasseyAvifSrcSet } from '@/lib/ogabassey-image-format-sources';
import { getOgabasseyImagePreloadType } from './ogabassey-image-preload-type';

type ProductResourceHintInput = {
  src: string | null | undefined;
};

/**
 * Early resource hints for the OgaBassey PDP hero (LCP) image.
 *
 * The preload MUST request byte-identical bytes to whatever the PDP hero
 * element paints, or the browser downloads an unused hint and then fetches the
 * real LCP image separately (the #3004 P1 regression). The PDP hero surfaces
 * — `OgabasseyPdpCriticalProductImage` (critical shell), the LCP skeleton, and
 * the hydrated `ProductMediaGallery` main image — now all render an explicit
 * per-format `<picture>` (AVIF `<source>` + jpeg/png `<img>` fallback) built
 * from the shared `ogabasseyFallbackImageLoader` + `buildOgabasseyAvifSrcSet`,
 * so this hint targets the SAME AVIF tier through the SAME builders.
 *
 * Cloudflare Free ignores `Vary: Accept`, so per-format URLs (not one
 * `format=auto` body) are the only way AVIF-capable browsers get AVIF while
 * non-AVIF browsers get decodable fallback bytes. AVIF-capable browsers (~93%)
 * preload the `image/avif` tier and dedupe it against the `<source>`;
 * non-AVIF browsers skip a preload whose `type` they cannot decode and
 * discover the fallback `<img>` inline in the shell. External (non-CDN) images
 * have no AVIF twin — preload the decodable fallback for everyone.
 */
function preloadOgabasseyPdpHeroImage(src: string): void {
  const {
    props: { srcSet, sizes },
  } = getImageProps({
    alt: '',
    fill: true,
    // Explicit shared loader for candidate parity with the rendered
    // `<picture>` — relying on the global loaderFile leaves room for the
    // preload srcset to diverge from what the picture actually requests.
    loader: ogabasseyFallbackImageLoader,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
    src,
  });

  const fallbackHref = ogabasseyFallbackImageLoader({
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    src,
    width: OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  });
  const imageSizes = sizes ?? OGABASSEY_PDP_PRIMARY_IMAGE_SIZES;
  const fallbackSrcSet =
    srcSet ??
    `${fallbackHref} ${OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH}w`;

  // Preload the exact tier the picture renders. AVIF-capable browsers get the
  // `image/avif` source, so the hint must too (candidate + type parity → one
  // deduped fetch). `null` twins mean a non-CDN image with no AVIF tier: fall
  // back to preloading the decodable fallback for everyone.
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

export function preloadOgabasseyPdpProductResources({
  src,
}: ProductResourceHintInput): void {
  if (!src) {
    return;
  }

  // The hero product image owns its own preload below, but the connection to
  // the CDN origin should open as early as possible in the static shell (not
  // gated behind connection()-dynamic layout code) so the TCP/TLS handshake is
  // already warm by the time gallery/thumbnail images request it. Only fire
  // this when the resolved image actually lives on the CDN so cold loads for
  // non-CDN merchants don't open an unused connection.
  if (isOgabasseyCdnImageUrl(src)) {
    prefetchDNS(OGABASSEY_CDN_ORIGIN);
    preconnect(OGABASSEY_CDN_ORIGIN);
  }

  // Keep PDP image hints out of the page body. Next/Vercel resume can drift
  // when rendered <link> nodes precede the first critical-shell host node, so
  // this emits a react-dom preload() rather than a rendered <link>.
  preloadOgabasseyPdpHeroImage(src);
}

export function OgabasseyPdpProductResourceHints({
  src,
}: ProductResourceHintInput): null {
  preloadOgabasseyPdpProductResources({ src });
  return null;
}
