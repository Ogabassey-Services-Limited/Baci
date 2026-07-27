import { beforeEach, describe, expect, it, vi } from 'vitest';

const MERCHANT_ID = '0b9f6b1a-3c2d-4e5f-8a7b-9c0d1e2f3a4b';
const PRODUCT_ID = '1c8e5a2b-4d3c-4f6a-9b8c-0d1e2f3a4b5c';

const mocks = vi.hoisted(() => ({
  revalidateProductSlugs: vi.fn(),
  revalidateProducts: vi.fn(),
  scheduleStorefrontProductPurge: vi.fn(),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: (...args: unknown[]) => mocks.revalidateProducts(...args),
  revalidateProductSlugs: (...args: unknown[]) =>
    mocks.revalidateProductSlugs(...args),
}));
vi.mock('@/lib/storefront-product-purge', () => ({
  scheduleStorefrontProductPurge: (...args: unknown[]) =>
    mocks.scheduleStorefrontProductPurge(...args),
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

function createMerchantQuery(result: { data?: unknown; error?: unknown }) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({
    data: query.data,
    error: query.error,
  });
  return query;
}

function createSupabaseClient({
  merchant,
  products,
}: {
  merchant?: { data?: unknown; error?: unknown };
  products: { data?: unknown; error?: unknown };
}) {
  const productQuery = createProductQuery(products);
  const merchantQuery = createMerchantQuery(merchant ?? {});
  const from = vi.fn((table: string) => {
    if (table === 'products') return productQuery;
    if (table === 'merchants') return merchantQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    merchantQuery,
    productQuery,
    supabase: { from } as never,
  };
}

describe('revalidateSeoProductCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates public product tags and purges the merchant storefront', async () => {
    const { merchantQuery, productQuery, supabase } = createSupabaseClient({
      merchant: { data: { slug: 'test-store' } },
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
    expect(mocks.revalidateProducts).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mocks.revalidateProductSlugs).toHaveBeenCalledWith(MERCHANT_ID, [
      'leather-tote',
    ]);
    expect(merchantQuery.eq).toHaveBeenCalledWith('id', MERCHANT_ID);
    expect(mocks.scheduleStorefrontProductPurge).toHaveBeenCalledWith(
      'test-store',
      [{ slug: 'leather-tote', categorySegment: 'bags' }]
    );
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
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  it('contains tag revalidation failures after a successful public write', async () => {
    const { supabase } = createSupabaseClient({
      merchant: { data: { slug: 'test-store' } },
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
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });
});
