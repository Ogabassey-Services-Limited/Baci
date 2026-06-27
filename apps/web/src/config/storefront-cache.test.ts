import { describe, expect, it } from 'vitest';
import {
  STOREFRONT_CACHE,
  STOREFRONT_PUBLIC_CACHE_POLICIES,
} from './storefront-cache';

describe('STOREFRONT_CACHE', () => {
  it('defines storefront product cache durations in seconds', () => {
    expect(STOREFRONT_CACHE.productsSMaxAge).toBe(300);
    expect(STOREFRONT_CACHE.productsStaleWhileRevalidate).toBe(3600);
  });

  it('defines merchant-specific public document cache policy outside the proxy', () => {
    expect(STOREFRONT_PUBLIC_CACHE_POLICIES).toEqual([
      {
        slug: 'ogabassey',
        customHostnames: ['ogabassey.com', 'www.ogabassey.com'],
        cacheableCategorySegments: [
          'accessories',
          'gaming',
          'gaming-consoles',
          'gift-cards',
          'laptops',
          'nintendo-switch',
          'smartphones',
          'smartwatches',
          'tablets',
        ],
      },
    ]);
  });

  it('does not define duplicate public cache policy slugs or custom hostnames', () => {
    const slugs = STOREFRONT_PUBLIC_CACHE_POLICIES.map((policy) =>
      policy.slug.toLowerCase()
    );
    const hostnames = STOREFRONT_PUBLIC_CACHE_POLICIES.flatMap((policy) =>
      policy.customHostnames.map((hostname) => hostname.toLowerCase())
    );

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(hostnames).size).toBe(hostnames.length);
  });
});
