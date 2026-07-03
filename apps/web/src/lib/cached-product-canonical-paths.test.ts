import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreatePublicClient } = vi.hoisted(() => ({
  mockCreatePublicClient: vi.fn(),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));
vi.mock('@/lib/seo-utils', () => ({
  getProductUrl: (product: { slug?: string; categories?: { slug?: string } }) =>
    `/${product.categories?.slug ?? 'products'}/${product.slug}`,
}));

import { getCachedProductCanonicalPaths } from './cached-product-canonical-paths';

function createQueryBuilder(result: {
  data?: unknown[] | null;
  error?: { message: string } | null;
}) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() =>
      Promise.resolve({
        data: result.data ?? null,
        error: result.error ?? null,
      })
    ),
  };

  return builder;
}

describe('getCachedProductCanonicalPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps active product slugs to their canonical category paths', async () => {
    const builder = createQueryBuilder({
      data: [
        {
          id: 'p1',
          name: 'iPhone XR',
          slug: 'iphone-xr',
          category: 'Smartphones',
          categories: { name: 'Smartphones', slug: 'smartphones' },
        },
        {
          id: 'p2',
          name: 'AirPods 2',
          slug: 'apple-airpods-2',
          category: 'Earbuds',
          categories: { name: 'Earbuds', slug: 'earbuds' },
        },
      ],
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const paths = await getCachedProductCanonicalPaths('merchant-1', [
      'iphone-xr',
      'apple-airpods-2',
      'archived-slug',
    ]);

    expect(paths).toEqual({
      'iphone-xr': '/smartphones/iphone-xr',
      'apple-airpods-2': '/earbuds/apple-airpods-2',
    });
    expect(builder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(builder.eq).toHaveBeenCalledWith('status', 'active');
    expect(builder.in).toHaveBeenCalledWith('slug', [
      'iphone-xr',
      'apple-airpods-2',
      'archived-slug',
    ]);
  });

  it('returns an empty map without querying when no slugs are requested', async () => {
    const paths = await getCachedProductCanonicalPaths('merchant-1', []);

    expect(paths).toEqual({});
    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('returns an empty map when the query fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const builder = createQueryBuilder({ error: { message: 'boom' } });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const paths = await getCachedProductCanonicalPaths('merchant-1', [
      'iphone-xr',
    ]);

    expect(paths).toEqual({});
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
