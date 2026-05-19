import 'server-only';
import { getImageProps } from 'next/image';
import type { ComponentProps, ReactElement } from 'react';
import { createElement } from 'react';
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

  const preloadSrc = imageLoader({
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    src,
    width: OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  });
  const imageSizes = sizes ?? OGABASSEY_PDP_PRIMARY_IMAGE_SIZES;
  const imageSrcSet = srcSet ?? `${preloadSrc} 640w`;

  const props: ImagePreloadLinkProps = {
    as: 'image',
    fetchPriority: 'high',
    href: preloadSrc,
    imageSizes,
    imageSrcSet,
    rel: 'preload',
    type: getOgabasseyImagePreloadType(preloadSrc),
  };

  return props;
}

export function preloadOgabasseyPdpProductImage({
  src,
}: ProductResourceHintInput): void {
  const props = buildProductImagePreloadProps({ src });
  if (!props) return;

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
}: ProductResourceHintInput): ReactElement | null {
  const props = buildProductImagePreloadProps({ src });
  if (!props) return null;

  return createElement('link', props);
}
