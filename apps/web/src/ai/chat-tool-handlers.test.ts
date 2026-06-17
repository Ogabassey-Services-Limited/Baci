import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: mocks.createAgenticScopedSupabaseClient,
}));

import {
  handleCheckPaymentStatus,
  handleGetProductDetails,
  handleGetRecommendations,
  handleSearchProducts,
} from './chat-tool-handlers';

const OGABASSEY_MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

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
  });

  it('searches active products across names, descriptions, brands, and categories with price filters', async () => {
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
    expect(query.or).toHaveBeenCalledWith(
      'name.ilike.%laptop%,description.ilike.%laptop%,brand.ilike.%laptop%,category.ilike.%laptop%'
    );
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

    expect(query.or).toHaveBeenCalledWith(
      'name.ilike.%MacBook%,description.ilike.%MacBook%,brand.ilike.%MacBook%,category.ilike.%MacBook%,name.ilike.%Laptops%,description.ilike.%Laptops%,brand.ilike.%Laptops%,category.ilike.%Laptops%'
    );
    expect(query.ilike).not.toHaveBeenCalled();
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
});
