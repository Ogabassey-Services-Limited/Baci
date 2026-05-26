import imageLoader from '@/lib/image-loader';

export const OGABASSEY_PDP_PRIMARY_IMAGE_SIZES =
  '(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), (max-width: 1439px) 40vw, 560px';

export const OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY = 35;

export const OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH = 640;

const OGABASSEY_PDP_MOBILE_MAX_TRANSFORM_WIDTH = 750;
const OGABASSEY_PDP_MOBILE_REQUEST_WIDTH_CEILING = 1080;

interface ProductMediaImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export function ogabasseyPdpPrimaryImageLoader({
  src,
  width,
  quality,
}: ProductMediaImageLoaderParams): string {
  const cappedWidth =
    width <= OGABASSEY_PDP_MOBILE_REQUEST_WIDTH_CEILING
      ? Math.min(width, OGABASSEY_PDP_MOBILE_MAX_TRANSFORM_WIDTH)
      : width;

  return imageLoader({ src, width: cappedWidth, quality });
}
