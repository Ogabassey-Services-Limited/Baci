import 'server-only';

import { purgeCloudflareHostnamesConfirmed } from '@/lib/cloudflare-purge';
import { buildMerchantPublicationDataCacheTags } from '@/lib/merchant-publication-data-cache-tags';
import { productCacheRevalidation } from '@/lib/product-cache-revalidation';
import { revalidateCategories } from '@/lib/revalidate-categories';
import { buildStorefrontPublicationCacheTags } from '@/lib/storefront-publication-cache-tags';
import { buildStorefrontPublicationPurgeHostnames } from '@/lib/storefront-publication-purge-hostnames';
import { purgeVercelStorefrontPublicationCache } from '@/lib/vercel-storefront-publication-cache';

const OGABASSEY_CANONICAL_SLUG = 'ogabassey';
const OGABASSEY_HOSTNAMES = ['ogabassey.com', 'www.ogabassey.com'] as const;

export type StorefrontCategoryCacheBarrierResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'merchant_not_canary'
        | 'not_running_on_vercel'
        | 'unexpected_hostnames'
        | 'category_revalidation_failed'
        | 'product_revalidation_failed'
        | 'vercel_purge_failed'
        | 'cloudflare_purge_failed';
    };

function hasExactOgaBasseyHostnames(hostnames: readonly string[]): boolean {
  return (
    hostnames.length === OGABASSEY_HOSTNAMES.length &&
    hostnames.every(
      (hostname, index) => hostname === OGABASSEY_HOSTNAMES[index]
    )
  );
}

function getCategorySlugs({
  nextSlug,
  previousSlug,
  relatedSlugs,
}: {
  nextSlug: string | null;
  previousSlug: string | null;
  relatedSlugs: readonly string[];
}): string[] {
  return Array.from(
    new Set(
      [previousSlug, nextSlug, ...relatedSlugs].filter((slug): slug is string =>
        Boolean(slug)
      )
    )
  );
}

/**
 * Runs one all-or-nothing *receipt* barrier. Individual cache providers cannot
 * roll back, so a failed stage returns no receipt and a later delivery retry
 * restarts the same idempotent sequence from the innermost cache.
 */
export async function runStorefrontCategoryCacheBarrier({
  canaryMerchantId,
  merchantId,
  nextSlug,
  previousSlug,
  relatedSlugs,
}: {
  canaryMerchantId: string | undefined;
  merchantId: string;
  nextSlug: string | null;
  previousSlug: string | null;
  relatedSlugs: readonly string[];
}): Promise<StorefrontCategoryCacheBarrierResult> {
  if (!canaryMerchantId || merchantId !== canaryMerchantId) {
    return { ok: false, reason: 'merchant_not_canary' };
  }

  const identifiers = [OGABASSEY_CANONICAL_SLUG, ...OGABASSEY_HOSTNAMES];
  const hostnames = buildStorefrontPublicationPurgeHostnames(identifiers);
  if (!hasExactOgaBasseyHostnames(hostnames)) {
    return { ok: false, reason: 'unexpected_hostnames' };
  }

  try {
    for (const slug of getCategorySlugs({
      nextSlug,
      previousSlug,
      relatedSlugs,
    })) {
      revalidateCategories(merchantId, slug, { expireImmediately: true });
    }
  } catch {
    return { ok: false, reason: 'category_revalidation_failed' };
  }

  try {
    if (
      !productCacheRevalidation.revalidateProducts(merchantId, undefined, {
        expireImmediately: true,
        feedScope: 'merchant',
      })
    ) {
      return { ok: false, reason: 'product_revalidation_failed' };
    }
  } catch {
    return { ok: false, reason: 'product_revalidation_failed' };
  }

  const publicationInput = {
    canonicalMerchantSlug: OGABASSEY_CANONICAL_SLUG,
    identifiers,
    merchantId,
  };
  let vercelResult: Awaited<
    ReturnType<typeof purgeVercelStorefrontPublicationCache>
  >;
  try {
    vercelResult = await purgeVercelStorefrontPublicationCache([
      ...buildMerchantPublicationDataCacheTags(publicationInput),
      ...buildStorefrontPublicationCacheTags({
        customDomains: OGABASSEY_HOSTNAMES,
        merchantSlugs: [OGABASSEY_CANONICAL_SLUG],
      }),
    ]);
  } catch {
    return { ok: false, reason: 'vercel_purge_failed' };
  }
  if (vercelResult.ok && vercelResult.reason === 'not_running_on_vercel') {
    return { ok: false, reason: 'not_running_on_vercel' };
  }
  if (!vercelResult.ok || vercelResult.reason !== 'deleted') {
    return { ok: false, reason: 'vercel_purge_failed' };
  }

  let cloudflareResult: Awaited<
    ReturnType<typeof purgeCloudflareHostnamesConfirmed>
  >;
  try {
    cloudflareResult = await purgeCloudflareHostnamesConfirmed(hostnames);
  } catch {
    return { ok: false, reason: 'cloudflare_purge_failed' };
  }
  if (!cloudflareResult.ok || cloudflareResult.reason !== 'purged') {
    return { ok: false, reason: 'cloudflare_purge_failed' };
  }

  return { ok: true };
}
