'use client';

interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

/**
 * Custom image loader for next/image.
 *
 * Bypasses Vercel's /_next/image proxy for external CDN images that are
 * already optimized (AVIF on Cloudflare CDN, Supabase storage, etc.).
 * Vercel's image optimization servers get blocked by Cloudflare WAF/bot
 * protection, causing OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED (502).
 *
 * Since all merchant images are served from CDNs with proper caching,
 * re-optimizing them through Vercel is redundant and adds latency + cost.
 */
export default function imageLoader({
  src,
  width,
  quality,
}: ImageLoaderParams): string {
  // External URLs — serve directly from their CDN
  if (src.startsWith('https://') || src.startsWith('http://')) {
    return src;
  }

  // Local public assets bypass the optimizer in development so local previews
  // do not depend on the dev image proxy.
  if (
    process.env.NODE_ENV === 'development' &&
    src.startsWith('/') &&
    !src.startsWith('//')
  ) {
    return src;
  }

  const q = quality || 75;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${q}`;
}
