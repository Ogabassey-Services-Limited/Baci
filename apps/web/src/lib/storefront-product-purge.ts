import { after } from 'next/server';
import { purgeCloudflareUrls } from '@/lib/cloudflare-purge';
import { scheduleStorefrontHostnamePurge } from '@/lib/storefront-product-purge-hostnames';
import {
  buildStorefrontProductPurgeUrls,
  countDistinctProductPurgeEntries,
  PURGE_WHOLE_STOREFRONT_THRESHOLD,
  type StorefrontProductPurgeEntry,
} from '@/lib/storefront-product-purge-urls';

export interface StorefrontProductPurgeOptions {
  /** Published blog posts whose related-product rail includes these products. */
  blogPostSlugs?: readonly string[];
}

/**
 * Fire-and-forget Cloudflare eviction of a product's affected public URLs.
 *
 * Mirrors the guarded schedule pattern in `cache-revalidation.ts`
 * (`revalidateBlogPosts`): it builds the URLs and schedules the purge inside a
 * try/catch so a purge is ALWAYS survivable (edge caches self-heal on their
 * TTL) and can NEVER throw into the product mutation path that calls it. Uses
 * `after()` when a request context exists (so the purge runs past the response
 * flush) and falls back to a detached promise in cron/worker/test contexts.
 * `purgeCloudflareUrls` itself never throws.
 *
 * `identifier` is the merchant slug (e.g. `ogabassey`) or one of its custom
 * hostnames. Storefronts without a public cache policy resolve to no hostnames
 * (empty URL list) and this is a silent no-op; so is a missing identifier or an
 * empty entry list.
 */
export function scheduleStorefrontProductPurge(
  identifier: string | null | undefined,
  entries: readonly StorefrontProductPurgeEntry[],
  options: StorefrontProductPurgeOptions = {}
): void {
  try {
    const normalizedIdentifier = identifier?.trim();
    if (!normalizedIdentifier || entries.length === 0) {
      return;
    }

    if (
      countDistinctProductPurgeEntries(entries) >
      PURGE_WHOLE_STOREFRONT_THRESHOLD
    ) {
      scheduleStorefrontHostnamePurge(normalizedIdentifier);
      return;
    }

    const urls = buildStorefrontProductPurgeUrls(
      [normalizedIdentifier],
      entries,
      options.blogPostSlugs
    );
    if (urls.length === 0) {
      return;
    }

    try {
      after(() => purgeCloudflareUrls(urls));
    } catch {
      // Not inside a request scope (standalone worker / test) — detach instead.
      void purgeCloudflareUrls(urls);
    }
  } catch (error) {
    console.warn('Skipped Cloudflare product purge scheduling', {
      identifier,
      entryCount: entries.length,
      error,
    });
  }
}
