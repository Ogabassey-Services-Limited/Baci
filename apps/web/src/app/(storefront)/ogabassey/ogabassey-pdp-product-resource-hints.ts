import 'server-only';
import { getImageProps } from 'next/image';
import type { ComponentProps } from 'react';
import { preload } from 'react-dom';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import { buildOgabasseyPdpSameOriginProfileImageUrl } from '@/components/storefront/ogabassey/pdp/product-image-source';
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
  productSlug?: string | null | undefined;
  src: string | null | undefined;
};

function buildProductImagePreloadProps({
  productSlug,
  src,
}: ProductResourceHintInput): ImagePreloadLinkProps[] {
  const sameOriginProductSlug = productSlug?.trim() || null;

  if (sameOriginProductSlug !== null) {
    const href = buildOgabasseyPdpSameOriginProfileImageUrl(
      sameOriginProductSlug,
      'desktop'
    );

    return [
      {
        as: 'image',
        fetchPriority: 'high',
        href,
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        imageSrcSet: `${href} ${OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_PRELOAD_WIDTH}w`,
        rel: 'preload',
        type: getOgabasseyImagePreloadType(href),
      },
    ];
  }

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
    sameOriginProductSlug === null
      ? (srcSet ??
        `${preloadHref} ${OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH}w`)
      : undefined;

  const href = preloadHref;
  const resolvedImageSrcSet =
    desktopImageSrcSet ??
    `${href} ${OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH}w`;

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
  productSlug,
  src,
}: ProductResourceHintInput): void {
  const props = buildProductImagePreloadProps({ productSlug, src });
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
  productSlug,
  src,
}: ProductResourceHintInput): null {
  preloadOgabasseyPdpProductResources({ productSlug, src });
  return null;
}
