import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

// Mock env
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://mock.supabase.co',
  getSupabaseAnonKey: () => 'mock-key',
  getSupabaseServiceRoleKey: () => 'mock-service-key',
  getRootDomain: () => 'localhost:3000',
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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

// Mock other dependencies
vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(),
  generateOrderConfirmationText: vi.fn(),
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
    // Mock unauthenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
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

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: authUserId } },
      error: null,
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

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: authUserId } },
      error: null,
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
});
