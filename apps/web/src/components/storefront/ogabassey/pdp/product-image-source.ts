import {
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';

export function buildOgabasseyPdpMobileImageSrcSet(src: string): string {
  return OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS.map(
    (width) =>
      `${imageLoader({
        quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
        src,
        width,
      })} ${width}w`
  ).join(', ');
}
