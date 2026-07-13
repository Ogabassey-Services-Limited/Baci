import 'server-only';

import { revalidateMerchantPublication } from '@/lib/cache-revalidation';
import { purgeCloudflareHostnamesConfirmed } from '@/lib/cloudflare-purge';
import type { StorefrontPublicationCacheIdentity } from '@/lib/get-storefront-publication-cache-identity';
import { buildMerchantPublicationDataCacheTags } from '@/lib/merchant-publication-data-cache-tags';
import { buildStorefrontPublicationCacheTags } from '@/lib/storefront-publication-cache-tags';
import { buildStorefrontPublicationPurgeHostnames } from '@/lib/storefront-publication-purge-hostnames';
import { purgeVercelStorefrontPublicationCache } from '@/lib/vercel-storefront-publication-cache';

type StorefrontPublicationCacheEvictionResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'missing_configuration'
        | 'not_required'
        | 'not_running_on_vercel'
        | 'provider_rejected'
        | 'request_failed';
      stage: 'cloudflare' | 'next' | 'vercel';
    };

/**
 * Propagate a publication boundary from the innermost cache outward. Vercel's
 * supported tag deletion clears Data, Runtime, and CDN caches together. It is
 * awaited before Cloudflare so the outer edge cannot refill from stale data.
 */
export async function evictStorefrontPublicationCaches(
  identity: StorefrontPublicationCacheIdentity
): Promise<StorefrontPublicationCacheEvictionResult> {
  const nextRevalidationInput = {
    canonicalMerchantSlug: identity.canonicalMerchantSlug,
    identifiers: identity.identifiers,
    merchantId: identity.merchantId,
  };
  try {
    // Keep Next's normal request-finalization path for local development and as
    // an idempotent framework-level backstop after Vercel's foreground purge.
    revalidateMerchantPublication(nextRevalidationInput);
  } catch (error) {
    console.error('Storefront publication cache eviction failed', {
      error,
      merchantId: identity.merchantId,
      stage: 'next',
    });
    return { ok: false, reason: 'request_failed', stage: 'next' };
  }

  const cloudflareHostnames = buildStorefrontPublicationPurgeHostnames(
    identity.identifiers
  );
  const vercelResult = await purgeVercelStorefrontPublicationCache([
    ...buildMerchantPublicationDataCacheTags(nextRevalidationInput),
    ...buildStorefrontPublicationCacheTags({
      customDomains: identity.customDomains,
      merchantSlugs: identity.merchantSlugs,
    }),
  ]);
  if (!vercelResult.ok) {
    console.error('Storefront publication cache eviction failed', {
      merchantId: identity.merchantId,
      reason: vercelResult.reason,
      stage: 'vercel',
    });
    return { ok: false, reason: vercelResult.reason, stage: 'vercel' };
  }
  if (cloudflareHostnames.length > 0 && vercelResult.reason !== 'deleted') {
    console.error('Storefront publication cache eviction failed', {
      merchantId: identity.merchantId,
      reason: vercelResult.reason,
      stage: 'vercel',
    });
    return { ok: false, reason: vercelResult.reason, stage: 'vercel' };
  }

  const cloudflareResult =
    await purgeCloudflareHostnamesConfirmed(cloudflareHostnames);
  if (!cloudflareResult.ok) {
    console.error('Storefront publication cache eviction failed', {
      merchantId: identity.merchantId,
      reason: cloudflareResult.reason,
      stage: 'cloudflare',
    });
    return {
      ok: false,
      reason: cloudflareResult.reason,
      stage: 'cloudflare',
    };
  }

  return { ok: true };
}
