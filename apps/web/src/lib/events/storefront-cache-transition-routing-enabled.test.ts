import { afterEach, describe, expect, it } from 'vitest';
import { isStorefrontCacheTransitionRoutingEnabled } from './storefront-cache-transition-routing-enabled';

const original = process.env.STOREFRONT_CACHE_TRANSITION_ROUTING_ENABLED;

afterEach(() => {
  if (original === undefined) {
    delete process.env.STOREFRONT_CACHE_TRANSITION_ROUTING_ENABLED;
  } else {
    process.env.STOREFRONT_CACHE_TRANSITION_ROUTING_ENABLED = original;
  }
});

describe('isStorefrontCacheTransitionRoutingEnabled', () => {
  it('fails closed unless explicitly enabled', () => {
    delete process.env.STOREFRONT_CACHE_TRANSITION_ROUTING_ENABLED;
    expect(isStorefrontCacheTransitionRoutingEnabled()).toBe(false);

    process.env.STOREFRONT_CACHE_TRANSITION_ROUTING_ENABLED = 'TRUE';
    expect(isStorefrontCacheTransitionRoutingEnabled()).toBe(false);

    process.env.STOREFRONT_CACHE_TRANSITION_ROUTING_ENABLED = 'true';
    expect(isStorefrontCacheTransitionRoutingEnabled()).toBe(true);
  });
});
