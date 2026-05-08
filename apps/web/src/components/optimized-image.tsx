'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import {
  getFallbackImage,
  getProductBlurPlaceholder,
  getResponsiveSizes,
  isValidImageUrl,
} from '@/lib/image-utils';

/**
 * Optimized Image with Priority Hints and Blur Placeholders
 *
 * Features:
 * - Blur placeholder during load (smooth UX)
 * - Fetch priority hints for LCP optimization
 * - Automatic fallback for broken images
 * - Responsive sizing helpers
 * - Works with all merchant storefronts dynamically
 *
 * Priority Hints (fetchpriority) - Widely supported in 2025
 * - Chrome 101+, Edge 101+, Safari 17.2+, Firefox 119+
 */

type FetchPriority = 'high' | 'low' | 'auto';
type ImageLayout = 'grid' | 'full' | 'thumbnail' | 'hero';

interface OptimizedImageProps
  extends Omit<ImageProps, 'placeholder' | 'blurDataURL'> {
  /**
   * Fetch priority hint for the browser
   * - "high": Critical for LCP (hero images, product main image)
   * - "low": Below-fold, thumbnails, non-critical
   * - "auto": Browser decides (default)
   */
  fetchPriority?: FetchPriority;
  /**
   * Whether this image is the Largest Contentful Paint candidate
   * If true, will automatically set priority="high" and eagerly load
   */
  isLCP?: boolean;
  /**
   * Product category for contextual blur placeholder color
   */
  category?: string;
  /**
   * Layout type for automatic responsive sizes
   */
  layout?: ImageLayout;
  /**
   * Custom blur data URL (overrides category-based)
   */
  blurDataURL?: string;
  /**
   * Disable blur placeholder
   */
  disableBlur?: boolean;
  /**
   * Fallback image on error
   */
  fallbackSrc?: string;
}

export function OptimizedImage({
  fetchPriority = 'auto',
  isLCP = false,
  priority,
  loading,
  category,
  layout,
  blurDataURL,
  disableBlur = false,
  fallbackSrc,
  src,
  alt,
  sizes,
  onError,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // If marked as LCP image, override to high priority and eager loading
  const finalPriority = isLCP ? true : priority;
  const finalLoading = isLCP ? 'eager' : loading;
  const finalFetchPriority = isLCP ? 'high' : fetchPriority;

  // Generate blur placeholder
  const blur = disableBlur
    ? undefined
    : blurDataURL || getProductBlurPlaceholder(category);

  // Auto-generate sizes if layout specified
  const finalSizes = sizes || (layout ? getResponsiveSizes(layout) : undefined);

  // Handle image load error
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!hasError) {
      setHasError(true);
      const fallback = fallbackSrc || getFallbackImage(category);
      setImgSrc(fallback);
    }
    onError?.(e);
  };

  // Validate src
  const validSrc = isValidImageUrl(imgSrc as string)
    ? imgSrc
    : getFallbackImage(category);

  return (
    <Image
      {...props}
      src={validSrc}
      alt={alt}
      sizes={finalSizes}
      priority={finalPriority}
      loading={finalLoading}
      placeholder={blur ? 'blur-sm' : 'empty'}
      blurDataURL={blur}
      onError={handleError}
      fetchPriority={finalFetchPriority}
    />
  );
}

/**
 * Pre-configured components for common use cases
 */

/** Hero/banner images - critical for LCP */
export function HeroImage(
  props: Omit<OptimizedImageProps, 'isLCP' | 'fetchPriority' | 'layout'>
) {
  return <OptimizedImage {...props} isLCP fetchPriority="high" layout="hero" />;
}

/** Product main image on detail page - likely LCP */
export function ProductMainImage(
  props: Omit<OptimizedImageProps, 'fetchPriority' | 'layout'>
) {
  return <OptimizedImage {...props} fetchPriority="high" layout="full" />;
}

/** Product card images in grids - lazy load with blur */
export function ProductCardImage({
  priority,
  ...props
}: Omit<OptimizedImageProps, 'fetchPriority' | 'loading' | 'layout'> & {
  priority?: boolean;
}) {
  return (
    <OptimizedImage
      {...props}
      priority={priority}
      fetchPriority={priority ? 'high' : 'low'}
      loading={priority ? 'eager' : 'lazy'}
      layout="grid"
    />
  );
}

/** Thumbnail images (cart, gallery) - small, lazy */
export function ThumbnailImage(
  props: Omit<OptimizedImageProps, 'fetchPriority' | 'loading' | 'layout'>
) {
  return (
    <OptimizedImage
      {...props}
      fetchPriority="low"
      loading="lazy"
      layout="thumbnail"
    />
  );
}

/** Logo images - medium priority, no blur */
export function LogoImage(
  props: Omit<OptimizedImageProps, 'fetchPriority' | 'disableBlur'>
) {
  return <OptimizedImage {...props} fetchPriority="auto" disableBlur />;
}

/**
 * Skeleton placeholder for when image URL is not yet known
 */
export function ImagePlaceholder({
  className,
  aspectRatio = 'square',
}: {
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait';
}) {
  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-3/4',
  };

  return (
    <div
      className={`${aspectClasses[aspectRatio]} w-full bg-muted animate-pulse rounded-lg ${className || ''}`}
    />
  );
}
