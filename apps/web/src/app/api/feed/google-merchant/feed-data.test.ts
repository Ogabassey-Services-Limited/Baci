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

let domainResult: DomainResult;
let productsResult: ProductsResult;
let manifestResult: ManifestResult;
const mockManifestStatusEq = vi.fn();

function createMockSupabase() {
  return {
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
                  limit: () => Promise.resolve(productsResult),
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
  mockManifestStatusEq.mockResolvedValue(manifestResult);
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
    const { getCachedGoogleMerchantFeedData } = await import('./feed-data');
    const result = await getCachedGoogleMerchantFeedData(
      'merchant-1',
      'ogabassey'
    );

    expect(result.products[0]).toMatchObject({
      id: 'product-1',
      name: 'Phone',
    });
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
      categories: {
        name: 'Phones',
        slug: 'phones',
      },
      category_slug: 'phones',
      category: 'Phones',
    });
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
