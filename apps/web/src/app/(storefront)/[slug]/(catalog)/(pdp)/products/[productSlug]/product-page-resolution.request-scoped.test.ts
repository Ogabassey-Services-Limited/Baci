import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRequestScopedMerchant = vi.fn();
const mockGetCachedProduct = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();
const mockGetCachedLegacyProductRedirectTarget = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
  getCachedProduct: (...args: unknown[]) => mockGetCachedProduct(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
  getRequestScopedMerchant: (...args: unknown[]) =>
    mockGetRequestScopedMerchant(...args),
  sanitizeLookupLogValue: (value: unknown) => String(value ?? ''),
}));

// Every Map created by the mocked cache() below is registered here so
// beforeEach can clear it, giving each test a fresh "request" instead of
// relying on every test using a unique productSlug to dodge collisions.
const { cacheRegistry } = vi.hoisted(() => ({
  cacheRegistry: [] as Map<string, unknown>[],
}));

// This repo's Vitest config resolves a plain `require.resolve('react')`
// (vitest.config.ts), which has no `react-server` export condition. Real
// React's `cache()` for that build is an inert passthrough — it always calls
// `fn` directly with no memoization (verified against
// node_modules/react/cjs/react.development.js: `exports.cache = function
// (fn) { return function () { return fn.apply(null, arguments); }; };`).
// Every existing cached-data*.test.ts mocks `cache()` as identity for the
// same reason. Mock it here as a genuine per-argument memoizer instead, so
// this test can actually exercise and prove the dedup behavior
// getRequestScopedProduct exists to provide — the real dispatcher-based
// memoization only activates inside a live Next.js request/render scope,
// which Vitest does not reproduce.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <Fn extends (...args: never[]) => unknown>(fn: Fn): Fn => {
      const resultsByKey = new Map<string, ReturnType<Fn>>();
      cacheRegistry.push(resultsByKey);
      return ((...args: Parameters<Fn>) => {
        const key = JSON.stringify(args);
        if (!resultsByKey.has(key)) {
          resultsByKey.set(key, fn(...args) as ReturnType<Fn>);
        }
        return resultsByKey.get(key);
      }) as Fn;
    },
  };
});

import { getRequestScopedProduct } from './product-page-resolution';

const merchant = { id: 'merchant-1', slug: 'test-store' };

describe('getRequestScopedProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getRequestScopedProduct is a module-level cache() singleton (mirroring
    // real Next.js request-scoping), so its Map is cleared before every test
    // to isolate each test's "request" instead of relying on every test
    // using a unique productSlug to dodge stale cross-test cache hits.
    for (const cache of cacheRegistry) {
      cache.clear();
    }
    mockGetRequestScopedMerchant.mockResolvedValue(merchant);
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
  });

  it('invokes the underlying product lookup once when called twice with the same arguments in one pass', async () => {
    const first = await getRequestScopedProduct('test-store', 'test-product');
    const second = await getRequestScopedProduct('test-store', 'test-product');

    expect(second).toBe(first);
    expect(mockGetRequestScopedMerchant).toHaveBeenCalledTimes(1);
    expect(mockGetCachedProduct).toHaveBeenCalledTimes(1);
    expect(mockGetCachedProductWithDetails).toHaveBeenCalledTimes(1);
  });

  it('runs a fresh lookup for a different productSlug', async () => {
    await getRequestScopedProduct('test-store', 'first-product');
    await getRequestScopedProduct('test-store', 'second-product');

    expect(mockGetCachedProduct).toHaveBeenCalledTimes(2);
    expect(mockGetCachedProduct).toHaveBeenNthCalledWith(
      1,
      'merchant-1',
      'first-product'
    );
    expect(mockGetCachedProduct).toHaveBeenNthCalledWith(
      2,
      'merchant-1',
      'second-product'
    );
  });

  it('runs a fresh lookup for the same productSlug across different merchants', async () => {
    const merchantA = { id: 'merchant-a', slug: 'store-a' };
    const merchantB = { id: 'merchant-b', slug: 'store-b' };
    mockGetRequestScopedMerchant.mockImplementation((slug: string) =>
      Promise.resolve(slug === 'store-a' ? merchantA : merchantB)
    );

    await getRequestScopedProduct('store-a', 'shared-product-slug');
    await getRequestScopedProduct('store-b', 'shared-product-slug');

    expect(mockGetCachedProduct).toHaveBeenCalledTimes(2);
    expect(mockGetCachedProduct).toHaveBeenNthCalledWith(
      1,
      'merchant-a',
      'shared-product-slug'
    );
    expect(mockGetCachedProduct).toHaveBeenNthCalledWith(
      2,
      'merchant-b',
      'shared-product-slug'
    );
  });

  it('resolves null and skips product lookups when the merchant is not found', async () => {
    mockGetRequestScopedMerchant.mockResolvedValue(null);

    const result = await getRequestScopedProduct('test-store', 'test-product');

    expect(result).toBeNull();
    expect(mockGetCachedProduct).not.toHaveBeenCalled();
    expect(mockGetCachedProductWithDetails).not.toHaveBeenCalled();
  });

  it('propagates a rejection from the underlying merchant lookup', async () => {
    const lookupError = new Error('merchant lookup failed');
    mockGetRequestScopedMerchant.mockRejectedValueOnce(lookupError);

    await expect(
      getRequestScopedProduct('test-store', 'test-product')
    ).rejects.toBe(lookupError);
    expect(mockGetCachedProduct).not.toHaveBeenCalled();
  });
});
