import { getImageProps } from 'next/image';
import imageLoader from '@/lib/image-loader';
import {
  MOBILE_HERO_IMAGE_HEIGHT,
  MOBILE_HERO_IMAGE_SIZES,
  MOBILE_HERO_IMAGE_WIDTH,
  MOBILE_HERO_SOURCE_MEDIA,
  MOBILE_HERO_IMAGE_QUALITY,
  TRANSPARENT_PIXEL_SRC,
} from './hero-mobile-image-config';

interface MobileLcpHeroImageProps {
  alt: string;
  imageFit?: 'contain' | 'cover';
  inlineSrc?: string;
  shouldPrioritizeImage: boolean;
  src: string;
}

const WIDTH_DESCRIPTOR_PATTERN = /\s\d+w(?:,|$)/;

function ogabasseyHeroImageLoader({
  quality = MOBILE_HERO_IMAGE_QUALITY,
  src,
  width,
}: {
  quality?: number;
  src: string;
  width: number;
}) {
  return imageLoader({ quality, src, width });
}

function getResponsiveSizes(srcSetValue: string, sizesValue?: string) {
  return WIDTH_DESCRIPTOR_PATTERN.test(srcSetValue) ? sizesValue : undefined;
}

export function MobileLcpHeroImage({
  alt,
  imageFit,
  inlineSrc,
  shouldPrioritizeImage,
  src,
}: MobileLcpHeroImageProps) {
  const {
    props: { src: productSrc, srcSet, sizes, ...imgProps },
  } = getImageProps({
    alt,
    decoding: 'sync',
    fetchPriority: 'high',
    height: MOBILE_HERO_IMAGE_HEIGHT,
    loader: ogabasseyHeroImageLoader,
    loading: 'eager',
    quality: MOBILE_HERO_IMAGE_QUALITY,
    sizes: MOBILE_HERO_IMAGE_SIZES,
    src,
    width: MOBILE_HERO_IMAGE_WIDTH,
  });
  const productSrcSet = inlineSrc ?? srcSet ?? productSrc;
  const productSizes = getResponsiveSizes(
    productSrcSet,
    sizes ?? MOBILE_HERO_IMAGE_SIZES
  );

  return (
    <picture className="block h-full w-full">
      <source
        media={MOBILE_HERO_SOURCE_MEDIA}
        sizes={productSizes}
        srcSet={productSrcSet}
      />
      <img
        {...imgProps}
        alt={alt}
        fetchPriority={shouldPrioritizeImage ? 'high' : undefined}
        src={TRANSPARENT_PIXEL_SRC}
        className={`h-full w-full ${
          imageFit === 'contain' ? 'object-contain object-right' : 'object-cover'
        }`}
      />
    </picture>
  );
}
