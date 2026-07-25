import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
  createAnonClient: vi.fn(),
  searchStorefrontProducts: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: mocks.createAgenticScopedSupabaseClient,
}));

// The copilot tenant is now resolved slug -> id on a plain anon client before
// the scoped client can be built, so this factory must be mocked or every
// handler fails closed.
vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

vi.mock('@/lib/storefront-search', () => ({
  searchStorefrontProducts: mocks.searchStorefrontProducts,
}));

import { resetAgenticMerchantIdCache } from '@/lib/agentic/agentic-merchant-id';
import {
  handleCheckPaymentStatus,
  handleCreateVirtualAccount,
  handleGetProductDetails,
  handleGetRecommendations,
  handleSearchProducts,
} from './chat-tool-handlers';

const OGABASSEY_MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

function mockTenantLookup(merchantId: string | null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: merchantId ? { id: merchantId } : null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mocks.createAnonClient.mockReturnValue({ from: vi.fn(() => ({ select })) });
}

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
    vi.unstubAllEnvs();
    mocks.searchStorefrontProducts.mockReset();
    resetAgenticMerchantIdCache();
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mockTenantLookup(OGABASSEY_MERCHANT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
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

    expect(query.eq).toHaveBeenCalledWith('merchant_id', OGABASSEY_MERCHANT_ID);
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          maxPrice: 1_400_000,
          minPrice: 1_200_000,
        }),
        limit: 10,
        merchantId: OGABASSEY_MERCHANT_ID,
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
        merchantId: OGABASSEY_MERCHANT_ID,
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
        merchantId: OGABASSEY_MERCHANT_ID,
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
        merchantId: OGABASSEY_MERCHANT_ID,
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
        merchantId: OGABASSEY_MERCHANT_ID,
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
    expect(query.eq).toHaveBeenCalledWith('merchant_id', OGABASSEY_MERCHANT_ID);
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
    expect(query.eq).toHaveBeenCalledWith('merchant_id', OGABASSEY_MERCHANT_ID);
    expect(query.eq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(mocks.createAgenticScopedSupabaseClient).toHaveBeenCalledWith({
      merchantId: OGABASSEY_MERCHANT_ID,
      merchantSlug: 'ogabassey',
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
    expect(query.eq).toHaveBeenCalledWith('merchant_id', OGABASSEY_MERCHANT_ID);
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
      OGABASSEY_MERCHANT_ID
    );
    expect(sourceQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(recommendationQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      OGABASSEY_MERCHANT_ID
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

  describe('fails closed when the copilot tenant is unresolvable', () => {
    beforeEach(() => {
      // No BACI_AGENTIC_MERCHANT_SLUG configured: the tenant cannot be derived,
      // so no handler may fall back to a hardcoded merchant.
      vi.unstubAllEnvs();
      resetAgenticMerchantIdCache();
      mocks.createAgenticScopedSupabaseClient.mockReturnValue({
        from: vi.fn(() => createQueryMock()),
        rpc: vi.fn(),
      });
    });

    it('returns no products from search without building a scoped client', async () => {
      const result = await handleSearchProducts({ query: 'laptop' });

      expect(result).toEqual({ products: [], total: 0 });
      expect(mocks.createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
      expect(mocks.searchStorefrontProducts).not.toHaveBeenCalled();
    });

    it('returns null product details', async () => {
      const result = await handleGetProductDetails({ productId: 'product-1' });

      expect(result).toBeNull();
      expect(mocks.createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
    });

    it('returns no recommendations', async () => {
      const result = await handleGetRecommendations({
        productId: 'source-product',
        type: 'upsell',
      });

      expect(result).toEqual([]);
      expect(mocks.createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
    });

    it('reports not_found for payment status', async () => {
      const result = await handleCheckPaymentStatus(
        { orderId: 'order-1' },
        'session-1'
      );

      expect(result).toEqual({ status: 'not_found' });
      expect(mocks.createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
    });

    it('refuses virtual account creation without writing a chat order', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await handleCreateVirtualAccount(
        {
          amount: 100,
          items: [{ productId: 'p1', name: 'Phone', price: 100, quantity: 1 }],
          customerEmail: 'buyer@example.com',
          customerName: 'Buyer',
        },
        'session-1'
      );

      // Money-adjacent: no chat_orders row may be inserted under an unknown tenant.
      expect(result).toEqual({
        success: false,
        error: 'Failed to create order',
      });
      expect(mocks.createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
    });
  });

  it('creates the chat order under the resolved tenant and still blocks the unintegrated Kuda transfer', async () => {
    const insertQuery = createQueryMock({
      data: { id: 'chat-order-1' },
      error: null,
    });
    const insert = vi.fn(() => insertQuery);
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await handleCreateVirtualAccount(
      {
        amount: 200,
        items: [{ productId: 'p1', name: 'Phone', price: 100, quantity: 2 }],
        customerEmail: 'buyer@example.com',
        customerName: 'Buyer',
      },
      'session-1'
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: OGABASSEY_MERCHANT_ID,
        session_id: 'session-1',
        subtotal: 200,
        status: 'pending_payment',
      })
    );
    expect(result.success).toBe(false);
    expect(result.orderId).toBe('chat-order-1');
  });
});
