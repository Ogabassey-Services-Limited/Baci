import { describe, expect, it } from 'vitest';
import { STOREFRONT_CACHE } from './storefront-cache';

describe('STOREFRONT_CACHE', () => {
  it('defines storefront product cache durations in seconds', () => {
    expect(STOREFRONT_CACHE.productsSMaxAge).toBe(300);
    expect(STOREFRONT_CACHE.productsStaleWhileRevalidate).toBe(3600);
  });
});
