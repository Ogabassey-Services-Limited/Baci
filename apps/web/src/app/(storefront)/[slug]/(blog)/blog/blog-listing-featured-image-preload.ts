import 'server-only';
import { getImageProps } from 'next/image';
import { preload } from 'react-dom';
import {
  BLOG_HERO_IMAGE_QUALITY,
  BLOG_LISTING_FEATURED_IMAGE_PRELOAD_WIDTH,
  BLOG_LISTING_FEATURED_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/blog-media';
import imageLoader from '@/lib/image-loader';

// Must stay in lockstep with the featured-story <Image> quality so the preload
// URL and the rendered image resolve to the same CDN transform (one fetch).
const BLOG_LISTING_FEATURED_IMAGE_QUALITY = BLOG_HERO_IMAGE_QUALITY;

function resolvePreloadableBlogImage(src: string | null | undefined) {
  const candidate = src?.trim();
  if (!candidate || candidate.startsWith('//')) {
    return null;
  }

  if (candidate.startsWith('/')) {
    return candidate === '/placeholder.png' ? null : candidate;
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
