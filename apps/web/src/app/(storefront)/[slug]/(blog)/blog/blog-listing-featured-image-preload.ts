import 'server-only';
import { getImageProps } from 'next/image';
import { preload } from 'react-dom';
import imageLoader from '@/lib/image-loader';

const BLOG_LISTING_FEATURED_IMAGE_SIZES = '100vw';
const BLOG_LISTING_FEATURED_IMAGE_QUALITY = 75;
const BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH = 750;

function resolvePreloadableBlogImage(src: string | null | undefined) {
  const candidate = src?.trim();
  if (!candidate || candidate.startsWith('/')) {
    return null;
  }

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export function preloadBlogListingFeaturedImage(
  src: string | null | undefined
): void {
  const preloadSrc = resolvePreloadableBlogImage(src);
  if (!preloadSrc) return;

  const {
    props: { sizes, srcSet },
  } = getImageProps({
    alt: '',
    fill: true,
    quality: BLOG_LISTING_FEATURED_IMAGE_QUALITY,
    sizes: BLOG_LISTING_FEATURED_IMAGE_SIZES,
    src: preloadSrc,
  });
  const href = imageLoader({
    quality: BLOG_LISTING_FEATURED_IMAGE_QUALITY,
    src: preloadSrc,
    width: BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH,
  });

  preload(href, {
    as: 'image',
    fetchPriority: 'high',
    imageSizes: sizes,
    imageSrcSet:
      srcSet ?? `${href} ${BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH}w`,
  });
}
