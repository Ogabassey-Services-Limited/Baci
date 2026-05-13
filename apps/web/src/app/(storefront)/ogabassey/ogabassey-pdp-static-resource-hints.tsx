import 'server-only';
import { getImageProps } from 'next/image';
import * as ReactDOM from 'react-dom';
import { FLASH_SALE_PROMO_IMAGE } from '@/components/storefront/ogabassey/components/hero-data';
import imageLoader from '@/lib/image-loader';

// The PDP banner only renders in the desktop carousel; keep the preload
// desktop-scoped while matching BannerCarousel's fill image sizes.
const PDP_BANNER_PRELOAD_MEDIA = '(min-width: 768px)';
const PDP_BANNER_IMAGE_SIZES =
  '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px';
const IMAGE_PRELOAD_TYPES = {
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

/**
 * PDP-only resource hints for the OgaBassey product detail page.
 *
 * The Flash Sale banner is client-only on PDP, so this server hint makes the
 * custom-loader-transformed LCP image discoverable during HTML parsing.
 */
export function OgabasseyPdpStaticResourceHints(): null {
  const {
    props: { src, srcSet, sizes },
  } = getImageProps({
    alt: '',
    fill: true,
    // Keep this explicit because Vitest/plain Node do not receive Next's
    // injected image config, and it mirrors BannerCarousel's loader output.
    loader: imageLoader,
    sizes: PDP_BANNER_IMAGE_SIZES,
    src: FLASH_SALE_PROMO_IMAGE,
  });
  const preloadType = getImagePreloadType(src);

  ReactDOM.preload(src, {
    as: 'image',
    fetchPriority: 'high',
    imageSizes: sizes,
    imageSrcSet: srcSet,
    media: PDP_BANNER_PRELOAD_MEDIA,
    type: preloadType,
  });

  return null;
}

function getImagePreloadType(src: string) {
  const transformedFormat = src.match(
    /(?:^|[?&/,])format=(avif|jpe?g|png|webp)(?:[&/,]|$)/i
  )?.[1];
  const extension =
    transformedFormat ?? src.match(/\.(avif|jpe?g|png|webp)(?:[?#].*)?$/i)?.[1];

  return extension
    ? IMAGE_PRELOAD_TYPES[
        extension.toLowerCase() as keyof typeof IMAGE_PRELOAD_TYPES
      ]
    : undefined;
}
