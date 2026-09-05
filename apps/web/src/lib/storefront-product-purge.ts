import { after } from 'next/server';
import { purgeCloudflareUrls } from '@/lib/cloudflare-purge';
import { getProductBlogPostSlugs } from '@/lib/get-product-blog-post-slugs';
import { scheduleStorefrontHostnamePurge } from '@/lib/storefront-product-purge-hostnames';
import {
  buildStorefrontProductPurgeUrls,
  countDistinctProductPurgeEntries,
  PURGE_WHOLE_STOREFRONT_THRESHOLD,
  type StorefrontProductPurgeEntry,
} from '@/lib/storefront-product-purge-urls';
import { createPublicClient } from '@/lib/supabase/public';

interface StorefrontProductPurgeOptions {
  /** Merchant id used to resolve linked published blog post URLs. */
  merchantId?: string;
  /** Already-resolved post slugs, used when a product is deleted. */
  blogPostSlugs?: readonly string[];
}

function schedulePurge(urls: string[]): void {
  if (urls.length === 0) return;

  try {
    after(() => purgeCloudflareUrls(urls));
  } catch {
    // Not inside a request scope (standalone worker / test) — detach instead.
    void purgeCloudflareUrls(urls);
  }
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

    const productIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.productId?.trim())
          .filter((id): id is string => Boolean(id))
      )
    );
    const suppliedBlogPostSlugs = options.blogPostSlugs ?? [];

    if (options.merchantId?.trim() && productIds.length > 0) {
      const merchantId = options.merchantId.trim();
      const purgeWithLinkedBlogPosts = async () => {
        try {
          const linkedBlogPostSlugs = await getProductBlogPostSlugs(
            createPublicClient({
              clientInfo: 'baci-product-blog-purge',
              timeoutMs: 3_000,
            }),
            merchantId,
            productIds
          );
          const blogPostSlugs = Array.from(
            new Set([...suppliedBlogPostSlugs, ...linkedBlogPostSlugs])
          );
          schedulePurge(
            buildStorefrontProductPurgeUrls(
              [normalizedIdentifier],
              entries,
              blogPostSlugs
            )
          );
        } catch (error) {
          // Product URL invalidation remains useful if the optional relation
          // lookup is unavailable; the next request will self-heal the blog
          // document once its edge TTL expires.
          console.warn(
            'Failed to resolve linked blog posts for product purge; continuing with product URLs',
            { merchantId, error }
          );
          schedulePurge(
            buildStorefrontProductPurgeUrls(
              [normalizedIdentifier],
              entries,
              suppliedBlogPostSlugs
            )
          );
        }
      };

      try {
        after(purgeWithLinkedBlogPosts);
      } catch {
        // Not inside a request scope (standalone worker / test) — detach instead.
        void purgeWithLinkedBlogPosts();
      }
      return;
    }

    schedulePurge(
      buildStorefrontProductPurgeUrls(
        [normalizedIdentifier],
        entries,
        suppliedBlogPostSlugs
      )
    );
  } catch (error) {
    console.warn('Skipped Cloudflare product purge scheduling', {
      identifier,
      entryCount: entries.length,
      error,
    });
  }
}
