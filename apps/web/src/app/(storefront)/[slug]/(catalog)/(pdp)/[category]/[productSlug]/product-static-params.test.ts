import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCachedStorefrontProductIndex } = vi.hoisted(() => ({
  mockGetCachedStorefrontProductIndex: vi.fn(),
}));

vi.mock('@/lib/cached-storefront-product-index', () => ({
  getCachedStorefrontProductIndex: (...args: unknown[]) =>
    mockGetCachedStorefrontProductIndex(...args),
}));

import { OGABASSEY_DOMAIN, OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import {
  PRERENDER_PLACEHOLDER_PRODUCT_SLUG,
  PRERENDER_PLACEHOLDER_STORE_SLUG,
  resolveProductStaticParams,
} from './product-static-params';

describe('resolveProductStaticParams', () => {
  const PRERENDER_PLACEHOLDER = {
    slug: PRERENDER_PLACEHOLDER_STORE_SLUG,
    category: 'smartphones',
    productSlug: PRERENDER_PLACEHOLDER_PRODUCT_SLUG,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedStorefrontProductIndex.mockReset();
  });

  it('maps the newest OgaBassey products to prerender params', async () => {
    mockGetCachedStorefrontProductIndex.mockResolvedValue({
      hasError: false,
      products: [
        { slug: 'galaxy-z-trifold', category_slug: 'smartphones' },
        { slug: 'macbook-pro-m3-max', category_slug: 'laptops' },
      ],
    });

    const params = await resolveProductStaticParams();

    expect(mockGetCachedStorefrontProductIndex).toHaveBeenCalledWith(
      OGABASSEY_MERCHANT_ID,
      { page: 1, limit: 200 }
    );
    expect(params).toEqual([
      {
        slug: OGABASSEY_DOMAIN,
        category: 'gaming-laptops',
        productSlug: 'dell-alienware-m18-r3-rtx-5080',
      },
      {
        slug: OGABASSEY_DOMAIN,
        category: 'smartphones',
        productSlug: 'galaxy-z-trifold',
      },
      {
        slug: OGABASSEY_DOMAIN,
        category: 'laptops',
        productSlug: 'macbook-pro-m3-max',
      },
    ]);
  });

  it('pages through the full index until a short page and prerenders every product', async () => {
    const fullPage = Array.from({ length: 200 }, (_, index) => ({
      slug: `product-${index}`,
      category_slug: 'smartphones',
    }));
    const shortPage = [{ slug: 'last-product', category_slug: 'laptops' }];
    mockGetCachedStorefrontProductIndex.mockImplementation(
      async (...args: unknown[]) =>
        (args[1] as { page: number }).page === 1
          ? { hasError: false, products: fullPage }
          : { hasError: false, products: shortPage }
    );

    const params = await resolveProductStaticParams();

    // Page 1 was full (200), so the walk fetches page 2; page 2 is short, so
    // the walk stops there instead of running to the max-pages cap.
    expect(mockGetCachedStorefrontProductIndex).toHaveBeenCalledTimes(2);
    expect(mockGetCachedStorefrontProductIndex).toHaveBeenNthCalledWith(
      2,
      OGABASSEY_MERCHANT_ID,
      { page: 2, limit: 200 }
    );
    // 1 priority + 200 page-1 + 1 page-2.
    expect(params).toHaveLength(202);
    expect(params).toEqual(
      expect.arrayContaining([
        {
          slug: OGABASSEY_DOMAIN,
          category: 'laptops',
          productSlug: 'last-product',
        },
      ])
    );
  });

  it('keeps already-collected pages when a later index page fails', async () => {
    const fullPage = Array.from({ length: 200 }, (_, index) => ({
      slug: `product-${index}`,
      category_slug: 'smartphones',
    }));
    mockGetCachedStorefrontProductIndex.mockImplementation(
      async (...args: unknown[]) =>
        (args[1] as { page: number }).page === 1
          ? { hasError: false, products: fullPage }
          : { hasError: true, products: [] }
    );

    const params = await resolveProductStaticParams();

    // The page-2 failure must not throw away page 1 or fall back to the
    // placeholder: a partial prerender set still ships.
    expect(params).toHaveLength(201);
    expect(params).not.toEqual(
      expect.arrayContaining([expect.objectContaining(PRERENDER_PLACEHOLDER)])
    );
  });

  it('deduplicates repeated category/slug pairs and skips incomplete rows', async () => {
    mockGetCachedStorefrontProductIndex.mockResolvedValue({
      hasError: false,
      products: [
        { slug: 'galaxy-z-trifold', category_slug: 'smartphones' },
        { slug: 'galaxy-z-trifold', category_slug: 'smartphones' },
        { slug: '  ', category_slug: 'laptops' },
        { slug: 'orphan', category_slug: undefined },
      ],
    });

    const params = await resolveProductStaticParams();

    expect(params).toEqual([
      {
        slug: OGABASSEY_DOMAIN,
        category: 'gaming-laptops',
        productSlug: 'dell-alienware-m18-r3-rtx-5080',
      },
      {
        slug: OGABASSEY_DOMAIN,
        category: 'smartphones',
        productSlug: 'galaxy-z-trifold',
      },
    ]);
  });

  it('keeps monitored high-value OgaBassey PDPs in the prerender set when they are outside the newest-products window', async () => {
    mockGetCachedStorefrontProductIndex.mockResolvedValue({
      hasError: false,
      products: [{ slug: 'galaxy-z-trifold', category_slug: 'smartphones' }],
    });

    const params = await resolveProductStaticParams();

    expect(params).toEqual(
      expect.arrayContaining([
        {
          slug: OGABASSEY_DOMAIN,
          category: 'gaming-laptops',
          productSlug: 'dell-alienware-m18-r3-rtx-5080',
        },
      ])
    );
  });

  it('falls back to an invalid-store prerender placeholder when the index reports an error', async () => {
    mockGetCachedStorefrontProductIndex.mockResolvedValue({
      hasError: true,
      products: [],
    });

    const params = await resolveProductStaticParams();

    expect(params).toEqual([PRERENDER_PLACEHOLDER]);
  });

  it('keeps monitored high-value PDPs when the index lookup is empty', async () => {
    mockGetCachedStorefrontProductIndex.mockResolvedValue({
      hasError: false,
      products: [],
    });

    const params = await resolveProductStaticParams();

    expect(params).toEqual([
      {
        slug: OGABASSEY_DOMAIN,
        category: 'gaming-laptops',
        productSlug: 'dell-alienware-m18-r3-rtx-5080',
      },
    ]);
  });

  it('falls back to the prerender placeholder when the index lookup rejects', async () => {
    mockGetCachedStorefrontProductIndex.mockRejectedValue(
      new Error('supabase unavailable during prerender')
    );

    const params = await resolveProductStaticParams();

    expect(params).toEqual([PRERENDER_PLACEHOLDER]);
  });
});
