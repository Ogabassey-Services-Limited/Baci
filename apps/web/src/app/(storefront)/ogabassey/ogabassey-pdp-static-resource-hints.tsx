import 'server-only';
import { getImageProps } from 'next/image';
import type { ReactElement } from 'react';
import { FLASH_SALE_PROMO_IMAGE } from '@/components/storefront/ogabassey/components/hero-data';
import imageLoader from '@/lib/image-loader';
import { getOgabasseyImagePreloadType } from './ogabassey-image-preload-type';

// The PDP banner only renders in the desktop carousel; keep the preload
// desktop-scoped while matching BannerCarousel's fill image sizes.
const PDP_BANNER_PRELOAD_MEDIA = '(min-width: 768px)';
const PDP_BANNER_IMAGE_SIZES =
  '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px';

/**
 * PDP-only resource hints for the OgaBassey product detail page.
 *
 * The Flash Sale banner is client-only on PDP, so this server hint makes the
 * custom-loader-transformed LCP image discoverable during HTML parsing.
 */
export function OgabasseyPdpStaticResourceHints(): ReactElement {
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
  const preloadType = getOgabasseyImagePreloadType(src);

  return (
    <link
      rel="preload"
      as="image"
      href={src}
      fetchPriority="high"
      imageSizes={sizes}
      imageSrcSet={srcSet}
      media={PDP_BANNER_PRELOAD_MEDIA}
      type={preloadType}
    />
  );
}
