import 'server-only';
import { getImageProps } from 'next/image';
import type { ComponentProps, ReactElement } from 'react';
import { createElement } from 'react';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';
import { getOgabasseyImagePreloadType } from './ogabassey-image-preload-type';

type ImagePreloadLinkProps = ComponentProps<'link'> & {
  fetchPriority: 'high';
  imageSizes: string;
  imageSrcSet: string;
};

export function OgabasseyPdpProductResourceHints({
  src,
}: {
  src: string | null | undefined;
}): ReactElement | null {
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

  return createElement('link', props);
}
