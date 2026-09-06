import type { CacheInvalidationClaim } from '@/schemas/cache-invalidation-claim';

const SHARED_GENERATION_TARGET_KINDS = new Set<
  CacheInvalidationClaim['target_kind']
>(['storefront_hostname', 'storefront_slug']);

/** Provider SingleFlight / cron skip key for a claimed invalidation row. */
export function cacheInvalidationPurgeCausalKey(
  claim: Pick<
    CacheInvalidationClaim,
    'generation' | 'merchant_id' | 'target_id' | 'target_kind'
  >
): string {
  // enqueue_storefront_cache_targets shares related_identifiers and syncs
  // generation across slug/hostname rows from one mutation. Those siblings
  // may finish without repeating the full multi-identifier purge.
  if (SHARED_GENERATION_TARGET_KINDS.has(claim.target_kind)) {
    return JSON.stringify([claim.merchant_id, claim.generation]);
  }
  // Product generations are scoped per (merchant, target_kind, target_id).
  // Same generation across different products must not skip exact purges.
  return JSON.stringify([
    claim.merchant_id,
    claim.target_kind,
    claim.target_id,
    claim.generation,
  ]);
}
