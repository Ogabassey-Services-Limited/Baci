import type { CacheInvalidationClaim } from '@/schemas/cache-invalidation-claim';

/** Generation-fenced merchant mutation identity for provider SingleFlight. */
export function cacheInvalidationPurgeCausalKey(
  claim: Pick<CacheInvalidationClaim, 'generation' | 'merchant_id'>
): string {
  // enqueue_storefront_cache_targets shares related_identifiers and syncs
  // generation across slug/hostname rows from one mutation. claim_token and
  // target tuples still differ, so they must not partition provider keys.
  return JSON.stringify([claim.merchant_id, claim.generation]);
}
