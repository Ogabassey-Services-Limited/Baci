import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
  searchStorefrontProducts: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: mocks.createAgenticScopedSupabaseClient,
}));

vi.mock('@/lib/storefront-search', () => ({
  searchStorefrontProducts: mocks.searchStorefrontProducts,
}));

import {
  handleCheckPaymentStatus as handleCheckPaymentStatusWithMerchant,
  handleGetProductDetails as handleGetProductDetailsWithMerchant,
  handleGetRecommendations as handleGetRecommendationsWithMerchant,
  handleSearchProducts as handleSearchProductsWithMerchant,
} from './chat-tool-handlers';

const TEST_MERCHANT = {
  id: 'merchant-1',
  slug: 'winter-store',
  businessName: 'Winter Store',
} as const;

const handleSearchProducts = (
  params: Parameters<typeof handleSearchProductsWithMerchant>[0]
) => handleSearchProductsWithMerchant(params, TEST_MERCHANT);
const handleGetProductDetails = (
  params: Parameters<typeof handleGetProductDetailsWithMerchant>[0]
) => handleGetProductDetailsWithMerchant(params, TEST_MERCHANT);
const handleGetRecommendations = (
  params: Parameters<typeof handleGetRecommendationsWithMerchant>[0]
) => handleGetRecommendationsWithMerchant(params, TEST_MERCHANT);
const handleCheckPaymentStatus = (
  params: Parameters<typeof handleCheckPaymentStatusWithMerchant>[0],
  sessionId: string
) => handleCheckPaymentStatusWithMerchant(params, sessionId, TEST_MERCHANT);

type QueryResult = {
  data: unknown;
  error?: unknown;
  count?: number | null;
};

function createQueryMock(result: QueryResult = { data: null, error: null }) {
  const query = Object.assign(Promise.resolve(result), {
    select: vi.fn<(...args: unknown[]) => unknown>(),
    eq: vi.fn<(...args: unknown[]) => unknown>(),
    or: vi.fn<(...args: unknown[]) => unknown>(),
    ilike: vi.fn<(...args: unknown[]) => unknown>(),
    neq: vi.fn<(...args: unknown[]) => unknown>(),
    gt: vi.fn<(...args: unknown[]) => unknown>(),
    gte: vi.fn<(...args: unknown[]) => unknown>(),
    lt: vi.fn<(...args: unknown[]) => unknown>(),
    lte: vi.fn<(...args: unknown[]) => unknown>(),
    in: vi.fn<(...args: unknown[]) => unknown>(),
    order: vi.fn<(...args: unknown[]) => unknown>(),
    limit: vi.fn<(...args: unknown[]) => unknown>(),
    single: vi.fn<() => Promise<QueryResult>>(),
    maybeSingle: vi.fn<() => Promise<QueryResult>>(),
  });

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);

  return query;
}

