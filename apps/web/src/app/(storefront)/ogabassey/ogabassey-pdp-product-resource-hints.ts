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
  rel: 'preload';
};

type ProductResourceHintInput = {
  src: string | null | undefined;
};

function buildProductImagePreloadProps({
  src,
}: ProductResourceHintInput): ImagePreloadLinkProps | null {
  if (!src) return null;

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
  const imageSizes = sizes ?? OGABASSEY_PDP_PRIMARY_IMAGE_SIZES;
  const imageSrcSet =
    srcSet ??
    `${preloadHref} ${OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH}w`;

  return {
    as: 'image',
    fetchPriority: 'high',
    href: preloadHref,
    imageSizes,
    imageSrcSet,
    rel: 'preload',
    type: getOgabasseyImagePreloadType(preloadHref),
  };
}

export function preloadOgabasseyPdpProductResources({
  src,
}: ProductResourceHintInput): void {
  const props = buildProductImagePreloadProps({ src });
  if (!props) return;

  // Keep PDP image hints out of the page body. Next/Vercel resume can drift
  // when rendered <link> nodes precede the first critical-shell host node.
  // React preload() does not support media, so use one responsive srcset/sizes
  // hint and let the browser choose the matching candidate.
  preload(props.href, {
    as: props.as,
    fetchPriority: props.fetchPriority,
    imageSizes: props.imageSizes,
    imageSrcSet: props.imageSrcSet,
    type: props.type,
  });
}

export function OgabasseyPdpProductResourceHints({
  src,
}: ProductResourceHintInput): null {
  preloadOgabasseyPdpProductResources({ src });
  return null;
}
