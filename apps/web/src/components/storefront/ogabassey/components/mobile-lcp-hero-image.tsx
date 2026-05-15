import { getImageProps } from 'next/image';
import { HERO_MOBILE_LCP_FALLBACK_SRC } from './hero-data';
import {
  MOBILE_HERO_IMAGE_HEIGHT,
  MOBILE_HERO_IMAGE_QUALITY,
  MOBILE_HERO_IMAGE_SIZES,
  MOBILE_HERO_IMAGE_WIDTH,
  MOBILE_HERO_SOURCE_MEDIA,
  TRANSPARENT_PIXEL_SRC,
} from './hero-mobile-image-config';

interface MobileLcpHeroImageProps {
  alt: string;
  imageFit?: 'contain' | 'cover';
  isResolvedMobileViewport: boolean;
  shouldPrioritizeImage: boolean;
  src: string;
}

const WIDTH_DESCRIPTOR_PATTERN = /\s\d+w(?:,|$)/;

function getResponsiveSizes(srcSetValue: string, sizesValue?: string) {
  return WIDTH_DESCRIPTOR_PATTERN.test(srcSetValue) ? sizesValue : undefined;
}

export function MobileLcpHeroImage({
  alt,
  imageFit,
  isResolvedMobileViewport,
  shouldPrioritizeImage,
  src,
}: MobileLcpHeroImageProps) {
  const {
    props: { src: _avifSrc, srcSet, sizes, ...imgProps },
  } = getImageProps({
    alt,
    decoding: 'auto',
    fetchPriority: 'high',
    height: MOBILE_HERO_IMAGE_HEIGHT,
    loading: 'eager',
    quality: MOBILE_HERO_IMAGE_QUALITY,
    sizes: MOBILE_HERO_IMAGE_SIZES,
    src,
    unoptimized: true,
    width: MOBILE_HERO_IMAGE_WIDTH,
  });
  const {
    props: {
      sizes: fallbackSizes,
      src: fallbackSrc,
      srcSet: fallbackSrcSet,
    },
  } = getImageProps({
    alt,
    decoding: 'async',
    height: MOBILE_HERO_IMAGE_HEIGHT,
    loading: 'lazy',
    quality: MOBILE_HERO_IMAGE_QUALITY,
    sizes: MOBILE_HERO_IMAGE_SIZES,
    src: HERO_MOBILE_LCP_FALLBACK_SRC,
    unoptimized: true,
    width: MOBILE_HERO_IMAGE_WIDTH,
  });
  const avifSrcSet = srcSet ?? src;
  const avifSizes = getResponsiveSizes(
    avifSrcSet,
    sizes ?? MOBILE_HERO_IMAGE_SIZES
  );
  const resolvedFallbackSrcSet = fallbackSrcSet ?? fallbackSrc;
  const resolvedFallbackSizes = getResponsiveSizes(
    resolvedFallbackSrcSet,
    fallbackSizes ?? MOBILE_HERO_IMAGE_SIZES
  );

  return (
    <picture className="block h-full w-full">
      <source
        type="image/avif"
        media={MOBILE_HERO_SOURCE_MEDIA}
        sizes={avifSizes}
        srcSet={avifSrcSet}
      />
      <source
        type="image/jpeg"
        media={MOBILE_HERO_SOURCE_MEDIA}
        sizes={resolvedFallbackSizes}
        srcSet={resolvedFallbackSrcSet}
      />
      <img
        {...imgProps}
        fetchPriority={shouldPrioritizeImage ? 'high' : undefined}
        sizes={isResolvedMobileViewport ? resolvedFallbackSizes : undefined}
        src={isResolvedMobileViewport ? fallbackSrc : TRANSPARENT_PIXEL_SRC}
        srcSet={isResolvedMobileViewport ? resolvedFallbackSrcSet : undefined}
        className={`h-full w-full ${
          imageFit === 'contain' ? 'object-contain object-right' : 'object-cover'
        }`}
      />
    </picture>
  );
}
