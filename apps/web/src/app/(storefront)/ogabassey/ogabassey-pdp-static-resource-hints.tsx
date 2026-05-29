import 'server-only';
import { getImageProps } from 'next/image';
import type { ComponentProps, ReactElement } from 'react';
import { preload } from 'react-dom';
import { FLASH_SALE_PROMO_IMAGE } from '@/components/storefront/ogabassey/components/hero-data';
import imageLoader from '@/lib/image-loader';
import { getOgabasseyImagePreloadType } from './ogabassey-image-preload-type';

// The PDP banner only renders in the desktop carousel; keep the preload
// desktop-scoped while matching BannerCarousel's fill image sizes.
const PDP_BANNER_PRELOAD_MEDIA = '(min-width: 768px)';
const PDP_BANNER_IMAGE_SIZES =
  '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px';

type StaticImagePreloadLinkProps = ComponentProps<'link'> & {
  as: 'image';
  fetchPriority: 'high';
  href: string;
  imageSizes: string;
  imageSrcSet: string;
  media: string;
  rel: 'preload';
};

function buildStaticImagePreloadProps(): StaticImagePreloadLinkProps {
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

  return {
    as: 'image',
    fetchPriority: 'high',
    href: src,
    imageSizes: sizes ?? PDP_BANNER_IMAGE_SIZES,
    imageSrcSet: srcSet ?? `${src} 3840w`,
    media: PDP_BANNER_PRELOAD_MEDIA,
    rel: 'preload',
    type: getOgabasseyImagePreloadType(src),
  };
}

export function preloadOgabasseyPdpStaticResources(): void {
  const props = buildStaticImagePreloadProps();

  // Keep PDP resource hints out of the page body; rendered <link> nodes before
  // the critical shell can drift from cached resume slots in Next/Vercel.
  preload(props.href, {
    as: props.as,
    fetchPriority: props.fetchPriority,
    imageSizes: props.imageSizes,
    imageSrcSet: props.imageSrcSet,
    media: props.media,
    type: props.type,
  });
}

/**
 * PDP-only resource hints for the OgaBassey product detail page.
 *
 * The Flash Sale banner is client-only on PDP, so this server hint makes the
 * custom-loader-transformed LCP image discoverable during HTML parsing.
 */
export function OgabasseyPdpStaticResourceHints(): ReactElement {
  const props = buildStaticImagePreloadProps();

  return (
    <link
      rel={props.rel}
      as={props.as}
      href={props.href}
      fetchPriority={props.fetchPriority}
      imageSizes={props.imageSizes}
      imageSrcSet={props.imageSrcSet}
      media={props.media}
      type={props.type}
    />
  );
}
