import 'server-only';

import { revalidateTag } from 'next/cache';
import { buildMerchantPublicationDataCacheTags } from '@/lib/merchant-publication-data-cache-tags';
import { productCacheRevalidation } from '@/lib/product-cache-revalidation';
import { getProductScopedCacheTag } from '@/lib/product-cache-tags';
import { revalidateCategories } from '@/lib/revalidate-categories';
import { buildStorefrontPublicationCacheTags } from '@/lib/storefront-publication-cache-tags';
import { buildStorefrontPublicationPurgeHostnames } from '@/lib/storefront-publication-purge-hostnames';
import { strictCloudflareHostnamePurge } from '@/lib/strict-cloudflare-hostname-purge';
import { purgeVercelStorefrontPublicationCache } from '@/lib/vercel-storefront-publication-cache';
import type { CacheInvalidationClaim } from '@/schemas/cache-invalidation-claim';

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_VERCEL_TIMEOUT_MS = 5000;

export type CacheInvalidationDrainResult =
  | { ok: true }
  | {
      errorCode: string;
      ok: false;
      retryAfterSeconds?: number;
    };

function targetIdentity(claim: CacheInvalidationClaim) {
  const identifiers = Array.from(
    new Set([...claim.related_identifiers, claim.target_id])
  );
  const merchantSlugs = identifiers.filter((value) => SAFE_SLUG.test(value));
  const customDomains = identifiers.filter((value) => value.includes('.'));
  return {
    customDomains,
    hostnames: buildStorefrontPublicationPurgeHostnames(identifiers),
    merchantSlugs,
  };
}

async function purgeVercelWithTimeout(
  tags: readonly string[],
  timeoutMs: number,
  mode: 'delete' | 'invalidate' = 'delete'
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ ok: false; reason: 'timeout' }>((resolve) => {
    timer = setTimeout(
      () => resolve({ ok: false, reason: 'timeout' }),
      timeoutMs
    );
  });
  try {
    return await Promise.race([
      purgeVercelStorefrontPublicationCache(tags, { mode }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Ordered cache propagation. A later stage is unreachable after any failure. */
export async function drainStorefrontCacheInvalidation(
  claim: CacheInvalidationClaim,
  { vercelTimeoutMs = DEFAULT_VERCEL_TIMEOUT_MS } = {}
): Promise<CacheInvalidationDrainResult> {
  const identity = targetIdentity(claim);
  const productIdentifiers =
    claim.target_kind === 'storefront_product'
      ? [claim.target_id]
      : claim.product_slugs;
  const dataTags = buildMerchantPublicationDataCacheTags({
    canonicalMerchantSlug: identity.merchantSlugs[0],
    identifiers: claim.related_identifiers,
    merchantId: claim.merchant_id,
  });
  const exactProductTags = productIdentifiers.flatMap((productSlug) => [
    getProductScopedCacheTag('product', claim.merchant_id, productSlug),
    getProductScopedCacheTag(
      'product-lcp-image',
      claim.merchant_id,
      productSlug
    ),
  ]);
  if (claim.target_kind === 'storefront_product') {
    try {
      for (const tag of exactProductTags) {
        revalidateTag(tag, 'products');
      }
    } catch {
      return { errorCode: 'next_revalidation_failed', ok: false };
    }
    const exactVercelResult = await purgeVercelWithTimeout(
      exactProductTags,
      vercelTimeoutMs,
      'invalidate'
    );
    if (!exactVercelResult.ok || exactVercelResult.reason !== 'invalidated') {
      return {
        errorCode:
          exactVercelResult.reason === 'timeout'
            ? 'vercel_timeout'
            : `vercel_${exactVercelResult.reason}`,
        ok: false,
      };
    }
    // finish_cache_invalidation enqueues the generation-fenced broad target
    // after this exact purge succeeds. That ordered follow-up owns Cloudflare
    // plus listing/category coverage, so invoking Cloudflare here would only
    // duplicate provider work.
    return { ok: true };
  }
  const productTags = exactProductTags;
  try {
    const productsInvalidated = productCacheRevalidation.revalidateProducts(
      claim.merchant_id,
      undefined,
      { expireImmediately: true, feedScope: 'merchant' }
    );
    if (!productsInvalidated) {
      return { errorCode: 'next_revalidation_failed', ok: false };
    }
    revalidateCategories(claim.merchant_id, undefined, {
      expireImmediately: true,
    });
    for (const tag of [...dataTags, ...productTags]) {
      revalidateTag(tag, { expire: 0 });
    }
  } catch {
    return { errorCode: 'next_revalidation_failed', ok: false };
  }

  const vercelResult = await purgeVercelWithTimeout(
    [
      ...dataTags,
      ...productTags,
      ...buildStorefrontPublicationCacheTags(identity),
    ],
    vercelTimeoutMs
  );
  if (!vercelResult.ok || vercelResult.reason !== 'deleted') {
    return {
      errorCode:
        vercelResult.reason === 'timeout'
          ? 'vercel_timeout'
          : `vercel_${vercelResult.reason}`,
      ok: false,
    };
  }

  if (identity.hostnames.length === 0) return { ok: true };
  return strictCloudflareHostnamePurge(identity.hostnames);
}
