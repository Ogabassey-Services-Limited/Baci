/**
 * Enables only the capable router's canonical cache-transition branch.
 *
 * This is intentionally separate from analytics routing and defaults closed:
 * the database canary remains the producer gate, while this leaf controls
 * whether a router is allowed to consume its shared PGMQ message.
 */
export function isStorefrontCacheTransitionRoutingEnabled(): boolean {
  return process.env.STOREFRONT_CACHE_TRANSITION_ROUTING_ENABLED === 'true';
}
