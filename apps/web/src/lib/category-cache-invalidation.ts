import { after } from 'next/server';
import { revalidateCategories } from '@/lib/cache-revalidation';
import { purgeCloudflareHostnamesConfirmed } from '@/lib/cloudflare-purge';
import { logger } from '@/lib/logger';
import { buildStorefrontPublicationPurgeHostnames } from '@/lib/storefront-publication-purge-hostnames';

/**
 * Cache invalidation for a category mutation (B1-lite).
 *
 * Two deliberate properties:
 *
 * 1. **Both slugs.** A rename invalidates the OLD slug as well as the new one —
 *    otherwise the previous category URL keeps serving from cache after the
 *    route stops existing. Callers must capture the pre-mutation slug.
 * 2. **Best effort at the edge.** Next revalidation is authoritative and
 *    synchronous; the Cloudflare purge is explicitly best-effort — it is not
 *    awaited into the response path and a failure is logged, never thrown.
 *    Cache directives are unchanged by this module; it only invalidates.
 *
 * Returns what was attempted so routes/telemetry can report it honestly.
 */
export interface CategoryCacheInvalidationResult {
  revalidatedSlugs: string[];
  /** False when tag revalidation threw AFTER the mutation had committed. */
  revalidated: boolean;
  /** Hostnames a purge was scheduled for — not a delivery guarantee. */
  purgeAttemptedHostnames: string[];
  edgePurgeScheduled: boolean;
}

export function invalidateCategoryCaches(input: {
  merchantId: string;
  /** Storefront identifiers (slug and/or custom domain) for hostname resolution. */
  merchantIdentifiers: readonly string[];
  /** Slug before the mutation, when it changed or the category was removed. */
  previousSlug?: string | null;
  /** Slug after the mutation, when the category still exists. */
  nextSlug?: string | null;
}): CategoryCacheInvalidationResult {
  const slugs = Array.from(
    new Set(
      [input.previousSlug, input.nextSlug].filter(
        (slug): slug is string => typeof slug === 'string' && slug.length > 0
      )
    )
  );

  // Tag revalidation is synchronous, but the DB mutation has ALREADY committed
  // by the time we get here — so a throwing cache backend must not surface as a
  // 500. A client retrying a "failed" create would hit a duplicate-slug 409 for
  // a category that actually exists. Report the failure instead of raising it.
  let revalidated = true;
  try {
    if (slugs.length === 0) {
      revalidateCategories(input.merchantId);
    } else {
      for (const slug of slugs) {
        revalidateCategories(input.merchantId, slug);
      }
    }
  } catch (error) {
    revalidated = false;
    logger.error({
      message: 'Category revalidation failed AFTER the mutation committed',
      merchantId: input.merchantId,
      slugs,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const hostnames = buildStorefrontPublicationPurgeHostnames(
    input.merchantIdentifiers
  );

  if (hostnames.length === 0) {
    return {
      revalidatedSlugs: slugs,
      revalidated,
      purgeAttemptedHostnames: [],
      edgePurgeScheduled: false,
    };
  }

  // Best effort AND off the response path: the purge helper has a 5s timeout, so
  // awaiting it would add seconds to every merchant-facing write whenever
  // Cloudflare is slow. `after()` runs it once the response is flushed; failures
  // are logged, never thrown.
  after(async () => {
    try {
      const confirmation = await purgeCloudflareHostnamesConfirmed(hostnames);
      if (!confirmation.ok) {
        logger.warn({
          message: 'Category edge purge not delivered (best effort)',
          merchantId: input.merchantId,
          hostnames,
          slugs,
          reason: confirmation.reason,
        });
      }
    } catch (error) {
      logger.warn({
        message: 'Category edge purge failed (best effort)',
        merchantId: input.merchantId,
        hostnames,
        slugs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return {
    revalidatedSlugs: slugs,
    revalidated,
    purgeAttemptedHostnames: hostnames,
    // Scheduled, not confirmed — delivery happens after the response flushes.
    edgePurgeScheduled: true,
  };
}
