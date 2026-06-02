import 'server-only';
import { getImageProps } from 'next/image';
import type { ComponentProps } from 'react';
import { preload } from 'react-dom';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS,
  OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import { buildOgabasseyPdpMobileImageSrcSet } from '@/components/storefront/ogabassey/pdp/product-image-source';
import imageLoader from '@/lib/image-loader';
import { getOgabasseyImagePreloadType } from './ogabassey-image-preload-type';

type ImagePreloadLinkProps = ComponentProps<'link'> & {
  as: 'image';
  fetchPriority: 'high';
  href: string;
  imageSizes: string;
  imageSrcSet: string;
  media: string;
  rel: 'preload';
};

type ProductResourceHintInput = {
  src: string | null | undefined;
};

function buildProductImagePreloadProps({
  src,
}: ProductResourceHintInput): ImagePreloadLinkProps[] {
  if (!src) return [];

  const {
    props: { srcSet, sizes },
  } = getImageProps({
    alt: '',
    fill: true,
    loader: imageLoader,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
    src,
  });

  const preloadHref = imageLoader({
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    src,
    width: OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  });
  const desktopImageSizes = sizes ?? OGABASSEY_PDP_PRIMARY_IMAGE_SIZES;
  const desktopImageSrcSet =
    srcSet ??
    `${preloadHref} ${OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH}w`;

  const mobilePreloadWidth =
    OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS[
      OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS.length - 1
    ] ?? OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH;
  const mobilePreloadHref = imageLoader({
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
    src,
    width: mobilePreloadWidth,
  });

  return [
    {
      as: 'image',
      fetchPriority: 'high',
      href: mobilePreloadHref,
      imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
      imageSrcSet: buildOgabasseyPdpMobileImageSrcSet(src),
      media: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
      rel: 'preload',
      type: getOgabasseyImagePreloadType(mobilePreloadHref),
    },
    {
      as: 'image',
      fetchPriority: 'high',
      href: preloadHref,
      imageSizes: desktopImageSizes,
      imageSrcSet: desktopImageSrcSet,
      media: OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
      rel: 'preload',
      type: getOgabasseyImagePreloadType(preloadHref),
    },
  ];
}

export function preloadOgabasseyPdpProductResources({
  src,
}: ProductResourceHintInput): void {
  const props = buildProductImagePreloadProps({ src });
  if (!props.length) return;

  // Keep PDP image hints out of the page body. Next/Vercel resume can drift
  // when rendered <link> nodes precede the first critical-shell host node.
  // React 19.2.3 forwards media/imageSrcSet/imageSizes on preload(), so keep
  // the mobile hint aligned to the critical <picture> source while preserving
  // the desktop fallback image preload.
  for (const preloadProps of props) {
    preload(preloadProps.href, {
      as: preloadProps.as,
      fetchPriority: preloadProps.fetchPriority,
      imageSizes: preloadProps.imageSizes,
      imageSrcSet: preloadProps.imageSrcSet,
      media: preloadProps.media,
      type: preloadProps.type,
    });
  }
}

export function OgabasseyPdpProductResourceHints({
  src,
}: ProductResourceHintInput): null {
  preloadOgabasseyPdpProductResources({ src });
  return null;
}
