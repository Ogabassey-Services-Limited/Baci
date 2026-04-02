import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateApiRequest } from '@/lib/api-auth';
import { POST } from './route';

const {
  mockNotifyNewOrder,
  mockNotifyPaymentReceived,
  mockSendEmail,
  mockCreateGiglShipment,
  mockAfter,
} =
  vi.hoisted(() => ({
    mockNotifyNewOrder: vi.fn(() => Promise.resolve()),
    mockNotifyPaymentReceived: vi.fn(() => Promise.resolve()),
    mockSendEmail: vi.fn(() => Promise.resolve({ success: true })),
    mockCreateGiglShipment: vi.fn(),
    mockAfter: vi.fn((callback: () => unknown) => callback()),
  }));

// Mock env
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://mock.supabase.co',
  getSupabaseAnonKey: () => 'mock-key',
  getSupabaseServiceRoleKey: () => 'mock-service-key',
  getRootDomain: () => 'localhost:3000',
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  hasPermission: vi.fn(() => true),
}));

// Shared mock for chainable methods
const sharedChainableMock: any = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: {
      id: '123e4567-e89b-12d3-a456-426614174000', // Matches validOrderPayload
      business_name: 'Test Merchant',
      country: 'NG',
      slug: 'test-merchant',
      support_email: 'support@example.com',
      email_sender_name: 'Test Store',
      email: 'merchant@example.com',
    },
    error: null,
  }),
  insert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockReturnThis(),
  // biome-ignore lint/suspicious/noThenProperty: needed for thenable mock
  then: (resolve: any) => Promise.resolve().then(resolve),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => sharedChainableMock),
  rpc: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'order-id',
        order_number: 'ORD-123',
        total: 1000,
        subtotal: 1000,
        shipping_fee: 0,
        customer_id: 'customer-id',
      },
    ],
    error: null,
  }),
};

function mockAuthUser(id: string) {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>(
    'next/server'
  );

  return {
    ...actual,
    after: mockAfter,
  };
});

// Mock other dependencies
vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(),
  generateOrderConfirmationText: vi.fn(),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: mockNotifyNewOrder,
  notifyPaymentReceived: mockNotifyPaymentReceived,
}));

vi.mock('@/lib/gigl', () => ({
  createGiglShipment: mockCreateGiglShipment,
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@/lib/geo-privacy', () => ({
  detectPrivacyRegion: vi.fn().mockResolvedValue({
    country: 'NG',
    region: 'Lagos',
    shouldApplyLDU: false,
  }),
}));

vi.mock('@/lib/shipping/providers/gigl', () => ({
  createGiglShipment: vi.fn(),
  giglProvider: {
    getLocations: vi.fn().mockResolvedValue([]),
  },
}));

