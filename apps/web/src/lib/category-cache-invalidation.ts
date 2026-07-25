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
  /** Hostnames a purge was ATTEMPTED for — not a delivery guarantee. */
  purgeAttemptedHostnames: string[];
  edgePurgeDelivered: boolean;
}

export async function invalidateCategoryCaches(input: {
  merchantId: string;
  /** Storefront identifiers (slug and/or custom domain) for hostname resolution. */
  merchantIdentifiers: readonly string[];
  /** Slug before the mutation, when it changed or the category was removed. */
  previousSlug?: string | null;
  /** Slug after the mutation, when the category still exists. */
  nextSlug?: string | null;
}): Promise<CategoryCacheInvalidationResult> {
  const slugs = Array.from(
    new Set(
      [input.previousSlug, input.nextSlug].filter(
        (slug): slug is string => typeof slug === 'string' && slug.length > 0
      )
    )
  );

  // Authoritative, synchronous: tag-based revalidation of the category surfaces.
  if (slugs.length === 0) {
    revalidateCategories(input.merchantId);
  } else {
    for (const slug of slugs) {
      revalidateCategories(input.merchantId, slug);
    }
  }

  const hostnames = buildStorefrontPublicationPurgeHostnames(
    input.merchantIdentifiers
  );

  if (hostnames.length === 0) {
    return {
      revalidatedSlugs: slugs,
      purgeAttemptedHostnames: [],
      edgePurgeDelivered: false,
    };
  }

  // Best effort: never let an edge-purge failure fail the mutation the merchant
  // already committed. Logged so the gap is visible rather than silent.
  let edgePurgeDelivered = false;
  try {
    const confirmation = await purgeCloudflareHostnamesConfirmed(hostnames);
    // `not_required` is a legitimate no-op (no Cloudflare configuration), so it
    // is not an error — but it is also not a delivered purge.
    edgePurgeDelivered = confirmation.ok && confirmation.reason === 'purged';
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

  return {
    revalidatedSlugs: slugs,
    purgeAttemptedHostnames: hostnames,
    edgePurgeDelivered,
  };
}
