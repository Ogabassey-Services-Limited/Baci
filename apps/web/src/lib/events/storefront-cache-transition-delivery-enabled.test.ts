import { afterEach, describe, expect, it } from 'vitest';
import { isStorefrontCacheTransitionDeliveryEnabled } from './storefront-cache-transition-delivery-enabled';

const original = process.env.STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED;

afterEach(() => {
  if (original === undefined) {
    delete process.env.STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED;
  } else {
    process.env.STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED = original;
  }
});

describe('isStorefrontCacheTransitionDeliveryEnabled', () => {
  it('fails closed unless the dedicated lane is explicitly enabled', () => {
    delete process.env.STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED;
    expect(isStorefrontCacheTransitionDeliveryEnabled()).toBe(false);

    process.env.STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED = '1';
    expect(isStorefrontCacheTransitionDeliveryEnabled()).toBe(false);

    process.env.STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED = 'true';
    expect(isStorefrontCacheTransitionDeliveryEnabled()).toBe(true);
  });
});