// Mock logger to suppress console noise
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Order API Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
  });

  const validOrderPayload = {
    merchant_id: '123e4567-e89b-12d3-a456-426614174000',
    customer_email: 'customer@example.com',
    customer_name: 'Test Customer',
    customer_phone: '1234567890',
    items: [
      {
        product_id: 'product-id',
        quantity: 1,
        price: 1000,
        name: 'Test Product',
      },
    ],
    subtotal: 1000,
    shipping_fee: 0,
    discount_amount: 0,
    tax_amount: 0,
    payment_method: 'card',
    payment_status: 'unpaid',
    shipping_status: 'pending',
    shipping_address: {
      address: '123 Test St',
      city: 'Lagos',
      state: 'Lagos',
    },
    user_id: '123e4567-e89b-12d3-a456-426614174001', // Valid UUID
  };

  it('should prevent unauthenticated users from setting user_id', async () => {
    // Mock unauthenticated request (guest checkout)
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const request = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify(validOrderPayload),
    });

    await POST(request);

    // Verify RPC call has p_user_id: null
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_user_id: null, // CRITICAL: Must be null
      })
    );
  });

  it('should allow authenticated users to use their own user_id', async () => {
    const authUserId = '123e4567-e89b-12d3-a456-426614174002'; // Valid UUID

    // Mock authenticated request
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: mockAuthUser(authUserId),
      error: null,
      supabase: mockSupabase as unknown as never,
    });

    const request = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...validOrderPayload,
        user_id: authUserId, // Matches auth user
      }),
    });

    await POST(request);

    // Verify RPC call has p_user_id: authUserId
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_user_id: authUserId,
      })
    );
  });

  it('should ignore body user_id and use auth user_id if authenticated', async () => {
    const authUserId = '123e4567-e89b-12d3-a456-426614174002'; // Valid UUID
    const spoofUserId = '123e4567-e89b-12d3-a456-426614174003'; // Valid UUID

    // Mock authenticated request
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: mockAuthUser(authUserId),
      error: null,
      supabase: mockSupabase as unknown as never,
    });

    const request = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...validOrderPayload,
        user_id: spoofUserId, // Mismatch with auth user
      }),
    });

    const response = await POST(request);

    // The API route currently returns 403 on mismatch.
    // "if (user && user_id && user_id !== user.id)"

    expect(response.status).toBe(403);

    // RPC should NOT be called
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('should use mobile Bearer auth to bind p_user_id without relying on cookies', async () => {
    const authUserId = '123e4567-e89b-12d3-a456-426614174004';

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: mockAuthUser(authUserId),
      error: null,
      supabase: mockSupabase as unknown as never,
    });

    const request = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mobile-access-token',
      },
      body: JSON.stringify({
        ...validOrderPayload,
        user_id: authUserId,
      }),
    });

    await POST(request);

    expect(authenticateApiRequest).toHaveBeenCalledOnce();
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_user_id: authUserId,
      })
    );
  });

  it('treats pay_on_delivery like pod for downstream notification handling', async () => {
    const request = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...validOrderPayload,
        payment_method: 'pay_on_delivery',
        payment_status: 'pending',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockAfter).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockNotifyNewOrder).toHaveBeenCalledWith(
      validOrderPayload.merchant_id,
      'ORD-123',
      validOrderPayload.customer_name,
      1000
    );
    expect(mockNotifyPaymentReceived).not.toHaveBeenCalled();
  });

  it('does not try to book GIGL shipments during order creation', async () => {
    const request = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...validOrderPayload,
        shipping_provider: 'GIGL',
        selected_quote_id: '11111111-1111-1111-1111-111111111111',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockCreateGiglShipment).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_selected_quote_id: '11111111-1111-1111-1111-111111111111',
        p_shipping_provider: 'GIGL',
        p_tracking_number: null,
      })
    );
  });

  describe('Variant attributes handling', () => {
    beforeEach(() => {
      vi.mocked(authenticateApiRequest).mockResolvedValue({
        user: mockAuthUser('123e4567-e89b-12d3-a456-426614174099'),
        error: null,
        supabase: mockSupabase as unknown as never,
      });
      // Restore mocks cleared by outer beforeEach
      sharedChainableMock.select.mockReturnThis();
      sharedChainableMock.eq.mockReturnThis();
      sharedChainableMock.single.mockResolvedValue({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          business_name: 'Test Merchant',
          country: 'NG',
          slug: 'test-merchant',
          support_email: 'support@example.com',
          email_sender_name: 'Test Store',
          email: 'merchant@example.com',
        },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            id: 'order-id',
            order_number: 'ORD-123',
            total: 1000,
            subtotal: 1000,
            shipping_fee: 0,
            customer_id: 'customer-id',
          },
        ],
        error: null,
      });
    });

    it('forwards variantAttributes (camelCase) to RPC', async () => {
      const payload = {
        ...validOrderPayload,
        user_id: '123e4567-e89b-12d3-a456-426614174099',
        items: [
          {
            product_id: 'product-id',
            quantity: 1,
            price: 1000,
            name: 'Test Product',
            variantId: 'v1',
            variantAttributes: { color: 'Red', storage: '256GB' },
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await POST(request);

      const rpcArgs = mockSupabase.rpc.mock.calls[0][1];
      const items = Array.isArray(rpcArgs.p_items)
        ? rpcArgs.p_items
        : JSON.parse(rpcArgs.p_items);
      expect(items[0].variant_attributes).toEqual({
        color: 'Red',
        storage: '256GB',
      });
    });

    it('forwards variant_attributes (snake_case) to RPC', async () => {
      const payload = {
        ...validOrderPayload,
        user_id: '123e4567-e89b-12d3-a456-426614174099',
        items: [
          {
            product_id: 'product-id',
            quantity: 1,
            price: 1000,
            name: 'Test Product',
            variant_id: 'v1',
            variant_attributes: { color: 'Blue' },
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      expect(response.status).toBeLessThan(300);

      const rpcArgs = mockSupabase.rpc.mock.calls[0][1];
      const items = Array.isArray(rpcArgs.p_items)
        ? rpcArgs.p_items
        : JSON.parse(rpcArgs.p_items);
      expect(items[0].variant_attributes).toEqual({ color: 'Blue' });
    });

    it('defaults variant_attributes to {} when both keys missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...validOrderPayload,
          user_id: '123e4567-e89b-12d3-a456-426614174099',
        }),
      });

      await POST(request);

      const rpcArgs = mockSupabase.rpc.mock.calls[0][1];
      const items = Array.isArray(rpcArgs.p_items)
        ? rpcArgs.p_items
        : JSON.parse(rpcArgs.p_items);
      expect(items[0].variant_attributes).toEqual({});
    });
  });
});
