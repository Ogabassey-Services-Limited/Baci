/**
 * Enables only the dedicated cache-transition delivery lane. It is separate
 * from the legacy analytics delivery switch so either worker can be rolled out
 * or stopped without changing the other one's authority.
 */
export function isStorefrontCacheTransitionDeliveryEnabled(): boolean {
  return process.env.STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED === 'true';
}
