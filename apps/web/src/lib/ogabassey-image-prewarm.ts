import {
  OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_HEADER_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
} from '@/components/storefront/ogabassey/config/product-media';
import {
  buildOgabasseyCdnImageLoaderUrl,
  isOgabasseyCdnImageUrl,
} from '@/lib/ogabassey-cdn-image-url';

/**
 * Pre-warm Cloudflare's image-resizing transform cache for the exact width ×
 * quality variants next/image actually requests, at content-change time.
 *
 * A cold Cloudflare Image Resizing transform costs ~1.8s and is paid by the
 * FIRST visitor to request a given `width=W,quality=Q` variant of a source
 * image — for long-tail products that first visitor is most real traffic.
 * Firing HEAD/GET requests for the known variants right after content is
 * written means the transform is already cached at the edge by the time a
 * real visitor's browser asks for it. Covers the PDP hero and listing/grid
 * card widths today (see `PDP_HERO_WIDTH_QUALITY_PAIRS` /
 * `LISTING_CARD_WIDTH_QUALITY_PAIRS` below); blog hero coverage is a
 * documented follow-up, not yet wired to a call site.
 *
 * Fail-open contract (mirrors `lib/cloudflare-purge.ts`):
 *   - Never throws or rejects — every failure is swallowed.
 *   - No env/config dependency — this hits the public CDN directly, so
 *     unlike the Cloudflare API purge there is nothing that can be
 *     "unconfigured". It is always safe to call.
 *   - A prewarm failure is always survivable: the first real visitor just
 *     pays the cold-transform cost instead, exactly as before this existed.
 */

interface WidthQualityPair {
  quality: number;
  width: number;
}

// PDP hero: mirrors the mobile srcset widths next/image actually renders
// (product-image-source.ts `buildOgabasseyPdpMobileImageSrcSet`), the desktop
// preload width, and the mobile Link-header preload width
// (ogabassey-pdp-product-resource-hints.ts). The smallest mobile tier (256px)
// is dropped to keep this list small — the PDP hero `sizes` floor
// (`calc(100vw - 32px)`) rarely resolves to it on real devices.
const PDP_HERO_WIDTH_QUALITY_PAIRS: readonly WidthQualityPair[] = [
  {
    width: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS[1],
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  },
  {
    width: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS[2],
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  },
  {
    width: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_WIDTHS[3],
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  },
  {
    width: OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_PRELOAD_WIDTH,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  },
  {
    width: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_HEADER_PRELOAD_WIDTH,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  },
];

// Listing/grid card thumbnail (components/ProductCard.tsx), rendered with
// `sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"`. There is
// no shared width export for this surface, so these mirror the device-size
// buckets that `sizes` expression resolves to for common phone/tablet
// viewports. Quality mirrors `DEFAULT_IMAGE_QUALITY` in `lib/image-loader.ts`
// (75) — ProductCard renders without an explicit `quality` prop.
const LISTING_CARD_IMAGE_QUALITY = 75;
const LISTING_CARD_WIDTH_QUALITY_PAIRS: readonly WidthQualityPair[] = [
  { width: 384, quality: LISTING_CARD_IMAGE_QUALITY },
  { width: 640, quality: LISTING_CARD_IMAGE_QUALITY },
  { width: 750, quality: LISTING_CARD_IMAGE_QUALITY },
];

// NOTE: blog hero widths/quality (config/blog-media.ts) are intentionally
// NOT included here. This lib is only wired at the product-update call site
// today (see apps/web/src/app/api/products/[id]/route.ts); adding blog pairs
// with no blog call site would just waste part of the per-invocation URL
// budget priming variants no real request ever asks for. Add a
// `BLOG_HERO_WIDTH_QUALITY_PAIRS` set (mirroring the pattern below) when a
// blog post-write call site is wired.
const ALL_WIDTH_QUALITY_PAIRS: readonly WidthQualityPair[] = [
  ...PDP_HERO_WIDTH_QUALITY_PAIRS,
  ...LISTING_CARD_WIDTH_QUALITY_PAIRS,
];

// buildOgabasseyCdnImageLoaderUrl() only rewrites the URL into a
// `/image/width=...` transform when the path is a transformable product/blog
// asset; otherwise it returns the source unchanged. Probing once with an
// arbitrary width/quality tells us whether an image path is worth prewarming
// at all before we build the full pair list for it.
const TRANSFORM_URL_MARKER = '/image/width=';
const PROBE_WIDTH = 640;
const PROBE_QUALITY = 75;

