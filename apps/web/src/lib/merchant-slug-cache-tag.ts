/**
 * Shared cache-tag identity for the public merchant-by-slug lookup and every
 * mutation that changes fields returned by that lookup.
 */
export function getMerchantSlugCacheTag(slug: string): string {
  return `merchant-slug-${slug.trim().toLowerCase()}`;
}
