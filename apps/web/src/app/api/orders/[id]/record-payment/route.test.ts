import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

// Mock environment variables
vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
  getRootDomain: vi.fn(() => 'usebaci.com'),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock next/server after()
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    after: vi.fn(),
  };
});

// Mock API auth
const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantIdForApiUser = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
  getMerchantIdForApiUser: mockGetMerchantIdForApiUser,
}));

// Mock Supabase server client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock email templates
vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(() => '<html>Confirmation</html>'),
  generateOrderConfirmationText: vi.fn(() => 'Confirmation text'),
  generatePaymentReceiptEmail: vi.fn(() => '<html>Receipt</html>'),
  generatePaymentReceiptText: vi.fn(() => 'Receipt text'),
}));

// Mock zeptomail
const mockSendEmail = vi.fn();
vi.mock('@/lib/zeptomail', () => ({
  sendEmail: mockSendEmail,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock trigger-purchase-conversion
vi.mock('@/lib/trigger-purchase-conversion', () => ({
  triggerPurchaseConversion: vi.fn(),
}));

// Mock insurance service
vi.mock('@/services/insurance', () => ({
  purchaseInsuranceForPaidOrder: vi.fn(),
}));

describe('POST /api/orders/[id]/record-payment', () => {
  const mockOrderId = 'order-123';
  const mockMerchantId = 'merchant-456';
  const mockUserId = 'user-789';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(undefined);
  });

  const createRequest = (body: unknown) => {
    return new NextRequest(
      `http://localhost/api/orders/${mockOrderId}/record-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
  };

  it('returns 400 when amount is missing', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });

    const request = createRequest({
      payment_method: 'bank_transfer',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid amount' });
  });

  it('returns 400 when amount is zero', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });

    const request = createRequest({
      amount: 0,
      payment_method: 'cash',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid amount' });
  });

  it('returns 400 when amount is negative', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });

    const request = createRequest({
      amount: -100,
      payment_method: 'cash',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid amount' });
  });

  it('returns 401 when authentication fails', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Invalid token',
      user: null,
      supabase: null,
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Invalid token' });
  });

  it('returns 401 when user is not authenticated', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: null,
      supabase: mockSupabaseClient,
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 404 when merchant not found', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(null);

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Merchant not found' });
  });

  it('returns 404 when merchant details not found', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    const mockFrom = vi.fn(() => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Merchant not found' },
        }),
      };
      return chain;
    });
    mockSupabaseClient.from = mockFrom;

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Merchant details not found' });
  });

  it('returns 404 when order not found', async () => {
    // Arrange
    const mockMerchant = {
      id: mockMerchantId,
      business_name: 'Test Store',
      slug: 'test-store',
      support_email: 'support@test.com',
      email_sender_name: 'Test',
      email: 'merchant@test.com',
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    let callCount = 0;
    const mockFrom = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call: merchant details
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
        return chain;
      }
      // Second call: order
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Order not found' },
        }),
      };
      return chain;
    });
    mockSupabaseClient.from = mockFrom;

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Order not found' });
  });

  it('returns 500 when transaction insert fails', async () => {
    // Arrange
    const mockMerchant = {
      id: mockMerchantId,
      business_name: 'Test Store',
      slug: 'test-store',
      support_email: 'support@test.com',
      email_sender_name: 'Test',
      email: 'merchant@test.com',
    };

    const mockOrder = {
      id: mockOrderId,
      merchant_id: mockMerchantId,
      order_number: 'ORD-001',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+1234567890',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'pending',
      shipping_status: 'pending',
      wallet_amount_used: 0,
      order_items: [{ name: 'Product 1', quantity: 2, price: 4500 }],
      shipping_address: {
        address: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
      },
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    let callCount = 0;
    const mockFrom = vi.fn((_table: string) => {
      callCount++;
      if (callCount === 1) {
        // First call: idempotency check (transactions lookup by reference)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // Second call: merchant details
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 3) {
        // Third call: order
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 4) {
        // Fourth call: transactions query (has TWO .eq() calls)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      // Fifth call: transaction insert
      return {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };
    });
    mockSupabaseClient.from = mockFrom;

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-123',
      notes: 'Test payment',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to record payment' });
  });

  it('returns 400 when the request body cannot be parsed', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });

    const request = new NextRequest(
      `http://localhost/api/orders/${mockOrderId}/record-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{invalid-json',
      }
    );
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid request body' });
  });

  it('returns 200 and marks order as paid when full payment is made', async () => {
    // Arrange
    const mockMerchant = {
      id: mockMerchantId,
      business_name: 'Test Store',
      slug: 'test-store',
      support_email: 'support@test.com',
      email_sender_name: 'Test',
      email: 'merchant@test.com',
    };

    const mockOrder = {
      id: mockOrderId,
      merchant_id: mockMerchantId,
      order_number: 'ORD-001',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+1234567890',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'pending',
      shipping_status: 'pending',
      wallet_amount_used: 0,
      order_items: [{ name: 'Product 1', quantity: 2, price: 4500 }],
      shipping_address: {
        address: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
      },
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    let callCount = 0;
    const mockFrom = vi.fn((_table: string) => {
      callCount++;
      if (callCount === 1) {
        // First call: idempotency check (transactions lookup by reference)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // Second call: merchant details
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 3) {
        // Third call: order
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 4) {
        // Fourth call: transactions query (no .single())
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
        Object.assign(chain, Promise.resolve({ data: [], error: null }));
        return chain;
      }
      if (callCount === 5) {
        // Fifth call: transaction insert
        const chain = {
          insert: vi.fn().mockReturnThis(),
        };
        Object.assign(
          chain,
          Promise.resolve({ data: { id: 'txn-123' }, error: null })
        );
        return chain;
      }
      // Sixth call: order update
      const chain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      Object.assign(chain, Promise.resolve({ data: mockOrder, error: null }));
      return chain;
    });
    mockSupabaseClient.from = mockFrom;

    const request = createRequest({
      amount: 10000,
      payment_method: 'bank_transfer',
      reference: 'REF-123',
      notes: 'Full payment',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      amount_paid: 10000,
      new_balance: 0,
      updated_status: {
        payment_status: 'paid',
        shipping_status: 'processing',
      },
    });
  });

  it('returns 200 and marks order as partially_paid when partial payment is made', async () => {
    // Arrange
    const mockMerchant = {
      id: mockMerchantId,
      business_name: 'Test Store',
      slug: 'test-store',
      support_email: 'support@test.com',
      email_sender_name: 'Test',
      email: 'merchant@test.com',
    };

    const mockOrder = {
      id: mockOrderId,
      merchant_id: mockMerchantId,
      order_number: 'ORD-001',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+1234567890',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'pending',
      shipping_status: 'pending',
      wallet_amount_used: 0,
      order_items: [{ name: 'Product 1', quantity: 2, price: 4500 }],
      shipping_address: {
        address: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
      },
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    let callCount = 0;
    const mockFrom = vi.fn((_table: string) => {
      callCount++;
      if (callCount === 1) {
        // First call: idempotency check (transactions lookup by reference)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // Second call: merchant details
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 3) {
        // Third call: order
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 4) {
        // Fourth call: transactions query (no .single())
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
        Object.assign(chain, Promise.resolve({ data: [], error: null }));
        return chain;
      }
      if (callCount === 5) {
        // Fifth call: transaction insert
        const chain = {
          insert: vi.fn().mockReturnThis(),
        };
        Object.assign(
          chain,
          Promise.resolve({ data: { id: 'txn-123' }, error: null })
        );
        return chain;
      }
      // Sixth call: order update
      const chain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      Object.assign(chain, Promise.resolve({ data: mockOrder, error: null }));
      return chain;
    });
    mockSupabaseClient.from = mockFrom;

    const request = createRequest({
      amount: 5000,
      payment_method: 'cash',
      reference: 'REF-456',
      notes: 'Partial payment',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      amount_paid: 5000,
      new_balance: 5000,
      updated_status: {
        payment_status: 'partially_paid',
        shipping_status: 'processing',
      },
    });
  });

  it('calculates correct balance with existing transactions', async () => {
    // Arrange
    const mockMerchant = {
      id: mockMerchantId,
      business_name: 'Test Store',
      slug: 'test-store',
      support_email: 'support@test.com',
      email_sender_name: 'Test',
      email: 'merchant@test.com',
    };

    const mockOrder = {
      id: mockOrderId,
      merchant_id: mockMerchantId,
      order_number: 'ORD-001',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+1234567890',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'partially_paid',
      shipping_status: 'pending',
      wallet_amount_used: 1000,
      order_items: [{ name: 'Product 1', quantity: 2, price: 4500 }],
      shipping_address: {
        address: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
      },
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    let callCount = 0;
    const mockFrom = vi.fn((_table: string) => {
      callCount++;
      if (callCount === 1) {
        // First call: merchant details
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 2) {
        // Second call: order
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 3) {
        // Third call: transactions query (existing payment of 4000)
        // Route does: .select('amount').eq('order_id', id).eq('status', 'completed')
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ amount: 4000 }],
              error: null,
            }),
          }),
        };
      }
      if (callCount === 4) {
        // Fourth call: transaction insert (new payment of 5000)
        return {
          insert: vi.fn().mockResolvedValue({
            data: { id: 'txn-123' },
            error: null,
          }),
        };
      }
      // Fifth call: order update
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        }),
      };
    });
    mockSupabaseClient.from = mockFrom;

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    // Total: 10000, Wallet: 1000, Previous: 4000, New: 5000 = 10000 fully paid
    expect(data).toEqual({
      success: true,
      amount_paid: 5000,
      new_balance: 0,
      updated_status: {
        payment_status: 'paid',
        shipping_status: 'processing',
      },
    });
  });

  it('does not update shipping_status if already shipped', async () => {
    // Arrange
    const mockMerchant = {
      id: mockMerchantId,
      business_name: 'Test Store',
      slug: 'test-store',
      support_email: 'support@test.com',
      email_sender_name: 'Test',
      email: 'merchant@test.com',
    };

    const mockOrder = {
      id: mockOrderId,
      merchant_id: mockMerchantId,
      order_number: 'ORD-001',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+1234567890',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'pending',
      shipping_status: 'shipped',
      wallet_amount_used: 0,
      order_items: [{ name: 'Product 1', quantity: 2, price: 4500 }],
      shipping_address: {
        address: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
      },
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    let callCount = 0;
    const mockFrom = vi.fn((_table: string) => {
      callCount++;
      if (callCount === 1) {
        // First call: merchant details
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 2) {
        // Second call: order
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 3) {
        // Third call: transactions query (no .single())
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
        Object.assign(chain, Promise.resolve({ data: [], error: null }));
        return chain;
      }
      if (callCount === 4) {
        // Fourth call: transaction insert
        const chain = {
          insert: vi.fn().mockReturnThis(),
        };
        Object.assign(
          chain,
          Promise.resolve({ data: { id: 'txn-123' }, error: null })
        );
        return chain;
      }
      // Fifth call: order update
      const chain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      Object.assign(chain, Promise.resolve({ data: mockOrder, error: null }));
      return chain;
    });
    mockSupabaseClient.from = mockFrom;

    const request = createRequest({
      amount: 10000,
      payment_method: 'bank_transfer',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    // Should only update payment_status, not shipping_status
    expect(data).toEqual({
      success: true,
      amount_paid: 10000,
      new_balance: 0,
      updated_status: {
        payment_status: 'paid',
      },
    });
  });

  it('handles missing optional fields gracefully', async () => {
    // Arrange
    const mockMerchant = {
      id: mockMerchantId,
      business_name: 'Test Store',
      slug: 'test-store',
      support_email: 'support@test.com',
      email_sender_name: 'Test',
      email: 'merchant@test.com',
    };

    const mockOrder = {
      id: mockOrderId,
      merchant_id: mockMerchantId,
      order_number: 'ORD-001',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+1234567890',
      total: 5000,
      subtotal: 4500,
      shipping_fee: 500,
      currency: 'NGN',
      payment_status: 'pending',
      shipping_status: 'pending',
      wallet_amount_used: 0,
      order_items: [{ name: 'Product 1', quantity: 1, price: 4500 }],
      shipping_address: {
        address: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
      },
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    let callCount = 0;
    const mockFrom = vi.fn((_table: string) => {
      callCount++;
      if (callCount === 1) {
        // First call: merchant details
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 2) {
        // Second call: order
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
        return chain;
      }
      if (callCount === 3) {
        // Third call: transactions query (no .single())
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
        Object.assign(chain, Promise.resolve({ data: [], error: null }));
        return chain;
      }
      if (callCount === 4) {
        // Fourth call: transaction insert
        const chain = {
          insert: vi.fn().mockReturnThis(),
        };
        Object.assign(
          chain,
          Promise.resolve({ data: { id: 'txn-123' }, error: null })
        );
        return chain;
      }
      // Fifth call: order update
      const chain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      Object.assign(chain, Promise.resolve({ data: mockOrder, error: null }));
      return chain;
    });
    mockSupabaseClient.from = mockFrom;

    const request = createRequest({
      amount: 5000,
      // No payment_method, reference, or notes provided
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      amount_paid: 5000,
      new_balance: 0,
      updated_status: {
        payment_status: 'paid',
        shipping_status: 'processing',
      },
    });
  });
});
