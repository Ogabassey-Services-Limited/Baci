import {
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';
import {
  buildOgabasseyCdnFallbackImageLoaderUrl,
  isOgabasseyCdnImageUrl,
} from '@/lib/ogabassey-cdn-image-url';

type SameOriginImageUrlInput = {
  imageVersion?: string | null;
  productSlug: string;
  quality: number;
  width: number;
};

function addImageVersionParam(
  searchParams: URLSearchParams,
  imageVersion: string | null | undefined
): void {
  const normalizedVersion = imageVersion?.trim();
  if (normalizedVersion) {
    searchParams.set('v', normalizedVersion);
  }
}

function appendImageVersionQuery(
  path: string,
  imageVersion: string | null | undefined
): string {
  const searchParams = new URLSearchParams();
  addImageVersionParam(searchParams, imageVersion);
  const query = searchParams.toString();

  return query ? `${path}?${query}` : path;
}

function buildOgabasseyPdpSameOriginImageUrl({
  imageVersion,
  productSlug,
  quality,
  width,
}: SameOriginImageUrlInput): string {
  const encodedProductSlug = encodeURIComponent(productSlug);
  const searchParams = new URLSearchParams({
    width: String(width),
    quality: String(quality),
  });
  addImageVersionParam(searchParams, imageVersion);

  return `/api/ogabassey/pdp-lcp-image/${encodedProductSlug}?${searchParams.toString()}`;
}

export function buildOgabasseyPdpSameOriginProfileImageUrl(
  productSlug: string,
  profile: 'desktop' | 'mobile',
  imageVersion?: string | null
): string {
  const encodedProductSlug = encodeURIComponent(productSlug);

  return appendImageVersionQuery(
    `/api/ogabassey/pdp-lcp-image/profile/${profile}/${encodedProductSlug}`,
    imageVersion
  );
}

function buildOgabasseyPdpMobileImageUrl(src: string, width: number): string {
  if (isOgabasseyCdnImageUrl(src)) {
    return buildOgabasseyCdnFallbackImageLoaderUrl(
      src,
      width,
      OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY
    );
  }

  return imageLoader({
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
    src,
    width,
  });
}

export function buildOgabasseyPdpMobileImageSrcSet(src: string): string {
  return OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS.map(
    (width) => `${buildOgabasseyPdpMobileImageUrl(src, width)} ${width}w`
  ).join(', ');
}
