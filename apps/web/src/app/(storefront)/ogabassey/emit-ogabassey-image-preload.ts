import 'server-only';
import { getImageProps } from 'next/image';
import { preload } from 'react-dom';
import { rewriteOgabasseyTransformUrlFormat } from '@/lib/ogabassey-cdn-image-url';
import { ogabasseyFallbackImageLoader } from '@/lib/ogabassey-image-fallback-loader';
import { buildOgabasseyAvifSrcSet } from '@/lib/ogabassey-image-format-sources';
import { getOgabasseyImagePreloadType } from './ogabassey-image-preload-type';

interface EmitOgabasseyImagePreloadInput {
  preloadWidth: number;
  quality: number;
  sizes: string;
  src: string;
}

export function emitOgabasseyImagePreload({
  preloadWidth,
  quality,
  sizes,
  src,
}: EmitOgabasseyImagePreloadInput): void {
  const {
    props: { sizes: resolvedSizes, srcSet },
  } = getImageProps({
    alt: '',
    fill: true,
    loader: ogabasseyFallbackImageLoader,
    quality,
    sizes,
    src,
  });
  const fallbackHref = ogabasseyFallbackImageLoader({
    quality,
    src,
    width: preloadWidth,
  });
  const imageSizes = resolvedSizes ?? sizes;
  const fallbackSrcSet = srcSet ?? `${fallbackHref} ${preloadWidth}w`;
  const avifHref = rewriteOgabasseyTransformUrlFormat(fallbackHref, 'avif');
  const avifSrcSet = buildOgabasseyAvifSrcSet(fallbackSrcSet);

  if (avifHref && avifSrcSet) {
    preload(avifHref, {
      as: 'image',
      fetchPriority: 'high',
      imageSizes,
      imageSrcSet: avifSrcSet,
      type: 'image/avif',
    });
    return;
  }

  preload(fallbackHref, {
    as: 'image',
    fetchPriority: 'high',
    imageSizes,
    imageSrcSet: fallbackSrcSet,
    type: getOgabasseyImagePreloadType(fallbackHref),
  });
}
