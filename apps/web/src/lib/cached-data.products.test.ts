import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedCategoryPageData,
  getCachedLegacyProductRedirectTarget,
  getCachedProduct,
  getCachedProducts,
  getCachedProductWithDetails,
} from '@/lib/cached-data';
import {
  buildCachedDataTestHarness,
  type CachedDataTestHarness,
  resetMockCreateClient,
} from '@/lib/cached-data.test-utils';

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('react', () => ({ cache: vi.fn((fn) => fn) }));
vi.mock('@supabase/supabase-js', async () => {
  const { getMockCreateClient } = await import('@/lib/cached-data.test-utils');
  return {
    createClient: (...args: unknown[]) => {
      const createClient = getMockCreateClient();
      if (!createClient) {
        return {
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn(),
                single: vi.fn(),
                eq: vi.fn(),
              }),
            }),
          }),
          auth: { getUser: vi.fn() },
        };
      }
      return createClient(...args);
    },
  };
});

let harness: CachedDataTestHarness;

beforeEach(() => {
  harness = buildCachedDataTestHarness();
});

afterEach(() => {
  resetMockCreateClient();
  vi.restoreAllMocks();
});

describe('cached-data product query projections', () => {
  const singleProduct = { id: 'product-123', slug: 'iphone-16' };
  const productList = [
    { id: 'product-123', slug: 'iphone-16' },
    { id: 'product-456', slug: 'iphone-15' },
  ];
  const singleProductResult = { data: singleProduct, error: null };
  const productQueryError = {
    data: null,
    error: { message: 'db error', code: '42P01' },
  };
  const rpcFailure = {
    data: null,
    error: { message: 'RPC failed', code: 'P0001' },
  };

  it('getCachedProduct uses explicit column select without product_variants', async () => {
    harness.mockSingle.mockResolvedValueOnce(singleProductResult);

    await getCachedProduct('merchant-123', 'iphone-16');

    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'iphone-16');
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).not.toMatch(/\*\s*,/);
    expect(selectArg).toContain('canonical_url');
  });

  it('getCachedProductWithDetails uses explicit column select without product_variants', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);

    await getCachedProductWithDetails('merchant-123', 'iphone-16');

    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'iphone-16');
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).not.toMatch(/\*\s*,/);
    expect(selectArg).toContain('imageHint:image_hint');
    expect(selectArg).toContain('fulfillmentFields:fulfillment_fields');
  });

  it('getCachedProducts attaches storefront variants from the public RPC', async () => {
    harness.mockListResult.data = productList;
    harness.mockListResult.error = null;
    harness.mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: 'variant-1',
          product_id: 'product-123',
          attributes: { storage: '128GB' },
          stock_quantity: 2,
        },
        {
          id: 'variant-2',
          product_id: 'product-456',
          attributes: { storage: '256GB' },
          stock_quantity: 1,
        },
      ],
      error: null,
    });

    await expect(getCachedProducts('merchant-123')).resolves.toEqual([
      expect.objectContaining({
        id: 'product-123',
        product_variants: [
          expect.objectContaining({
            id: 'variant-1',
            attributes: { storage: '128GB' },
          }),
        ],
      }),
      expect.objectContaining({
        id: 'product-456',
        product_variants: [
          expect.objectContaining({
            id: 'variant-2',
            attributes: { storage: '256GB' },
          }),
        ],
      }),
    ]);
    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_product_variants',
      {
        p_product_ids: ['product-123', 'product-456'],
      }
    );
    expect(harness.mockQueryExecution.mock.invocationCallOrder[0]).toBeLessThan(
      harness.mockRpc.mock.invocationCallOrder[0]
    );
  });

  it('getCachedProducts falls back to empty variants when the public RPC fails', async () => {
    harness.mockListResult.data = productList;
    harness.mockListResult.error = null;
    harness.mockRpc.mockResolvedValueOnce(rpcFailure);

    await expect(getCachedProducts('merchant-123')).resolves.toEqual([
      expect.objectContaining({ id: 'product-123', product_variants: [] }),
      expect.objectContaining({ id: 'product-456', product_variants: [] }),
    ]);
    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_product_variants',
      {
        p_product_ids: ['product-123', 'product-456'],
      }
    );
  });

  it('getCachedProduct returns null on query error', async () => {
    harness.mockSingle.mockResolvedValueOnce(productQueryError);

    await expect(
      getCachedProduct('merchant-123', 'missing-product')
    ).resolves.toBeNull();
  });

  it('getCachedProduct attaches storefront variants from the public RPC', async () => {
    harness.mockSingle.mockResolvedValueOnce(singleProductResult);
    harness.mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: 'variant-1',
          product_id: 'product-123',
          attributes: { storage: '128GB', sim_type: 'eSIM Only' },
          stock_quantity: 2,
        },
      ],
      error: null,
    });

    const result = await getCachedProduct('merchant-123', 'iphone-16');

    expect(result?.product_variants).toEqual([
      expect.objectContaining({
        id: 'variant-1',
        attributes: { storage: '128GB', sim_type: 'eSIM Only' },
      }),
    ]);
    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_product_variants',
      {
        p_product_ids: ['product-123'],
      }
    );
  });

  it('getCachedProduct falls back to empty variants when the public RPC fails', async () => {
    harness.mockSingle.mockResolvedValueOnce(singleProductResult);
    harness.mockRpc.mockResolvedValueOnce(rpcFailure);

    const result = await getCachedProduct('merchant-123', 'iphone-16');

    expect(result?.product_variants).toEqual([]);
    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_product_variants',
      {
        p_product_ids: ['product-123'],
      }
    );
  });

  it('getCachedProductWithDetails returns null on query error', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(productQueryError);

    await expect(
      getCachedProductWithDetails('merchant-123', 'missing-product')
    ).resolves.toBeNull();
  });

  it('getCachedLegacyProductRedirectTarget throws on query error to avoid caching false misses', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(productQueryError);

    await expect(
      getCachedLegacyProductRedirectTarget('merchant-123', 'missing-product')
    ).rejects.toEqual(expect.objectContaining({ message: 'db error' }));
  });

  it('getCachedProductWithDetails attaches storefront variants from the public RPC', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);
    harness.mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: 'variant-2',
          product_id: 'product-123',
          attributes: { storage: '256GB' },
          stock_quantity: 1,
        },
      ],
      error: null,
    });

    const result = await getCachedProductWithDetails(
      'merchant-123',
      'iphone-16'
    );

    expect(result?.product_variants).toEqual([
      expect.objectContaining({
        id: 'variant-2',
        attributes: { storage: '256GB' },
      }),
    ]);
    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_product_variants',
      {
        p_product_ids: ['product-123'],
      }
    );
  });

  it('getCachedProductWithDetails falls back to empty variants when the public RPC fails', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);
    harness.mockRpc.mockResolvedValueOnce(rpcFailure);

    const result = await getCachedProductWithDetails(
      'merchant-123',
      'iphone-16'
    );

    expect(result?.product_variants).toEqual([]);
    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_product_variants',
      {
        p_product_ids: ['product-123'],
      }
    );
  });

  it('getCachedCategoryPageData includes products from child categories', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-smartphones',
        name: 'Smartphones',
        slug: 'smartphones',
        description: 'Phones',
        image_url: null,
        seo_heading: null,
        seo_description: null,
        seo_features: null,
        seo_faq: null,
        parent: null,
      },
      error: null,
    });

    harness.mockListResult.data = [
      { id: 'cat-smartphones' },
      { id: 'cat-iphone' },
    ];
    const productQueryResult = {
      data: [
        { id: 'product-1', name: 'iPhone 15', brand: 'Apple' },
        { id: 'product-2', name: 'Galaxy S24', brand: 'Samsung' },
      ],
      error: null,
    };
    harness.mockQueryExecution
      .mockImplementationOnce(() => Promise.resolve(harness.mockListResult))
      .mockImplementationOnce(() => Promise.resolve(productQueryResult));

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'smartphones',
      'test-store'
    );

    expect(harness.mockIn).toHaveBeenCalledWith(
      'product_categories.category_id',
      ['cat-smartphones', 'cat-iphone']
    );
    expect(harness.mockLimit).not.toHaveBeenCalled();
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).toContain('product_key_specs');
    expect(result.products).toEqual(productQueryResult.data);
  });
});
