import { cacheLife, cacheTag } from 'next/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedCategoryPageData } from '@/lib/cached-data';
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

describe('getCachedCategoryPageData category routing and fallback logic', () => {
  it('Scenario 1: bypasses legacy fallback product queries and returns isInactiveCategory=true when get_storefront_category_slug_state RPC returns inactive slug state', async () => {
    // categories.single returns PGRST116 (not found)
    harness.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });
    // RPC get_storefront_category_slug_state returns is_active: false
    harness.mockRpc.mockResolvedValueOnce({
      data: [{ is_active: false }],
      error: null,
    });

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'inactive-slug',
      'test-store'
    );

    // Assert RPC was called to inspect inactive state
    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_category_slug_state',
      {
        p_merchant_id: 'merchant-123',
        p_slug: 'inactive-slug',
      }
    );

    // Ensure the products table query was NOT executed
    expect(harness.mockFrom).not.toHaveBeenCalledWith('products');

    // Assert final result structure matches expected bypass state
    expect(result).toEqual({
      isCollection: false,
      category: null,
      products: [],
      fallbackName: 'Inactive Slug',
      fallbackDescription: 'Browse our collection of Inactive Slug products.',
      isInactiveCategory: true,
      productCount: 0,
      // "No rows" (PGRST116) is the expected unknown-slug path, not a failure.
      productsQueryFailed: false,
      categoryQueryFailed: false,
    });
  });

  it('Scenario 2: returns category with empty products without executing the legacy loose fallback search when canonical category exists but scoped query returns zero products', async () => {
    // 1. categories.single returns a valid active category
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-active-123',
        name: 'Active Category',
        slug: 'active-category',
        description: 'Standard active category',
        image_url: null,
        is_active: true,
        seo_heading: null,
        seo_description: null,
        seo_features: null,
        seo_faq: null,
        parent: null,
      },
      error: null,
    });

    // categories scope query mock (returns its own ID)
    harness.mockListResult.data = [{ id: 'cat-active-123' }];

    // Mock scoped products query to return empty array
    const emptyScopedProductsResult = { data: [], error: null };
    harness.mockQueryExecution
      .mockImplementationOnce(() => Promise.resolve(harness.mockListResult)) // scope query execution
      .mockImplementationOnce(() => Promise.resolve(emptyScopedProductsResult)); // products query execution

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'active-category',
      'test-store'
    );

    // Verify it scoped products by categories in list
    expect(harness.mockIn).toHaveBeenCalledWith(
      'product_categories.category_id',
      ['cat-active-123']
    );

    // Ensure it did NOT run the legacy fallback ilike queries on products
    expect(harness.mockOr).toHaveBeenCalledOnce();
    expect(harness.mockOr).toHaveBeenCalledWith(
      'id.eq.cat-active-123,parent_id.eq.cat-active-123'
    );

    // Verify output returned the category correctly and products are empty
    expect(result).toEqual({
      isCollection: false,
      category: expect.objectContaining({
        id: 'cat-active-123',
        name: 'Active Category',
      }),
      products: [],
      fallbackName: 'Active Category',
      fallbackDescription: 'Standard active category',
      isInactiveCategory: false,
      productCount: 0,
      productsQueryFailed: false,
      categoryQueryFailed: false,
    });
  });

  it('applies category/product cache scopes while resolving category products', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-active-123',
        name: 'Active Category',
        slug: 'active-category',
        description: 'Standard active category',
        image_url: null,
        is_active: true,
        seo_heading: null,
        seo_description: null,
        seo_features: null,
        seo_faq: null,
        parent: null,
      },
      error: null,
    });
    harness.mockListResults.push(
      { data: [{ id: 'cat-active-123' }], error: null },
      { data: [{ id: 'product-1' }], error: null },
      { data: [{ id: 'product-1', name: 'Scoped Product' }], error: null }
    );

    await getCachedCategoryPageData(
      'merchant-123',
      'active-category',
      'test-store'
    );

    expect(cacheLife).toHaveBeenCalledWith('storefront-page');
    expect(cacheLife).toHaveBeenCalledWith('products');
    expect(cacheTag).toHaveBeenCalledWith(
      'category-page-data',
      'products',
      'categories',
      'products-merchant-123',
      'categories-merchant-123'
    );
  });

  it('preserves ID slots when an early detail chunk fails and a later chunk succeeds', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-active-123',
        name: 'Active Category',
        slug: 'active-category',
        description: 'Standard active category',
        image_url: null,
        is_active: true,
        seo_heading: null,
        seo_description: null,
        seo_features: null,
        seo_faq: null,
        parent: null,
      },
      error: null,
    });

    const productIds = Array.from({ length: 49 }, (_, index) => ({
      id: `product-${index + 1}`,
    }));
    harness.mockListResults.push(
      { data: [{ id: 'cat-active-123' }], error: null },
      { data: productIds, error: null },
      { data: [], error: { message: 'detail timeout' } },
      {
        data: [
          {
            id: 'product-49',
            name: 'Recovered Product',
            slug: 'recovered-product',
          },
        ],
        error: null,
      }
    );

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'active-category',
      'test-store'
    );

    expect(result.productsQueryFailed).toBe(true);
    expect(result.products).toEqual([
      expect.objectContaining({ id: 'product-49' }),
    ]);
    expect(result.productSlots).toHaveLength(49);
    expect(result.productSlots?.slice(0, 48)).toEqual(
      Array.from({ length: 48 }, () => null)
    );
    expect(result.productSlots?.[48]).toEqual(
      expect.objectContaining({ id: 'product-49' })
    );
  });

  it('filters detail relations to the scoped category IDs', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-parent',
        name: 'Phones',
        slug: 'phones',
        description: 'Phones',
        image_url: null,
        is_active: true,
        seo_heading: null,
        seo_description: null,
        seo_features: null,
        seo_faq: null,
        parent: null,
      },
      error: null,
    });

    harness.mockListResults.push(
      { data: [{ id: 'cat-parent' }, { id: 'cat-child' }], error: null },
      { data: [{ id: 'product-1' }], error: null },
      { data: [{ id: 'product-1', name: 'Scoped Product' }], error: null }
    );

    await getCachedCategoryPageData('merchant-123', 'phones', 'test-store');

    expect(harness.mockIn).toHaveBeenCalledWith(
      'product_categories.category_id',
      ['cat-parent', 'cat-child']
    );
    expect(
      harness.mockIn.mock.calls.filter(
        ([column]) => column === 'product_categories.category_id'
      )
    ).toHaveLength(2);
    const detailSelect = harness.mockSelect.mock.calls
      .map(([select]) => String(select))
      .find(
        (select) =>
          select.includes('manage_stock') &&
          select.includes('categories(name, slug)')
      );
    expect(detailSelect).toContain('product_categories!inner');
  });

  it('drops missing detail rows from known pagination slots when the ID list is stale', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-parent',
        name: 'Phones',
        slug: 'phones',
        description: 'Phones',
        image_url: null,
        is_active: true,
        seo_heading: null,
        seo_description: null,
        seo_features: null,
        seo_faq: null,
        parent: null,
      },
      error: null,
    });

    const productIds = Array.from({ length: 21 }, (_, index) => ({
      id: `product-${index + 1}`,
    }));
    const returnedProducts = productIds.slice(0, 20).map(({ id }) => ({
      id,
      name: `Product ${id}`,
      slug: id,
    }));
    harness.mockListResults.push(
      { data: [{ id: 'cat-parent' }], error: null },
      { data: productIds, error: null },
      { data: returnedProducts, error: null }
    );

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'phones',
      'test-store'
    );

    expect(result.productsQueryFailed).toBe(false);
    expect(result.products).toHaveLength(20);
    expect(result.productSlots).toBeUndefined();
  });

  it('fetches only the requested detail ID window while preserving total product count', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-parent',
        name: 'Phones',
        slug: 'phones',
        description: 'Phones',
        image_url: null,
        is_active: true,
        seo_heading: null,
        seo_description: null,
        seo_features: null,
        seo_faq: null,
        parent: null,
      },
      error: null,
    });

    const productIds = Array.from({ length: 49 }, (_, index) => ({
      id: `product-${index + 1}`,
    }));
    const requestedWindow = productIds.slice(20, 40);
    harness.mockListResults.push(
      { data: [{ id: 'cat-parent' }], error: null },
      { data: productIds, error: null },
      {
        data: requestedWindow.map(({ id }) => ({
          id,
          name: `Product ${id}`,
          slug: id,
        })),
        error: null,
      }
    );

    const getBoundedCategoryPageData = getCachedCategoryPageData as unknown as (
      merchantId: string,
      categorySlug: string,
      storeSlug: string,
      productOffset: number,
      productLimit: number
    ) => ReturnType<typeof getCachedCategoryPageData>;
    const result = await getBoundedCategoryPageData(
      'merchant-123',
      'phones',
      'test-store',
      20,
      20
    );

    expect(harness.mockIn).toHaveBeenCalledWith(
      'id',
      requestedWindow.map(({ id }) => id)
    );
    expect(result.products).toHaveLength(20);
    expect(result).toMatchObject({
      productCount: 49,
      productsArePrePaginated: true,
    });
  });

  it('Scenario 3: flags categoryQueryFailed (fail open) when the category .single() lookup hits a transient error, not a normal "no rows"', async () => {
    // A non-PGRST116 error means we could not confirm the slug is unknown — the
    // doorway-trap guard must fail open rather than noindex a possibly-live page.
    harness.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '57014', message: 'canceling statement due to timeout' },
    });
    // No hidden state + empty legacy fallback (harness defaults) so the only
    // failure signal under test is the category lookup itself.
    harness.mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'maybe-real',
      'test-store'
    );

    expect(result).toEqual(
      expect.objectContaining({
        category: null,
        isInactiveCategory: false,
        categoryQueryFailed: true,
        productsQueryFailed: false,
      })
    );
  });
});
