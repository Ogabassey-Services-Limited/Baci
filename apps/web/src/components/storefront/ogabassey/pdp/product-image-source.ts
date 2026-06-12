import {
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';

type SameOriginImageUrlInput = {
  productSlug: string;
  quality: number;
  width: number;
};

export function buildOgabasseyPdpSameOriginImageUrl({
  productSlug,
  quality,
  width,
}: SameOriginImageUrlInput): string {
  const searchParams = new URLSearchParams({
    width: String(width),
    quality: String(quality),
  });

  return `/api/ogabassey/pdp-lcp-image/${encodeURIComponent(
    productSlug
  )}?${searchParams.toString()}`;
}

export function buildOgabasseyPdpSameOriginProfileImageUrl(
  productSlug: string,
  profile: 'desktop' | 'mobile'
): string {
  return `/api/ogabassey/pdp-lcp-image/profile/${profile}/${encodeURIComponent(
    productSlug
  )}`;
}

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

export function buildOgabasseyPdpSameOriginMobileImageSrcSet(
  productSlug: string
): string {
  return OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS.map(
    (width) => {
      const imageUrl =
        width === OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_PRELOAD_WIDTH
          ? buildOgabasseyPdpSameOriginProfileImageUrl(productSlug, 'mobile')
          : buildOgabasseyPdpSameOriginImageUrl({
              productSlug,
              quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
              width,
            });

      return `${imageUrl} ${width}w`;
    }
  ).join(', ');
}
