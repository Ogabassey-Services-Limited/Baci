import { beforeEach, describe, expect, it, vi } from 'vitest';

const MERCHANT_ID = '0b9f6b1a-3c2d-4e5f-8a7b-9c0d1e2f3a4b';
const PRODUCT_ID = '1c8e5a2b-4d3c-4f6a-9b8c-0d1e2f3a4b5c';

const mocks = vi.hoisted(() => ({
  revalidateProductSlugs: vi.fn(),
  revalidateProducts: vi.fn(),
}));

vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: {
    revalidateProducts: (...args: unknown[]) =>
      mocks.revalidateProducts(...args),
    revalidateProductSlugs: (...args: unknown[]) =>
      mocks.revalidateProductSlugs(...args),
  },
}));

import { revalidateSeoProductCaches } from './revalidate-seo-product-caches';

interface ProductQuery {
  data: unknown;
  error: unknown;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
}

function createProductQuery(result: { data?: unknown; error?: unknown }) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
  } as ProductQuery;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  return query;
}

function createSupabaseClient({
  products,
}: {
  products: { data?: unknown; error?: unknown };
}) {
  const productQuery = createProductQuery(products);
  const from = vi.fn((table: string) => {
    if (table === 'products') return productQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    productQuery,
    supabase: { from } as never,
  };
}

describe('revalidateSeoProductCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates public product tags for active SEO writes', async () => {
    const { productQuery, supabase } = createSupabaseClient({
      products: {
        data: [
          {
            id: PRODUCT_ID,
            slug: 'leather-tote',
            name: 'Leather Tote Bag',
            category: 'Bags',
            categories: null,
            product_categories: [],
          },
        ],
      },
    });

    await revalidateSeoProductCaches(supabase, MERCHANT_ID, [PRODUCT_ID]);

    expect(productQuery.eq).toHaveBeenNthCalledWith(
      1,
      'merchant_id',
      MERCHANT_ID
    );
    expect(productQuery.eq).toHaveBeenNthCalledWith(2, 'status', 'active');
    expect(productQuery.in).toHaveBeenCalledWith('id', [PRODUCT_ID]);
    expect(mocks.revalidateProducts).toHaveBeenCalledWith(
      MERCHANT_ID,
      undefined,
      { feedScope: 'merchant' }
    );
    expect(mocks.revalidateProductSlugs).toHaveBeenCalledWith(MERCHANT_ID, [
      'leather-tote',
    ]);
  });

  it('does not alter a mutation outcome when the public-row lookup fails', async () => {
    const { supabase } = createSupabaseClient({
      products: { error: { message: 'read unavailable' } },
    });

    await expect(
      revalidateSeoProductCaches(supabase, MERCHANT_ID, [PRODUCT_ID])
    ).resolves.toBeUndefined();
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.revalidateProductSlugs).not.toHaveBeenCalled();
  });

  it('contains tag revalidation failures after a successful public write', async () => {
    const { supabase } = createSupabaseClient({
      products: {
        data: [
          {
            id: PRODUCT_ID,
            slug: 'leather-tote',
            name: 'Leather Tote Bag',
            category: 'Bags',
            categories: null,
            product_categories: [],
          },
        ],
      },
    });
    mocks.revalidateProducts.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    await expect(
      revalidateSeoProductCaches(supabase, MERCHANT_ID, [PRODUCT_ID])
    ).resolves.toBeUndefined();
    expect(mocks.revalidateProductSlugs).not.toHaveBeenCalled();
  });
});
