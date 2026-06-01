import 'server-only';
import { getImageProps } from 'next/image';
import type { ComponentProps, ReactElement } from 'react';
import { createElement, Fragment } from 'react';
import { preload } from 'react-dom';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
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
  media?: string;
  rel: 'preload';
};

type ProductResourceHintInput = {
  src: string | null | undefined;
};

function buildProductImagePreloadProps({
  src,
}: ProductResourceHintInput): ImagePreloadLinkProps[] | null {
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

  const mobilePreloadSrc = imageLoader({
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
    src,
    width: OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  });
  const desktopPreloadSrc = imageLoader({
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    src,
    width: OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  });
  const imageSizes = sizes ?? OGABASSEY_PDP_PRIMARY_IMAGE_SIZES;
  const imageSrcSet =
    srcSet ??
    `${desktopPreloadSrc} ${OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH}w`;

  const mobileProps: ImagePreloadLinkProps = {
    as: 'image',
    fetchPriority: 'high',
    href: mobilePreloadSrc,
    imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
    imageSrcSet: buildOgabasseyPdpMobileImageSrcSet(src),
    media: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
    rel: 'preload',
    type: getOgabasseyImagePreloadType(mobilePreloadSrc),
  };

  const desktopProps: ImagePreloadLinkProps = {
    as: 'image',
    fetchPriority: 'high',
    href: desktopPreloadSrc,
    imageSizes,
    imageSrcSet,
    media: OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
    rel: 'preload',
    type: getOgabasseyImagePreloadType(desktopPreloadSrc),
  };

  return [mobileProps, desktopProps];
}

export function OgabasseyPdpProductResourceHints({
  src,
}: ProductResourceHintInput): ReactElement | null {
  const props = buildProductImagePreloadProps({ src });
  if (!props) return null;

  const mobilePreloadProps = props.find(
    (propSet) => propSet.media === OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA
  );

  if (mobilePreloadProps) {
    preload(mobilePreloadProps.href, {
      as: mobilePreloadProps.as,
      fetchPriority: mobilePreloadProps.fetchPriority,
      imageSizes: mobilePreloadProps.imageSizes,
      imageSrcSet: mobilePreloadProps.imageSrcSet,
      type: mobilePreloadProps.type,
    });
  }

  return createElement(
    Fragment,
    null,
    props.map((propSet) =>
      createElement('link', {
        ...propSet,
        key: propSet.media,
      })
    )
  );
}
