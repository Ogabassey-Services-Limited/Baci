import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAnonClient = vi.fn();

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => mockCreateAnonClient(),
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

type DomainResult = { data: { domain: string } | null; error: unknown };
type ProductsResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};
type ManifestResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};
type VariantRpcResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};
type OffersResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};

let domainResult: DomainResult;
let productsResult: ProductsResult;
let manifestResult: ManifestResult;
let variantRpcResult: VariantRpcResult;
let offersResult: OffersResult;
const mockManifestStatusEq = vi.fn();
const mockRpc = vi.fn();
const mockOffersStatusEq = vi.fn();
const mockProductsRange = vi.fn();

function createMockSupabase() {
  return {
    rpc: mockRpc,
    from: (table: string) => {
      if (table === 'domains') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve(domainResult),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  range: mockProductsRange.mockImplementation(() => ({
                    overrideTypes: () => Promise.resolve(productsResult),
                  })),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'product_feed_images') {
        return {
          select: () => ({
            eq: () => ({
              eq: mockManifestStatusEq,
            }),
          }),
        };
      }

      if (table === 'product_offers') {
        return {
          select: () => ({
            in: () => ({
              eq: mockOffersStatusEq,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  domainResult = {
    data: { domain: 'ogabassey.com' },
    error: null,
  };
  productsResult = {
    data: [{ id: 'product-1', name: 'Phone' }],
    error: null,
  };
  manifestResult = {
    data: [
      {
        product_id: 'product-1',
        verified_url: 'https://cdn.example.com/phone.jpg',
        verified_format: 'jpeg',
        status: 'verified',
        is_primary: true,
        position: 0,
      },
      {
        product_id: 'product-1',
        verified_url: 'https://cdn.example.com/phone-side.jpg',
        verified_format: 'jpeg',
        status: 'verified',
        is_primary: false,
        position: 1,
      },
    ],
    error: null,
  };
  variantRpcResult = {
    data: [],
    error: null,
  };
  offersResult = {
    data: [],
    error: null,
  };
  mockManifestStatusEq.mockResolvedValue(manifestResult);
  mockOffersStatusEq.mockResolvedValue(offersResult);
  mockRpc.mockResolvedValue(variantRpcResult);
  mockCreateAnonClient.mockReturnValue(createMockSupabase());
});

describe('getCachedGoogleMerchantFeedData', () => {
  it('returns custom_domain from the primary domain lookup', async () => {
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.custom_domain).toBe('ogabassey.com');
  });

  it('returns null custom_domain when no primary domain exists', async () => {
    domainResult = { data: null, error: null };
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.custom_domain).toBeNull();
  });

  it('returns products as FeedProduct[]', async () => {
    productsResult = {
      data: [
        {
          id: 'product-1',
          name: 'Phone',
          color: 'Black',
          product_key_specs: {
            ram_gb: 8,
            storage_gb: 256,
          },
        },
      ],
      error: null,
    };

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );
    expect(result.products[0]).toMatchObject({
      id: 'product-1',
      name: 'Phone',
      color: 'Black',
      product_key_specs: {
        ram_gb: 8,
        storage_gb: 256,
      },
      variants: [],
    });
  });

  it('preserves canonical_url for Google and agent feed URL parity', async () => {
    productsResult = {
      data: [
        {
          id: 'product-1',
          name: 'Phone',
          canonical_url: '/gift-cards/phone',
          category: 'Phones',
          slug: 'phone',
        },
      ],
      error: null,
    };

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.products[0]).toMatchObject({
      canonical_url: '/gift-cards/phone',
    });
  });

  it('paginates active products beyond the first Supabase page', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `product-${index}`,
      name: `Phone ${index}`,
    }));
    productsResult = {
      data: fullPage,
      error: null,
    };
    mockProductsRange
      .mockImplementationOnce(() => ({
        overrideTypes: () =>
          Promise.resolve({
            data: fullPage,
            error: null,
          } satisfies ProductsResult),
      }))
      .mockImplementationOnce(() => ({
        overrideTypes: () =>
          Promise.resolve({
            data: [{ id: 'product-1000', name: 'Phone 1000' }],
            error: null,
          } satisfies ProductsResult),
      }));

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(mockProductsRange).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mockProductsRange).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(result.products).toHaveLength(1001);
  });

  it('caps product pagination at the variant RPC product-id limit', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `product-${index}`,
      name: `Phone ${index}`,
    }));
    productsResult = {
      data: fullPage,
      error: null,
    };
    mockProductsRange.mockImplementation((from: number) => ({
      overrideTypes: () =>
        Promise.resolve({
          data: fullPage.map((product, index) => ({
            ...product,
            id: `product-${from + index}`,
          })),
          error: null,
        } satisfies ProductsResult),
    }));

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(mockProductsRange).toHaveBeenCalledTimes(10);
    expect(mockProductsRange).toHaveBeenLastCalledWith(9000, 9999);
    expect(mockRpc).toHaveBeenCalledWith('get_feed_product_variants', {
      p_merchant_id: 'merchant-1',
      p_product_ids: expect.any(Array),
    });
    const [, rpcArgs] = mockRpc.mock.calls[0] ?? [];
    expect(rpcArgs?.p_product_ids).toHaveLength(10_000);
    expect(result.products).toHaveLength(10_000);
  });

  it('hydrates feed variants from the feed RPC', async () => {
    variantRpcResult = {
      data: [
        {
          id: 'variant-1',
          product_id: 'product-1',
          condition: 'used',
          attributes: { storage: '256GB' },
          price_override: 600000,
          sku: 'PHONE-USED-256',
          stock_quantity: 2,
        },
      ],
      error: null,
    };
    mockRpc.mockResolvedValue(variantRpcResult);

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(mockRpc).toHaveBeenCalledWith('get_feed_product_variants', {
      p_merchant_id: 'merchant-1',
      p_product_ids: ['product-1'],
    });
    expect(result.products[0]?.variants).toEqual([
      {
        id: 'variant-1',
        condition: 'used',
        attributes: { storage: '256GB' },
        price_override: 600000,
        sku: 'PHONE-USED-256',
        stock_quantity: 2,
      },
    ]);
  });

  it('initializes feed products with an empty variants array when the RPC returns no rows', async () => {
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.products[0]?.variants).toEqual([]);
  });

  it('throws when the variant RPC fails', async () => {
    variantRpcResult = { data: null, error: { message: 'rpc error' } };
    mockRpc.mockResolvedValue(variantRpcResult);

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');

    await expect(
      getCachedGoogleMerchantFeedData('merchant-1', 'ogabassey')
    ).rejects.toThrow('Failed to fetch product variants');
  });

  it('flattens joined product_categories(categories(name, slug)) into categories and category_slug', async () => {
    productsResult = {
      data: [
        {
          id: 'product-1',
          name: 'Phone',
          product_categories: [
            {
              categories: {
                name: 'Phones',
                slug: 'phones',
              },
            },
          ],
        },
      ],
      error: null,
    };

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.products[0]).toMatchObject({
      id: 'product-1',
      name: 'Phone',
      variants: [],
      categories: {
        name: 'Phones',
        slug: 'phones',
      },
      category_slug: 'phones',
      category: 'Phones',
    });
  });

  it('normalizes missing category_slug to null when no joined category exists', async () => {
    productsResult = {
      data: [
        {
          id: 'product-1',
          name: 'Phone',
        },
      ],
      error: null,
    };

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.products[0]).toMatchObject({
      id: 'product-1',
      name: 'Phone',
      categories: null,
      category: null,
      category_slug: null,
    });
  });

  it('skips product_offers hydration for sku_matrix products', async () => {
    productsResult = {
      data: [
        {
          id: 'product-1',
          name: 'Phone',
          variant_model: 'sku_matrix',
          has_condition_offers: true,
        },
      ],
      error: null,
    };

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(mockOffersStatusEq).not.toHaveBeenCalled();
    expect(result.products[0]?.offers).toBeUndefined();
  });

  it('hydrates product_offers for legacy products that use them', async () => {
    productsResult = {
      data: [
        {
          id: 'product-1',
          name: 'Phone',
          variant_model: 'legacy',
          has_condition_offers: true,
        },
      ],
      error: null,
    };
    offersResult = {
      data: [
        {
          id: 'offer-1',
          product_id: 'product-1',
          condition: 'used',
          price: 420000,
          stock_quantity: 3,
        },
      ],
      error: null,
    };
    mockOffersStatusEq.mockResolvedValue(offersResult);

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(mockOffersStatusEq).toHaveBeenCalled();
    expect(result.products[0]?.offers).toEqual([
      {
        id: 'offer-1',
        condition: 'used',
        price: 420000,
        stock_quantity: 3,
      },
    ]);
  });

  it('throws when the offers query fails', async () => {
    productsResult = {
      data: [
        {
          id: 'product-1',
          name: 'Phone',
          variant_model: 'legacy',
          has_condition_offers: true,
        },
      ],
      error: null,
    };
    offersResult = { data: null, error: { message: 'offers error' } };
    mockOffersStatusEq.mockResolvedValue(offersResult);

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');

    await expect(
      getCachedGoogleMerchantFeedData('merchant-1', 'ogabassey')
    ).rejects.toThrow('Failed to fetch product offers');
  });

  it('groups manifest rows by product_id into imageManifest', async () => {
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.imageManifest['product-1']).toHaveLength(2);
    expect(result.imageManifest['product-1'][0]).toEqual({
      verified_url: 'https://cdn.example.com/phone.jpg',
      verified_format: 'jpeg',
      status: 'verified',
      is_primary: true,
      position: 0,
    });
    expect(result.imageManifest['product-1'][1]).toEqual({
      verified_url: 'https://cdn.example.com/phone-side.jpg',
      verified_format: 'jpeg',
      status: 'verified',
      is_primary: false,
      position: 1,
    });
  });

  it('filters manifest rows down to active feed products', async () => {
    manifestResult = {
      data: [
        {
          product_id: 'product-1',
          verified_url: 'https://cdn.example.com/phone.jpg',
          verified_format: 'jpeg',
          status: 'verified',
          is_primary: true,
          position: 0,
        },
        {
          product_id: 'archived-product',
          verified_url: 'https://cdn.example.com/archived.jpg',
          verified_format: 'jpeg',
          status: 'verified',
          is_primary: true,
          position: 0,
        },
      ],
      error: null,
    };
    mockManifestStatusEq.mockResolvedValue(manifestResult);

    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.imageManifest['product-1']).toHaveLength(1);
    expect(result.imageManifest['archived-product']).toBeUndefined();
  });

  it('returns empty imageManifest when no products exist (short-circuit)', async () => {
    productsResult = { data: [], error: null };
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.products).toEqual([]);
    expect(result.imageManifest).toEqual({});
  });

  it('throws when domain query fails', async () => {
    domainResult = { data: null, error: { message: 'connection error' } };
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');

    await expect(
      getCachedGoogleMerchantFeedData('merchant-1', 'ogabassey')
    ).rejects.toThrow('Failed to fetch merchant domain');
  });

  it('throws when products query fails', async () => {
    productsResult = { data: null, error: { message: 'query error' } };
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');

    await expect(
      getCachedGoogleMerchantFeedData('merchant-1', 'ogabassey')
    ).rejects.toThrow('Failed to fetch products');
  });

  it('throws when manifest query fails', async () => {
    manifestResult = { data: null, error: { message: 'manifest error' } };
    mockManifestStatusEq.mockResolvedValue(manifestResult);
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');

    await expect(
      getCachedGoogleMerchantFeedData('merchant-1', 'ogabassey')
    ).rejects.toThrow('Failed to fetch image manifest');
  });
});
