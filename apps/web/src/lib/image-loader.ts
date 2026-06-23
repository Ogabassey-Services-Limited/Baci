import {
  isExternalPlaceholderImageUrl,
  PLACEHOLDER_IMAGE,
} from '@/lib/image-utils';
import {
  buildOgabasseyCdnImageLoaderUrl,
  isOgabasseyCdnImageUrl,
} from '@/lib/ogabassey-cdn-image-url';

interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

const DEFAULT_IMAGE_QUALITY = 75;
const MIN_TRANSFORM_WIDTH = 16;
const MAX_TRANSFORM_WIDTH = 3840;

/**
 * Custom image loader for next/image.
 *
 * Bypasses Vercel's /_next/image proxy for external CDN images that are
 * already optimized (AVIF on Cloudflare CDN, Supabase storage, etc.).
 * Vercel's image optimization servers get blocked by Cloudflare WAF/bot
 * protection, causing OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED (502).
 *
 * With images.loader='custom', this function must return the final URL for
 * every image. Local public assets therefore keep their direct path instead of
 * delegating back to /_next/image, which is reserved for Next's default
 * optimizer pipeline.
 */
export default function imageLoader({
  src,
  width,
  quality,
}: ImageLoaderParams): string {
  if (typeof src !== 'string') {
    return '';
  }

  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  // External URLs — serve directly from their CDN unless the source is an older
  // OgaBassey URL shape that needs normalization.
  if (src.startsWith('https://') || src.startsWith('http://')) {
    if (isExternalPlaceholderImageUrl(src)) {
      return PLACEHOLDER_IMAGE;
    }

    if (isOgabasseyCdnImageUrl(src)) {
      return buildOgabasseyCdnImageLoaderUrl(
        src,
        clampDimension(width),
        clampQuality(quality)
      );
    }

    return appendLoaderParams(src, width, quality);
  }

  // Local public assets and other app-local paths must resolve directly when a
  // custom loader is configured. Returning /_next/image here would send them to
  // a route owned by the default loader, which this app intentionally bypasses.
  return appendLoaderParams(src, width, quality);
}

function appendLoaderParams(src: string, width: number, quality?: number) {
  const hashIndex = src.indexOf('#');
  const base = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : '';
  const separator = base.includes('?') ? '&' : '?';
  const transformWidth = clampDimension(width);
  const transformQuality = clampQuality(quality);

  return `${base}${separator}w=${transformWidth}&q=${transformQuality}${hash}`;
}

function clampDimension(width: number): number {
  if (!Number.isFinite(width)) {
    return MAX_TRANSFORM_WIDTH;
  }

  return Math.max(
    MIN_TRANSFORM_WIDTH,
    Math.min(MAX_TRANSFORM_WIDTH, Math.round(width))
  );
}

function clampQuality(quality?: number): number {
  if (quality === undefined || !Number.isFinite(quality)) {
    return DEFAULT_IMAGE_QUALITY;
  }

  return Math.max(1, Math.min(100, Math.round(quality)));
}
