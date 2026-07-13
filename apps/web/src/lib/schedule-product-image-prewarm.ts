import { after } from 'next/server';
import { prewarmOgabasseyImageTransforms } from '@/lib/ogabassey-image-prewarm';
import { HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';
import { getPrimaryProductImage } from '@/lib/product-image';

/**
 * Extract the raw image URLs from a product's `images` column so they can be
 * handed to the CDN transform prewarm. Mirrors the string/object shapes
 * `getPrimaryProductImage` already normalizes (`lib/product-image.ts`), but
 * returns every image instead of just the primary one. Takes `unknown`
 * because the row shape returned by the Supabase select-string types varies by
 * branch (not every product row assignment is typed with an `images` field
 * even though it is always present at runtime by the time this is called).
 *
 * Private — an implementation detail of the scheduler below, which is this
 * file's single public export (repo rule: one primary export per file).
 */
function extractProductImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image: unknown) =>
      typeof image === 'string'
        ? image
        : image && typeof image === 'object' && 'url' in image
          ? (image as { url?: unknown }).url
          : undefined
    )
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
}

/**
 * Pre-warm Cloudflare's image-transform cache for a product's images after a
 * write (create OR update). Accepts the raw `images` column value (any of the
 * string/`{ url }` shapes Supabase returns) and extracts the URLs internally.
 * Fire-and-forget: mirrors `schedulePurgeCloudflareUrls` in
 * `lib/cache-revalidation.ts` — uses `after()` when a request context exists
 * so the prewarm keeps running past the response flush, and falls back to a
 * detached promise otherwise (tests / non-request contexts).
 * `prewarmOgabasseyImageTransforms` never throws, so this never affects the
 * caller.
 *
 * Two independent invocations, each with its own per-invocation URL budget:
 *   1. the default product matrix (PDP hero + listing card) for EVERY image;
 *   2. the home-hero q70 tier for the PRIMARY image only — the sole image the
 *      home hero (hero-desktop-grid / mobile carousel) ever renders, warmed at
 *      a quality the default matrix deliberately omits. Splitting it out means
 *      it can never steal PDP/card coverage from a multi-image product update.
 *
 * Wired into both the create and update product routes so a brand-new product
 * that enters the launch/home hero never pays the cold q70 transform on its
 * first storefront request.
 */
export function scheduleProductImageTransformsPrewarm(images: unknown): void {
  const imagePaths = extractProductImageUrls(images);
  if (imagePaths.length === 0) {
    return;
  }

  const primaryImage = getPrimaryProductImage(imagePaths);

  const run = () =>
    Promise.all([
      prewarmOgabasseyImageTransforms(imagePaths),
      primaryImage
        ? prewarmOgabasseyImageTransforms([primaryImage], {
            widthQualityPairs: HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS,
          })
        : Promise.resolve(),
    ]);

  try {
    after(() => run());
  } catch {
    void run();
  }
}
