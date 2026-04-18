import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(),
}));

vi.mock('@/lib/sanitize-core', () => ({
  isValidUuid: vi.fn(),
  sanitizeForLog: vi.fn((value) => value),
}));

import { cookies } from 'next/headers';
import { isValidUuid, sanitizeForLog } from '@/lib/sanitize-core';
import { createAnonClient } from '@/lib/supabase/anon';
import { createClient } from '@/lib/supabase/server';
import { GET } from './route';

describe('GET /api/storefront/orders/[id]', () => {
  const mockOrderData = {
    id: 'order-uuid-123',
    order_number: 'ORD-001',
    tracking_token: 'track-token-123',
    subtotal: 10000,
    shipping_fee: 1000,
    total: 11000,
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    customer_phone: '+2348012345678',
    shipping_address: '123 Test St',
    payment_status: 'paid',
    shipping_status: 'pending',
    payment_method: 'korapay',
    merchant_id: 'merchant-uuid-456',
  };

  const mockItems = [
    {
      id: 'item-1',
      product_id: 'product-1',
      name: 'Test Product',
      quantity: 2,
      price: 5000,
      products: {
        slug: 'test-product',
        category: 'smartphones',
        categories: [{ name: 'Smartphones', slug: 'smartphones' }],
      },
    },
  ];

  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockAnonClient = {
    rpc: vi.fn(),
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as never);
    vi.mocked(createClient).mockReturnValue(mockSupabaseClient as never);
    vi.mocked(createAnonClient).mockReturnValue(mockAnonClient as never);
    vi.mocked(isValidUuid).mockReturnValue(true);
    vi.mocked(sanitizeForLog).mockImplementation((value) => String(value));

    const mockAnonProductsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'product-1',
            slug: 'test-product',
            category: 'smartphones',
            categories: [{ name: 'Smartphones', slug: 'smartphones' }],
          },
        ],
        error: null,
      }),
    };

    mockAnonClient.from.mockImplementation((table: string) => {
      if (table === 'products') {
        return mockAnonProductsQuery;
      }

      return {};
    });
  });

  it('returns 400 for invalid email format', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-123?email=invalid-email&merchant_slug=test-store'
    );
    const params = Promise.resolve({ id: 'order-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
    expect(data.details).toBeDefined();
  });

  it('returns order via authenticated session lookup and derives category_slug from category joins', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const mockOrderQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockOrderData,
        error: null,
      }),
    };

    const mockItemsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: mockItems,
        error: null,
      }),
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'orders') return mockOrderQuery;
      if (table === 'order_items') return mockItemsQuery;
      return {};
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(mockOrderData.id);
    expect(data.items).toEqual([
      {
        id: 'item-1',
        product_id: 'product-1',
        product_name: 'Test Product',
        name: 'Test Product',
        quantity: 2,
        price: 5000,
        product_images: undefined,
        product_slug: 'test-product',
        category: 'smartphones',
        category_slug: 'smartphones',
        categories: { name: 'Smartphones', slug: 'smartphones' },
      },
    ]);
  });

  it('returns 404 when an authenticated order does not match the requested merchant slug', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123?merchant_slug=other-store'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const mockOrderQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockOrderData,
        error: null,
      }),
    };

    const mockMerchantQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'different-merchant-id' },
        error: null,
      }),
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'orders') return mockOrderQuery;
      if (table === 'merchants') return mockMerchantQuery;
      return {};
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Order not found');
  });

  it('returns an authenticated order when the requested merchant slug matches', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123?merchant_slug=test-store'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const mockOrderQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockOrderData,
        error: null,
      }),
    };

    const mockMerchantQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: mockOrderData.merchant_id },
        error: null,
      }),
    };

    const mockItemsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: mockItems,
        error: null,
      }),
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'orders') return mockOrderQuery;
      if (table === 'merchants') return mockMerchantQuery;
      if (table === 'order_items') return mockItemsQuery;
      return {};
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(mockOrderData.id);
    expect(mockMerchantQuery.eq).toHaveBeenCalledWith('slug', 'test-store');
  });

  it('falls through to RPC lookup when session lookup fails and a tracking token is provided', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123?token=track-token-123&merchant_slug=test-store'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const mockOrderQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'orders') return mockOrderQuery;
      return {};
    });

    mockAnonClient.rpc.mockResolvedValue({
      data: [
        {
          ...mockOrderData,
          items: [
            {
              id: 'item-1',
              product_id: 'product-1',
              name: 'Test Product',
              quantity: 2,
              price: 5000,
            },
          ],
        },
      ],
      error: null,
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(mockOrderData.id);
    expect(mockAnonClient.rpc).toHaveBeenCalledWith('get_order_tracking', {
      p_merchant_slug: 'test-store',
      p_order_id: null,
      p_order_number: null,
      p_email: null,
      p_tracking_token: 'track-token-123',
    });
  });

  it('returns 400 when merchant_slug is missing for public lookup', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      'merchant_slug is required for public order lookup'
    );
  });

  it('returns 400 when tracking token and email are both missing for public lookup', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123?merchant_slug=test-store'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Tracking token or email is required');
  });

  it('accepts tracking_token query parameter', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123?tracking_token=track-token-456&merchant_slug=test-store'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    mockAnonClient.rpc.mockResolvedValue({
      data: [
        {
          ...mockOrderData,
          items: [],
        },
      ],
      error: null,
    });

    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(mockAnonClient.rpc).toHaveBeenCalledWith(
      'get_order_tracking',
      expect.objectContaining({
        p_tracking_token: 'track-token-456',
      })
    );
  });

  it('returns 200 via email lookup', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123?email=john@example.com&merchant_slug=test-store'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    mockAnonClient.rpc.mockResolvedValue({
      data: [
        {
          ...mockOrderData,
          items: [],
        },
      ],
      error: null,
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.customer_email).toBe('john@example.com');
  });

  it('prefers email lookup over token lookup when both are provided', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123?token=track-token-123&email=john@example.com&merchant_slug=test-store'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    mockAnonClient.rpc.mockResolvedValue({
      data: [
        {
          ...mockOrderData,
          items: [],
        },
      ],
      error: null,
    });

    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(mockAnonClient.rpc).toHaveBeenCalledWith('get_order_tracking', {
      p_merchant_slug: 'test-store',
      p_order_id: 'order-uuid-123',
      p_order_number: null,
      p_email: 'john@example.com',
      p_tracking_token: null,
    });
  });

  it('returns 404 when RPC lookup does not find an order', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123?token=missing&merchant_slug=test-store'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    mockAnonClient.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Order not found');
  });

  it('returns 400 for invalid UUID when authenticated and no token is provided', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/not-a-uuid'
    );
    const params = Promise.resolve({ id: 'not-a-uuid' });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    vi.mocked(isValidUuid).mockReturnValue(false);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid order ID');
  });

  it('returns 500 on unexpected errors', async () => {
    const request = new NextRequest(
      'http://localhost/api/storefront/orders/order-uuid-123'
    );
    const params = Promise.resolve({ id: 'order-uuid-123' });

    mockSupabaseClient.auth.getUser.mockRejectedValue(
      new Error('Unexpected error')
    );

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});