describe('chat tool handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchStorefrontProducts.mockReset();
  });

  it('searches active products across names, descriptions, brands, and categories with price filters', async () => {
    mocks.searchStorefrontProducts.mockResolvedValue({
      count: 1,
      didYouMean: null,
      productIds: ['macbook-air-m4'],
      query: 'laptop',
    });
    const query = createQueryMock({
      data: [
        {
          id: 'macbook-air-m4',
          name: '15" MacBook Air M4 (2025)',
          price: 1_265_000,
          description: 'Apple laptop',
          brand: 'Apple',
          category: 'Laptops',
          images: [{ url: 'https://cdn.example.com/macbook.jpg' }],
          stock: 3,
          status: 'active',
        },
      ],
      error: null,
    });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleSearchProducts({
      query: 'laptop',
      minPrice: 1_200_000,
      maxPrice: 1_400_000,
    });

    expect(query.eq).toHaveBeenCalledWith('merchant_id', TEST_MERCHANT.id);
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          maxPrice: 1_400_000,
          minPrice: 1_200_000,
        }),
        limit: 10,
        merchantId: TEST_MERCHANT.id,
        query: 'laptop',
        trackAnalytics: false,
      })
    );
    expect(query.in).toHaveBeenCalledWith('id', ['macbook-air-m4']);
    expect(query.or).not.toHaveBeenCalled();
    expect(query.gte).toHaveBeenCalledWith('price', 1_200_000);
    expect(query.lte).toHaveBeenCalledWith('price', 1_400_000);
    expect(result).toEqual({
      products: [
        {
          id: 'macbook-air-m4',
          name: '15" MacBook Air M4 (2025)',
          price: 1_265_000,
          description: 'Apple laptop',
          brand: 'Apple',
          category: 'Laptops',
          image_url: 'https://cdn.example.com/macbook.jpg',
          stock: 3,
          status: 'active',
        },
      ],
      total: 1,
    });
  });

  it('uses optional category as an additional search term instead of a hard AND filter', async () => {
    mocks.searchStorefrontProducts.mockResolvedValue({
      count: 0,
      didYouMean: null,
      productIds: [],
      query: 'MacBook Laptops',
    });
    const query = createQueryMock({ data: [], error: null });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    await handleSearchProducts({
      query: 'MacBook',
      category: 'Laptops',
      minPrice: 1_200_000,
      maxPrice: 1_400_000,
    });

    expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: TEST_MERCHANT.id,
        query: 'MacBook Laptops',
        trackAnalytics: false,
      })
    );
    expect(query.or).not.toHaveBeenCalled();
    expect(query.ilike).not.toHaveBeenCalled();
  });

  it('searches by category when no free-text query is provided', async () => {
    mocks.searchStorefrontProducts.mockResolvedValue({
      count: 0,
      didYouMean: null,
      productIds: [],
      query: 'Laptops',
    });
    const query = createQueryMock({ data: [], error: null });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    await handleSearchProducts({
      query: '',
      category: 'Laptops',
      minPrice: 1_200_000,
      maxPrice: 1_400_000,
    });

    expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: TEST_MERCHANT.id,
        query: 'Laptops',
        trackAnalytics: false,
      })
    );
    expect(query.or).not.toHaveBeenCalled();
  });

  it('routes chat product search through shared ranked search and preserves ranked hydration order', async () => {
    mocks.searchStorefrontProducts.mockResolvedValue({
      count: 2,
      didYouMean: null,
      productIds: ['iphone-16-pro', 'iphone-x'],
      query: 'iphnoe',
    });
    const query = createQueryMock({
      count: 2,
      data: [
        {
          id: 'iphone-x',
          name: 'iPhone X',
          price: 240_000,
          description: 'Used iPhone',
          brand: 'Apple',
          category: 'Phones',
          images: [{ url: 'https://cdn.example.com/iphone-x.jpg' }],
          stock: 2,
          status: 'active',
        },
        {
          id: 'iphone-16-pro',
          name: 'iPhone 16 Pro',
          price: 1_200_000,
          description: 'New iPhone',
          brand: 'Apple',
          category: 'Phones',
          images: [{ url: 'https://cdn.example.com/iphone-16-pro.jpg' }],
          stock: 5,
          status: 'active',
        },
      ],
      error: null,
    });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
      rpc: vi.fn(),
    });

    const result = await handleSearchProducts({
      query: 'iphnoe',
      minPrice: 100_000,
      maxPrice: 1_500_000,
    });

    expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          maxPrice: 1_500_000,
          minPrice: 100_000,
        }),
        limit: 10,
        merchantId: TEST_MERCHANT.id,
        query: 'iphnoe',
        trackAnalytics: false,
      })
    );
    expect(query.in).toHaveBeenCalledWith('id', ['iphone-16-pro', 'iphone-x']);
    expect(query.or).not.toHaveBeenCalled();
    expect(result.products.map((product) => product.id)).toEqual([
      'iphone-16-pro',
      'iphone-x',
    ]);
    expect(result.total).toBe(2);
  });

  it('sanitizes PostgREST separator characters before ranked chat search', async () => {
    mocks.searchStorefrontProducts.mockResolvedValue({
      count: 1,
      didYouMean: null,
      productIds: ['iphone-case'],
      query: 'iphone casecover',
    });
    const query = createQueryMock({
      data: [
        {
          id: 'iphone-case',
          name: 'iPhone Case',
          price: 25_000,
          description: 'Protective case',
          brand: 'Apple',
          category: 'Accessories',
          images: [{ url: 'https://cdn.example.com/case.jpg' }],
          stock: 7,
          status: 'active',
        },
      ],
      error: null,
    });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
      rpc: vi.fn(),
    });

    const result = await handleSearchProducts({
      query: 'iphone, case|cover();\\',
    });

    expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'iphone casecover',
      })
    );
    expect(query.or).not.toHaveBeenCalled();
    expect(query.ilike).not.toHaveBeenCalled();
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe('iphone-case');
    expect(result.total).toBe(1);
  });

  it('uses category text as the ranked search query when no free-text query is provided', async () => {
    mocks.searchStorefrontProducts.mockResolvedValue({
      count: 0,
      didYouMean: null,
      productIds: [],
      query: 'Laptops',
    });
    const query = createQueryMock({ data: [], error: null });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
      rpc: vi.fn(),
    });

    const result = await handleSearchProducts({
      query: '',
      category: 'Laptops',
    });

    expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: TEST_MERCHANT.id,
        query: 'Laptops',
        trackAnalytics: false,
      })
    );
    expect(query.or).not.toHaveBeenCalled();
    expect(result).toEqual({ products: [], total: 0 });
  });

  it('returns empty chat search results when ranked search fails', async () => {
    mocks.searchStorefrontProducts.mockRejectedValueOnce(
      new Error('search rpc unavailable')
    );
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(),
      rpc: vi.fn(),
    });

    const result = await handleSearchProducts({
      query: 'iphone',
    });

    expect(result).toEqual({ products: [], total: 0 });
  });

  it('restricts product details to active Ogabassey products', async () => {
    const query = createQueryMock();
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    await handleGetProductDetails({ productId: 'product-1' });

    expect(query.eq).toHaveBeenCalledWith('id', 'product-1');
    expect(query.eq).toHaveBeenCalledWith('merchant_id', TEST_MERCHANT.id);
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('returns null when scoped product details are missing', async () => {
    const query = createQueryMock({ data: null, error: null });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleGetProductDetails({ productId: 'product-1' });

    expect(result).toBeNull();
  });

  it('returns null when product detail lookup fails', async () => {
    const query = createQueryMock({
      data: null,
      error: new Error('database unavailable'),
    });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleGetProductDetails({ productId: 'product-1' });

    expect(result).toBeNull();
  });

  it('returns null when product detail lookup rejects', async () => {
    const query = createQueryMock();
    query.single.mockRejectedValueOnce(new Error('network unavailable'));
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleGetProductDetails({ productId: 'product-1' });

    expect(result).toBeNull();
  });

  it('scopes payment status order lookups to the active chat session', async () => {
    const query = createQueryMock();
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    await handleCheckPaymentStatus({ orderId: 'order-1' }, 'session-1');

    expect(query.eq).toHaveBeenCalledWith('id', 'order-1');
    expect(query.eq).toHaveBeenCalledWith('merchant_id', TEST_MERCHANT.id);
    expect(query.eq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(mocks.createAgenticScopedSupabaseClient).toHaveBeenCalledWith({
      merchantId: TEST_MERCHANT.id,
      merchantSlug: TEST_MERCHANT.slug,
      sessionId: 'session-1',
    });
  });

  it('fails closed when the scoped order lookup has no matching row', async () => {
    const query = createQueryMock({ data: null, error: null });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleCheckPaymentStatus(
      { orderId: 'order-1' },
      'session-1'
    );

    expect(result).toEqual({ status: 'not_found' });
  });

  it('fails closed when the payment status lookup rejects', async () => {
    const query = createQueryMock();
    query.maybeSingle.mockRejectedValueOnce(new Error('network unavailable'));
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleCheckPaymentStatus(
      { orderId: 'order-1' },
      'session-1'
    );

    expect(result).toEqual({ status: 'not_found' });
  });

  it('scopes payment status email lookups to the active chat session', async () => {
    const query = createQueryMock();
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    await handleCheckPaymentStatus(
      { customerEmail: 'buyer@example.com' },
      'session-1'
    );

    expect(query.eq).toHaveBeenCalledWith(
      'customer_email',
      'buyer@example.com'
    );
    expect(query.eq).toHaveBeenCalledWith('merchant_id', TEST_MERCHANT.id);
    expect(query.eq).toHaveBeenCalledWith('session_id', 'session-1');
  });

  it('returns pending payment status only from the scoped session row', async () => {
    const query = createQueryMock({
      data: {
        id: 'order-1',
        status: 'pending_payment',
        paid_at: null,
        created_at: new Date().toISOString(),
        subtotal: 150_000,
        virtual_account_number: '1234567890',
        virtual_account_bank: 'Kuda',
        metadata: null,
      },
      error: null,
    });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleCheckPaymentStatus(
      { orderId: 'order-1' },
      'session-1'
    );

    expect(result).toEqual({
      status: 'pending',
      orderId: 'order-1',
      amount: 150_000,
      accountNumber: '1234567890',
      bankName: 'Kuda',
    });
  });

  it('returns expired payment status after the 30-minute payment window', async () => {
    const query = createQueryMock({
      data: {
        id: 'order-1',
        status: 'pending_payment',
        paid_at: null,
        created_at: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
        subtotal: 150_000,
        virtual_account_number: '1234567890',
        virtual_account_bank: 'Kuda',
        metadata: null,
      },
      error: null,
    });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleCheckPaymentStatus(
      { orderId: 'order-1' },
      'session-1'
    );

    expect(result).toEqual({ status: 'expired', orderId: 'order-1' });
  });

  it('restricts recommendations to active Ogabassey products', async () => {
    const sourceQuery = createQueryMock({
      data: {
        id: 'source-product',
        name: 'Galaxy S26',
        price: 900_000,
        category: 'Smartphones',
        brand: 'Samsung',
      },
      error: null,
    });
    const recommendationQuery = createQueryMock({
      data: [
        {
          id: 'recommended-product',
          name: 'Galaxy S26 Ultra',
          price: 1_100_000,
          description: 'A larger Galaxy model',
          brand: 'Samsung',
          category: 'Smartphones',
          images: [{ url: 'https://cdn.example.com/galaxy.jpg' }],
          stock: 4,
          status: 'active',
        },
      ],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(recommendationQuery);
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({ from });

    const result = await handleGetRecommendations({
      productId: 'source-product',
      type: 'upsell',
    });

    expect(sourceQuery.eq).toHaveBeenCalledWith('id', 'source-product');
    expect(sourceQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      TEST_MERCHANT.id
    );
    expect(sourceQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(recommendationQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      TEST_MERCHANT.id
    );
    expect(recommendationQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(recommendationQuery.neq).toHaveBeenCalledWith(
      'id',
      'source-product'
    );
    expect(result).toEqual([
      {
        id: 'recommended-product',
        name: 'Galaxy S26 Ultra',
        price: 1_100_000,
        description: 'A larger Galaxy model',
        brand: 'Samsung',
        category: 'Smartphones',
        image_url: 'https://cdn.example.com/galaxy.jpg',
        stock: 4,
        status: 'active',
      },
    ]);
  });

  it('returns no recommendations when the scoped source product is missing', async () => {
    const sourceQuery = createQueryMock({ data: null, error: null });
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => sourceQuery),
    });

    const result = await handleGetRecommendations({
      productId: 'source-product',
      type: 'cross_sell',
    });

    expect(result).toEqual([]);
  });

  it('returns no recommendations when source lookup rejects', async () => {
    const sourceQuery = createQueryMock();
    sourceQuery.maybeSingle.mockRejectedValueOnce(
      new Error('network unavailable')
    );
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => sourceQuery),
    });

    const result = await handleGetRecommendations({
      productId: 'source-product',
      type: 'cross_sell',
    });

    expect(result).toEqual([]);
  });
});