// Bound the total work a single invocation can do — a bulk operation
// touching many products must never turn this best-effort optimization into
// an unbounded fan-out of outbound requests.
const MAX_PREWARM_URLS_PER_INVOCATION = 40;
const DEFAULT_PREWARM_CONCURRENCY = 4;
const DEFAULT_PREWARM_TIMEOUT_MS = 5000;

export interface PrewarmOgabasseyImageTransformsOptions {
  /** Max simultaneous in-flight requests. Defaults to 4. */
  concurrency?: number;
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number;
}

function isCdnTransformableUrl(imagePath: string): boolean {
  if (!isOgabasseyCdnImageUrl(imagePath)) {
    return false;
  }

  const probeUrl = buildOgabasseyCdnImageLoaderUrl(
    imagePath,
    PROBE_WIDTH,
    PROBE_QUALITY
  );
  return probeUrl.includes(TRANSFORM_URL_MARKER);
}

function buildTransformUrlsForImage(imagePath: string): string[] {
  if (!isCdnTransformableUrl(imagePath)) {
    return [];
  }

  return ALL_WIDTH_QUALITY_PAIRS.map(({ width, quality }) =>
    buildOgabasseyCdnImageLoaderUrl(imagePath, width, quality)
  );
}

function buildPrewarmUrls(imagePaths: string[]): string[] {
  const urls = new Set<string>();

  for (const imagePath of imagePaths) {
    if (typeof imagePath !== 'string' || imagePath.length === 0) {
      continue;
    }
    for (const url of buildTransformUrlsForImage(imagePath)) {
      urls.add(url);
    }
  }

  return Array.from(urls).slice(0, MAX_PREWARM_URLS_PER_INVOCATION);
}

/**
 * Fetch `url` to prime Cloudflare's transform cache, never throwing.
 *
 * Decision: try HEAD first (cheapest — no response body). Cloudflare's Image
 * Resizing proxy generally forwards HEAD like any reverse proxy, but if an
 * intermediate layer rejects the verb (405/501, or the request errors
 * outright rather than returning a clean status) we fall back to a ranged
 * GET (`Range: bytes=0-0`) which still forces the transform to execute and
 * be cached without downloading the full asset. A genuine non-2xx status
 * other than "method not supported" (e.g. 404) is treated as a real failure
 * and is not retried with GET.
 */
async function prewarmSingleUrl(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<boolean> {
  let shouldFallBackToRangedGet = false;

  try {
    const headResponse = await fetchImpl(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (headResponse.ok) {
      return true;
    }
    if (headResponse.status === 405 || headResponse.status === 501) {
      shouldFallBackToRangedGet = true;
    }
  } catch {
    // HEAD errored outright (network error, timeout, or the verb was
    // rejected at the connection level) — try the ranged GET fallback.
    shouldFallBackToRangedGet = true;
  }

  if (!shouldFallBackToRangedGet) {
    return false;
  }

  try {
    const getResponse = await fetchImpl(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return getResponse.ok || getResponse.status === 206;
  } catch {
    return false;
  }
}

/**
 * Pre-warm the Cloudflare image-transform cache for the given source image
 * paths/URLs. Non-CDN-hosted or non-transformable paths are silently
 * skipped. Safe to call fire-and-forget from any revalidation path — it
 * never throws and requires no environment configuration.
 */
export async function prewarmOgabasseyImageTransforms(
  imagePaths: string[],
  options: PrewarmOgabasseyImageTransformsOptions = {}
): Promise<void> {
  const urls = buildPrewarmUrls(imagePaths);
  if (urls.length === 0) {
    return;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PREWARM_TIMEOUT_MS;
  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? DEFAULT_PREWARM_CONCURRENCY, urls.length)
  );

  let failureCount = 0;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < urls.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const succeeded = await prewarmSingleUrl(
        urls[currentIndex],
        fetchImpl,
        timeoutMs
      );
      if (!succeeded) {
        failureCount += 1;
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } catch (error) {
    // Defense in depth: prewarmSingleUrl already swallows its own errors, so
    // this should be unreachable, but a prewarm failure must never propagate.
    console.warn('Ogabassey CDN image transform prewarm failed unexpectedly', {
      error,
    });
    return;
  }

  if (failureCount > 0) {
    console.warn('Ogabassey CDN image transform prewarm had failures', {
      failureCount,
      total: urls.length,
    });
  }
}
