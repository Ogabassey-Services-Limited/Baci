import 'server-only';
import { getImageProps } from 'next/image';
import type { ComponentProps } from 'react';
import { preload } from 'react-dom';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';
import { getOgabasseyImagePreloadType } from './ogabassey-image-preload-type';

type ImagePreloadLinkProps = ComponentProps<'link'> & {
  as: 'image';
  fetchPriority: 'high';
  href: string;
  imageSizes: string;
  imageSrcSet: string;
  media?: string;
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
  const href = preloadHref;
  const resolvedImageSrcSet =
    srcSet ?? `${href} ${OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH}w`;

  return [
    {
      as: 'image',
      fetchPriority: 'high',
      href,
      imageSizes: desktopImageSizes,
      imageSrcSet: resolvedImageSrcSet,
      rel: 'preload',
      type: getOgabasseyImagePreloadType(href),
    },
  ];
}

export function preloadOgabasseyPdpProductResources({
  src,
}: ProductResourceHintInput): void {
  const props = buildProductImagePreloadProps({
    src,
  });
  if (!props.length) return;

  // Keep PDP image hints out of the page body. Next/Vercel resume can drift
  // when rendered <link> nodes precede the first critical-shell host node.
  // React 19.2.3 forwards imageSrcSet/imageSizes on preload(), so keep
  // the manual hint aligned with the critical next/image preload shape.
  for (const preloadProps of props) {
    const options: Parameters<typeof preload>[1] = {
      as: preloadProps.as,
      fetchPriority: preloadProps.fetchPriority,
      imageSizes: preloadProps.imageSizes,
      imageSrcSet: preloadProps.imageSrcSet,
      type: preloadProps.type,
    };

    if (preloadProps.media) {
      options.media = preloadProps.media;
    }

    preload(preloadProps.href, options);
  }
}

export function OgabasseyPdpProductResourceHints({
  src,
}: ProductResourceHintInput): null {
  preloadOgabasseyPdpProductResources({ src });
  return null;
}
