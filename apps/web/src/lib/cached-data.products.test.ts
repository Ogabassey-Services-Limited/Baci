import { cacheTag } from 'next/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedCategoryPageData,
  getCachedLegacyProductRedirectTarget,
  getCachedProduct,
  getCachedProductCanonicalRedirectTarget,
  getCachedProductLcpHint,
  getCachedProducts,
  getCachedProductWithDetails,
} from '@/lib/cached-data';
import {
  buildCachedDataTestHarness,
  type CachedDataTestHarness,
  resetMockCreateClient,
} from '@/lib/cached-data.test-utils';
import { getProductScopedCacheTag } from '@/lib/product-cache-tags';
import {
  getPublicSerializedVariantSummariesByProductId,
  type PublicSerializedVariantSummary,
} from '@/lib/public-serialized-variant-summary';

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('react', () => ({ cache: vi.fn((fn) => fn) }));
vi.mock('@/lib/public-serialized-variant-summary', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/public-serialized-variant-summary')
  >('@/lib/public-serialized-variant-summary');

  return {
    ...actual,
    getPublicSerializedVariantSummariesByProductId: vi.fn(() =>
      Promise.resolve([])
    ),
  };
});
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
  const singleProduct = {
    id: 'product-123',
    slug: 'iphone-16',
    variant_attributes: { storage: ['128GB'] },
  };
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
  const standaloneCurrencyColumnPattern = /(?:^|[\s,])currency\s*(?:,|\n|$)/;
  const standaloneQuantityColumnPattern = /(?:^|[\s,])quantity\s*(?:,|\n|$)/;
  const standaloneTrackQuantityColumnPattern =
    /(?:^|[\s,])track_quantity\s*(?:,|\n|$)/;
  const standaloneDescriptionColumnPattern =
    /(?:^|[\s,])description\s*(?:,|\n|$)/;

  it('getCachedProduct uses explicit column select without product_variants', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);

    await getCachedProduct('merchant-123', 'iphone-16');

    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'iphone-16');
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).not.toMatch(/\*\s*,/);
    expect(selectArg).not.toMatch(standaloneCurrencyColumnPattern);
    expect(selectArg).not.toMatch(standaloneQuantityColumnPattern);
    expect(selectArg).not.toMatch(standaloneTrackQuantityColumnPattern);
    expect(selectArg).toContain('quantity:stock_quantity');
    expect(selectArg).toContain('track_quantity:manage_stock');
    expect(selectArg).toContain('categories:category_id');
    expect(selectArg).not.toContain('is_featured');
    expect(selectArg).toContain('canonical_url');
  });

  it('getCachedProductLcpHint reads route and image fields, then hydrates public variants by RPC', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);
    harness.mockRpc.mockResolvedValueOnce({
      data: [
        {
          attributes: { storage: '128GB' },
          id: 'variant-1',
          product_id: 'product-123',
          stock_quantity: 2,
        },
      ],
      error: null,
    });

    const result = await getCachedProductLcpHint('merchant-123', 'iphone-16');

    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'iphone-16');
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).toContain('brand');
    expect(selectArg).toContain('condition');
    expect(selectArg).toContain('id');
    expect(selectArg).toContain('name');
    expect(selectArg).toContain('slug');
    expect(selectArg).toContain('price');
    expect(selectArg).toContain('images');
    expect(selectArg).toContain('color');
    expect(selectArg).toContain('default_variant_id');
    expect(selectArg).toContain('manage_stock');
    expect(selectArg).toContain('schema_markup');
    expect(selectArg).toContain('stock');
    expect(selectArg).toContain('stock_quantity');
    expect(selectArg).toContain('variant_attributes');
    expect(selectArg).toContain('categories:category_id');
    expect(selectArg).toContain('product_categories');
    expect(selectArg).not.toContain('product_variants');
    expect(selectArg).not.toContain('price_override');
    expect(selectArg).not.toContain('primary_image');
    expect(selectArg).not.toMatch(standaloneDescriptionColumnPattern);
    expect(selectArg).not.toContain('specifications');
    expect(selectArg).not.toContain('review_count');
    expect(selectArg).not.toContain('product_key_specs');
    expect(selectArg).not.toContain('product_offers');
    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_product_variants',
      {
        p_product_ids: ['product-123'],
      }
    );
    expect(cacheTag).toHaveBeenCalledWith(
      'product',
      'product-lcp-hint',
      'products-merchant-123',
      getProductScopedCacheTag('product', 'merchant-123', 'iphone-16')
    );
    expect(result?.product_variants).toEqual([
      expect.objectContaining({
        attributes: { storage: '128GB' },
        id: 'variant-1',
      }),
    ]);
    expect(result?.variant_attributes).toEqual({ storage: ['128GB'] });
  });

  it('getCachedProductLcpHint hydrates serialized public variant stock', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);
    harness.mockRpc.mockResolvedValueOnce({
      data: [
        {
          attributes: { storage: '128GB' },
          id: 'variant-1',
          product_id: 'product-123',
          stock_quantity: 0,
        },
      ],
      error: null,
    });
    vi.mocked(
      getPublicSerializedVariantSummariesByProductId
    ).mockResolvedValueOnce([
      {
        inventoryTrackingPolicy: 'serialized_then_unlimited',
        productId: 'product-123',
        publicAvailableUnits: 0,
        variantId: 'variant-1',
      },
    ] satisfies PublicSerializedVariantSummary[]);

    const result = await getCachedProductLcpHint('merchant-123', 'iphone-16');

    expect(result?.product_variants).toEqual([
      expect.objectContaining({
        id: 'variant-1',
        inventory_tracking_policy: 'serialized_then_unlimited',
        stock_quantity: 9999,
      }),
    ]);
    expect(getPublicSerializedVariantSummariesByProductId).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(Function) }),
      'merchant-123',
      ['product-123']
    );
  });

  it('getCachedProductLcpHint can skip public variant hydration for image-only callers', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);

    await getCachedProductLcpHint('merchant-123', 'iphone-16', {
      includeVariants: false,
    });

    expect(harness.mockRpc).not.toHaveBeenCalledWith(
      'get_storefront_product_variants',
      expect.any(Object)
    );
  });

  it('getCachedProductLcpHint supports UUID-shaped product slugs as well as IDs', async () => {
    const uuidPath = 'ABCDEF12-3456-4789-ABCD-ABCDEF123456';
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);

    await getCachedProductLcpHint('merchant-123', uuidPath);

    expect(harness.mockOr).toHaveBeenCalledWith(
      `slug.eq.${uuidPath.toLowerCase()},id.eq.${uuidPath}`
    );
  });

  it('getCachedProductLcpHint returns null on query error', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(productQueryError);

    await expect(
      getCachedProductLcpHint('merchant-123', 'missing-product')
    ).resolves.toBeNull();
  });

  it('getCachedProductCanonicalRedirectTarget uses the narrow proxy preflight projection', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);

    await getCachedProductCanonicalRedirectTarget('merchant-123', 'iphone-16');

    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'iphone-16');
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).toContain('id');
    expect(selectArg).toContain('name');
    expect(selectArg).toContain('slug');
    expect(selectArg).toContain('status');
    expect(selectArg).toContain('category');
    expect(selectArg).toContain('category_slug');
    expect(selectArg).toContain('canonical_url');
    expect(selectArg).toContain('categories:category_id');
    expect(selectArg).not.toMatch(/\*\s*,/);
    expect(selectArg).not.toMatch(standaloneDescriptionColumnPattern);
    expect(selectArg).not.toContain('product_key_specs');
    expect(selectArg).not.toContain('product_offers');
    expect(selectArg).not.toContain('product_variants');
    expect(cacheTag).toHaveBeenCalledWith(
      'product',
      'product-canonical-redirect',
      getProductScopedCacheTag('product', 'merchant-123', 'iphone-16'),
      getProductScopedCacheTag(
        'product-canonical-redirect',
        'merchant-123',
        'iphone-16'
      )
    );
    expect(harness.mockRpc).not.toHaveBeenCalled();
  });

  it('getCachedProductCanonicalRedirectTarget throws on query error', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(productQueryError);

    await expect(
      getCachedProductCanonicalRedirectTarget('merchant-123', 'missing-product')
    ).rejects.toEqual(productQueryError.error);
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
    expect(selectArg).toContain('created_at');
    expect(selectArg).toContain('updated_at');
    expect(selectArg).toContain('product_key_specs (');
    expect(selectArg).toContain('has_ois');
    expect(selectArg).not.toContain('product_variants');
  });

  it('uses ByteString-safe product cache tags for non-ASCII product slugs', async () => {
    const productSlug = 'dell-alienware-x14-r2-–-14”';
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);

    await getCachedProductWithDetails('merchant-123', productSlug);

    const expectedTag = getProductScopedCacheTag(
      'product',
      'merchant-123',
      productSlug
    );
    expect(cacheTag).toHaveBeenCalledWith(
      'product',
      'product-details',
      expectedTag
    );
    expect(expectedTag).not.toContain('–');
    expect(expectedTag).not.toContain('”');
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
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).not.toMatch(standaloneCurrencyColumnPattern);
    expect(selectArg).not.toMatch(standaloneQuantityColumnPattern);
    expect(selectArg).not.toMatch(standaloneTrackQuantityColumnPattern);
    expect(selectArg).toContain('quantity:stock_quantity');
    expect(selectArg).toContain('track_quantity:manage_stock');
    expect(selectArg).not.toContain('is_featured');
  });

  it('getCachedProducts can skip storefront variant hydration for listing-only callers', async () => {
    harness.mockListResult.data = productList;
    harness.mockListResult.error = null;

    await expect(
      getCachedProducts('merchant-123', { includeVariants: false })
    ).resolves.toEqual([
      expect.objectContaining({ id: 'product-123', product_variants: [] }),
      expect.objectContaining({ id: 'product-456', product_variants: [] }),
    ]);
    expect(harness.mockRpc).not.toHaveBeenCalledWith(
      'get_storefront_product_variants',
      expect.any(Object)
    );
  });

  it('getCachedProducts does not filter by the retired is_featured column', async () => {
    harness.mockListResult.data = productList;
    harness.mockListResult.error = null;

    await getCachedProducts('merchant-123', { featured: true });

    expect(harness.mockEq).not.toHaveBeenCalledWith('is_featured', true);
  });

  it('getCachedProducts maps price fields to legacy base/sale fields', async () => {
    harness.mockListResult.data = [
      {
        id: 'product-123',
        slug: 'iphone-16',
        price: 950000,
        compare_at_price: 1000000,
      },
      {
        id: 'product-456',
        slug: 'iphone-15',
        price: 500000,
        compare_at_price: null,
      },
    ];
    harness.mockListResult.error = null;
    harness.mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await getCachedProducts('merchant-123');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'product-123',
        base_price: 1000000,
        sale_price: 950000,
      }),
      expect.objectContaining({
        id: 'product-456',
        base_price: 500000,
        sale_price: null,
      }),
    ]);
  });

  it('getCachedProducts applies serialized-then-unlimited fallback to simple products', async () => {
    harness.mockListResult.data = [
      {
        id: 'product-123',
        manage_stock: true,
        quantity: 0,
        slug: 'iphone-16',
        stock_quantity: 0,
      },
    ];
    harness.mockListResult.error = null;
    harness.mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    vi.mocked(
      getPublicSerializedVariantSummariesByProductId
    ).mockResolvedValueOnce([
      {
        inventoryTrackingPolicy: 'serialized_then_unlimited',
        productId: 'product-123',
        publicAvailableUnits: 0,
        variantId: null,
      },
    ] satisfies PublicSerializedVariantSummary[]);

    await expect(getCachedProducts('merchant-123')).resolves.toEqual([
      expect.objectContaining({
        id: 'product-123',
        inventory_tracking_policy: 'serialized_then_unlimited',
        manage_stock: false,
        quantity: 9999,
        stock: 9999,
        stock_quantity: 9999,
        track_quantity: false,
      }),
    ]);
    expect(getPublicSerializedVariantSummariesByProductId).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(Function) }),
      'merchant-123',
      ['product-123']
    );
  });

  it('getCachedProducts gracefully degrades when serialized summary fetch fails', async () => {
    const fetchError = new Error('RPC failed');
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    harness.mockListResult.data = [{ id: 'product-123', slug: 'iphone-16' }];
    harness.mockListResult.error = null;
    harness.mockRpc.mockResolvedValueOnce({ data: [], error: null });
    vi.mocked(
      getPublicSerializedVariantSummariesByProductId
    ).mockRejectedValueOnce(fetchError);

    await expect(getCachedProducts('merchant-123')).resolves.toEqual([
      expect.objectContaining({ id: 'product-123' }),
    ]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching serialized variant summaries:',
      fetchError
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
    harness.mockMaybeSingle.mockResolvedValueOnce(productQueryError);

    await expect(
      getCachedProduct('merchant-123', 'missing-product')
    ).resolves.toBeNull();
  });

  it('getCachedProduct treats an expected missing lookup as null without logging an error', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    harness.mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      getCachedProduct('merchant-123', 'legacy-product-slug')
    ).resolves.toBeNull();

    expect(harness.mockMaybeSingle).toHaveBeenCalledOnce();
    expect(harness.mockSingle).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('getCachedProduct attaches storefront variants from the public RPC', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);
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

  it('getCachedProduct maps price fields to legacy base/sale fields', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'product-123',
        slug: 'iphone-16',
        price: 910000,
        compare_at_price: 950000,
      },
      error: null,
    });
    harness.mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await getCachedProduct('merchant-123', 'iphone-16');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'product-123',
        base_price: 950000,
        sale_price: 910000,
      })
    );
  });

  it('getCachedProduct falls back to empty variants when the public RPC fails', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce(singleProductResult);
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
        is_active: true,
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
    const productIdsResult = {
      data: [{ id: 'product-1' }, { id: 'product-2' }],
      error: null,
    };
    const productQueryResult = {
      data: [
        { id: 'product-1', name: 'iPhone 15', brand: 'Apple' },
        { id: 'product-2', name: 'Galaxy S24', brand: 'Samsung' },
      ],
      error: null,
    };
    harness.mockQueryExecution
      .mockImplementationOnce(() => Promise.resolve(harness.mockListResult))
      .mockImplementationOnce(() => Promise.resolve(productIdsResult))
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
    expect(harness.mockEq).toHaveBeenCalledWith('is_active', true);
    expect(harness.mockLimit).not.toHaveBeenCalled();
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).toContain('product_key_specs (');
    expect(selectArg).not.toMatch(/,\s*product_key_specs\s*,/);
    expect(result.products).toEqual(productQueryResult.data);
    expect(harness.mockOrder).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(harness.mockOrder).toHaveBeenCalledWith('id', {
      ascending: true,
    });
    expect(harness.mockRange).not.toHaveBeenCalled();
  });

  it('getCachedCategoryPageData applies deterministic ordering to collection ID lists', async () => {
    const collectionCases = [
      {
        slug: 'new-arrivals',
        primaryOrder: ['created_at', { ascending: false }],
      },
      {
        slug: 'best-sellers',
        primaryOrder: ['rating', { ascending: false }],
      },
      {
        slug: 'featured',
        primaryOrder: ['price', { ascending: false }],
      },
      {
        slug: 'on-sale',
        primaryOrder: ['updated_at', { ascending: false }],
      },
    ] as const;

    for (const { slug, primaryOrder } of collectionCases) {
      harness = buildCachedDataTestHarness();

      await getCachedCategoryPageData('merchant-123', slug, 'test-store');

      expect(harness.mockOrder).toHaveBeenCalledWith(...primaryOrder);
      expect(harness.mockOrder).toHaveBeenCalledWith('id', {
        ascending: true,
      });
      expect(harness.mockRange).not.toHaveBeenCalled();

      if (slug === 'on-sale') {
        expect(harness.mockNot).toHaveBeenCalledWith(
          'compare_at_price',
          'is',
          null
        );
      }
    }
  });

  it('getCachedCategoryPageData keeps legacy category fallback products and stable ranged ordering', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });
    harness.mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const legacyProductIds = [{ id: 'legacy-product-1' }];
    const legacyProducts = [{ id: 'legacy-product-1', name: 'Laptop Pro' }];
    harness.mockQueryExecution
      .mockResolvedValueOnce({
        data: legacyProductIds,
        error: null,
      })
      .mockResolvedValueOnce({
        data: legacyProducts,
        error: null,
      });

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'gaming-laptops',
      'test-store'
    );

    expect(harness.mockFrom).toHaveBeenCalledWith('products');
    expect(harness.mockOr).toHaveBeenCalledWith(
      'category.ilike.%Gaming Laptops%,brand.ilike.%Gaming Laptops%,name.ilike.%Gaming Laptops%'
    );
    expect(harness.mockOrder).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(harness.mockOrder).toHaveBeenCalledWith('id', {
      ascending: true,
    });
    expect(harness.mockRange).not.toHaveBeenCalled();
    expect(result.isCollection).toBe(false);
    expect(result.products).toEqual(legacyProducts);
    if (!result.isCollection) {
      expect(result.productsQueryFailed).toBe(false);
    }
  });

  it('getCachedCategoryPageData does not use loose fallback for active canonical categories with no products', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-empty',
        name: 'Empty Category',
        slug: 'empty-category',
        description: 'No products yet',
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

    harness.mockListResult.data = [{ id: 'cat-empty' }];
    harness.mockQueryExecution
      .mockImplementationOnce(() => Promise.resolve(harness.mockListResult))
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: [],
          error: null,
        })
      );

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'empty-category',
      'test-store'
    );

    expect(harness.mockOr).toHaveBeenCalledTimes(1);
    expect(harness.mockOr).toHaveBeenCalledWith(
      'id.eq.cat-empty,parent_id.eq.cat-empty'
    );
    expect(harness.mockQueryExecution).toHaveBeenCalledTimes(2);
    expect(result.products).toEqual([]);
  });

  it('getCachedCategoryPageData marks inactive categories without loose fallback products', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: {
        id: 'cat-stale',
        name: 'Stale Category',
        slug: 'stale-category',
        description: 'Old category',
        image_url: null,
        is_active: false,
        seo_heading: null,
        seo_description: null,
        seo_features: null,
        seo_faq: null,
        parent: null,
      },
      error: null,
    });

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'stale-category',
      'test-store'
    );

    expect(result).toMatchObject({
      isCollection: false,
      category: null,
      fallbackName: 'Stale Category',
      fallbackDescription: 'Old category',
      isInactiveCategory: true,
      products: [],
    });
    expect(harness.mockQueryExecution).not.toHaveBeenCalled();
    expect(harness.mockOr).not.toHaveBeenCalled();
  });

  it('getCachedCategoryPageData detects inactive categories hidden by public RLS', async () => {
    harness.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });
    harness.mockRpc.mockResolvedValueOnce({
      data: [{ is_active: false }],
      error: null,
    });

    const result = await getCachedCategoryPageData(
      'merchant-123',
      'hidden-category',
      'test-store'
    );

    expect(harness.mockRpc).toHaveBeenCalledWith(
      'get_storefront_category_slug_state',
      {
        p_merchant_id: 'merchant-123',
        p_slug: 'hidden-category',
      }
    );
    expect(result).toMatchObject({
      isCollection: false,
      category: null,
      fallbackName: 'Hidden Category',
      isInactiveCategory: true,
      products: [],
    });
    expect(harness.mockQueryExecution).not.toHaveBeenCalled();
    expect(harness.mockOr).not.toHaveBeenCalled();
  });
});
