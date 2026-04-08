import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock Supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(),
}));

// Mock sanitization utilities
vi.mock('@/lib/sanitize-core', () => ({
  isValidUuid: vi.fn(),
  sanitizeForLog: vi.fn((value) => value),
}));

import { cookies } from 'next/headers';
import { isValidUuid, sanitizeForLog } from '@/lib/sanitize-core';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAnonClient } from '@/lib/supabase/anon';
import { createClient } from '@/lib/supabase/server';

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
        category_slug: 'smartphones',
        categories: [{ name: 'Smartphones', slug: 'smartphones' }],
      },
    },
  ];

  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  };

  const mockAdminClient = {
    from: vi.fn(),
  };

  const mockAnonClient = {
    rpc: vi.fn(),
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as any);
    vi.mocked(createClient).mockReturnValue(mockSupabaseClient as any);
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any);
    vi.mocked(createAnonClient).mockReturnValue(mockAnonClient as any);
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
            category_slug: 'smartphones',
            categories: [{ name: 'Smartphones', slug: 'smartphones' }],
          },
        ],
        error: null,
      }),
    };

    mockAnonClient.from.mockImplementation((table: string) => {
      if (table === 'products') return mockAnonProductsQuery;
      return {};
    });
  });

  describe('Input validation', () => {
    it('returns 400 for invalid email format', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-123?email=invalid-email&merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-123' });
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details).toBeDefined();
    });
  });

  describe('Authenticated session lookup', () => {
    it('returns order via authenticated session lookup', async () => {
      // Arrange
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

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.id).toBe(mockOrderData.id);
      expect(data.order_number).toBe(mockOrderData.order_number);
      expect(data.short_id).toBe(mockOrderData.order_number);
      expect(data.shipping_cost).toBe(mockOrderData.shipping_fee);
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
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('orders');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('order_items');
    });

    it('falls through to public lookup when session lookup fails', async () => {
      // Arrange
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
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockOrderQuery);

      const mockMerchantQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'merchant-uuid-456' },
          error: null,
        }),
      };

      const mockAdminOrderQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockOrderData,
          error: null,
        }),
      };

      const mockAdminItemsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockItems,
          error: null,
        }),
      };

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') return mockMerchantQuery;
        if (table === 'orders') return mockAdminOrderQuery;
        if (table === 'order_items') return mockAdminItemsQuery;
        return {};
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.id).toBe(mockOrderData.id);
      expect(mockAdminClient.from).toHaveBeenCalledWith('merchants');
      expect(mockAdminClient.from).toHaveBeenCalledWith('orders');
    });
  });

  describe('Header-based lookup', () => {
    it('returns order via x-merchant-slug header-based lookup', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123',
        {
          headers: {
            'x-merchant-slug': 'test-store',
          },
        }
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const mockMerchantQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'merchant-uuid-456' },
          error: null,
        }),
      };

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

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') return mockMerchantQuery;
        if (table === 'orders') return mockOrderQuery;
        if (table === 'order_items') return mockItemsQuery;
        return {};
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.id).toBe(mockOrderData.id);
      expect(data.short_id).toBe(mockOrderData.order_number);
      expect(mockAdminClient.from).toHaveBeenCalledWith('merchants');
    });
  });

  describe('Slug-based public lookup', () => {
    it('returns order via slug-based public lookup', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123?merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const mockMerchantQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'merchant-uuid-456' },
          error: null,
        }),
      };

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

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') return mockMerchantQuery;
        if (table === 'orders') return mockOrderQuery;
        if (table === 'order_items') return mockItemsQuery;
        return {};
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.id).toBe(mockOrderData.id);
      expect(data.merchant_id).toBe(mockOrderData.merchant_id);
      expect(mockAdminClient.from).toHaveBeenCalledWith('merchants');
      expect(mockAdminClient.from).toHaveBeenCalledWith('orders');
    });

    it('returns 400 when merchant_slug is missing for public lookup', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe(
        'merchant_slug is required for public order lookup'
      );
    });

    it('returns 404 when order not found via slug-based lookup', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123?merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const mockMerchantQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'merchant-uuid-456' },
          error: null,
        }),
      };

      const mockOrderQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') return mockMerchantQuery;
        if (table === 'orders') return mockOrderQuery;
        return {};
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');
    });
  });

  describe('Tracking token lookup', () => {
    it('returns order via tracking token RPC lookup', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123?token=track-token-123&merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      mockAnonClient.rpc.mockResolvedValue({
        data: [
          {
            ...mockOrderData,
            items: mockItems.map((item) => ({
              id: item.id,
              product_id: item.product_id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        ],
        error: null,
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.id).toBe(mockOrderData.id);
      expect(data.tracking_token).toBe('track-token-123');
      expect(data.items).toHaveLength(1);
      expect(data.items[0].product_name).toBe('Test Product');
      expect(mockAnonClient.rpc).toHaveBeenCalledWith('get_order_tracking', {
        p_merchant_slug: 'test-store',
        p_order_id: null,
        p_order_number: null,
        p_email: null,
        p_tracking_token: 'track-token-123',
      });
    });

    it('accepts tracking_token query parameter', async () => {
      // Arrange
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

      // Act
      const response = await GET(request, { params });

      // Assert
      expect(response.status).toBe(200);
      expect(mockAnonClient.rpc).toHaveBeenCalledWith(
        'get_order_tracking',
        expect.objectContaining({
          p_tracking_token: 'track-token-456',
        })
      );
    });
  });

  describe('Email lookup', () => {
    it('returns order via email RPC lookup', async () => {
      // Arrange
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

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.id).toBe(mockOrderData.id);
      expect(data.customer_email).toBe('john@example.com');
      expect(mockAnonClient.rpc).toHaveBeenCalledWith('get_order_tracking', {
        p_merchant_slug: 'test-store',
        p_order_id: 'order-uuid-123',
        p_order_number: null,
        p_email: 'john@example.com',
        p_tracking_token: null,
      });
    });
  });

  describe('RPC lookup validation', () => {
    it('returns 404 when order not found via RPC', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123?token=invalid-token&merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      mockAnonClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');
    });

    it('returns 404 when RPC returns error', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123?token=track-token&merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      mockAnonClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');
    });

    it('returns 400 when tracking token and email are both missing', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123?merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      // Mock merchant found but order not found (to get past slug-based lookup)
      const mockMerchantQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'merchant-uuid-456' },
          error: null,
        }),
      };

      const mockOrderQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') return mockMerchantQuery;
        if (table === 'orders') return mockOrderQuery;
        return {};
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');
    });
  });

  describe('UUID validation', () => {
    it('returns 400 for invalid UUID when authenticated and no token', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/invalid-id'
      );
      const params = Promise.resolve({ id: 'invalid-id' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      vi.mocked(isValidUuid).mockReturnValue(false);

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid order ID');
    });

    it('returns 400 for invalid UUID when using email lookup', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/invalid-id?email=john@example.com&merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'invalid-id' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      // Mock merchant found but order not found (to get past slug-based lookup)
      const mockMerchantQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'merchant-uuid-456' },
          error: null,
        }),
      };

      const mockOrderQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') return mockMerchantQuery;
        if (table === 'orders') return mockOrderQuery;
        return {};
      });

      vi.mocked(isValidUuid).mockReturnValue(false);

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid order ID');
    });
  });

  describe('Error handling', () => {
    it('returns 500 on unexpected error', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Unexpected error')
      );

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('Response format', () => {
    it('normalizes order response with shipping_cost and short_id', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123?token=track-token&merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      mockAnonClient.rpc.mockResolvedValue({
        data: [
          {
            ...mockOrderData,
            shipping_cost: 1500,
            items: [],
          },
        ],
        error: null,
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.shipping_cost).toBe(1500);
      expect(data.short_id).toBe('ORD-001');
    });

    it('maps item properties correctly', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost/api/storefront/orders/order-uuid-123?token=track-token&merchant_slug=test-store'
      );
      const params = Promise.resolve({ id: 'order-uuid-123' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
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
                product_images: ['image1.jpg', 'image2.jpg'],
              },
            ],
          },
        ],
        error: null,
      });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toEqual({
        id: 'item-1',
        product_id: 'product-1',
        product_name: 'Test Product',
        name: 'Test Product',
        quantity: 2,
        price: 5000,
        product_images: ['image1.jpg', 'image2.jpg'],
        product_slug: 'test-product',
        category: 'smartphones',
        category_slug: 'smartphones',
        categories: { name: 'Smartphones', slug: 'smartphones' },
      });
    });
  });
});
