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
 * With images.loader='custom', this function must return the final URL for
 * every image. Local public assets therefore keep their direct path instead of
 * delegating back to /_next/image, which is reserved for Next's default
 * optimizer pipeline.
 */
export default function imageLoader({ src }: ImageLoaderParams): string {
  // External URLs — serve directly from their CDN
  if (src.startsWith('https://') || src.startsWith('http://')) {
    return src;
  }

  // Local public assets and other app-local paths must resolve directly when a
  // custom loader is configured. Returning /_next/image here would send them to
  // a route owned by the default loader, which this app intentionally bypasses.
  return src;
}
