import { after } from 'next/server';
import { prewarmOgabasseyImageTransforms } from '@/lib/ogabassey-image-prewarm';
import { BLOG_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';

/**
 * Pre-warm Cloudflare's image-transform cache for blog featured images after
 * a write that makes them publicly reachable (publish, image swap, scheduled
 * publish).
 *
 * The blog width×quality matrix is passed explicitly instead of relying on
 * the prewarm lib's default: the default matrix is the PRODUCT surfaces'
 * (PDP hero + listing card), and each invocation has a capped URL budget —
 * product prewarms must not spend that budget on blog-only variants, and
 * blog prewarms must not spend it on product variants no blog surface ever
 * requests.
 *
 * Fail-open, fire-and-forget: mirrors `schedulePrewarmProductImageTransforms`
 * in `app/api/products/[id]/route.ts` — uses `after()` when a request context
 * exists so the prewarm keeps running past the response flush, and falls back
 * to a detached promise otherwise (cron/tests/non-request contexts).
 * `prewarmOgabasseyImageTransforms` never throws, so this never affects the
 * caller.
 */
export function schedulePrewarmBlogImageTransforms(
  imageUrls: ReadonlyArray<string | null | undefined>
): void {
  // The whole body is guarded so the never-throws contract holds
  // mechanically — call sites run this between a committed write and the
  // response, where a scheduling failure must never surface to the caller.
  try {
    const urls = Array.from(
      new Set(
        imageUrls
          .map((url) => (typeof url === 'string' ? url.trim() : null))
          .filter((url): url is string => Boolean(url))
      )
    );
    if (urls.length === 0) {
      return;
    }

    const run = () =>
      prewarmOgabasseyImageTransforms(urls, {
        widthQualityPairs: BLOG_IMAGE_WIDTH_QUALITY_PAIRS,
      });

    try {
      after(run);
    } catch {
      void run();
    }
  } catch (error) {
    console.warn('Failed to schedule blog image prewarm', { error });
  }
}
