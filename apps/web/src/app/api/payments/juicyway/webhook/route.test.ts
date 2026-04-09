import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JuicywayWebhookPayload } from '@/lib/juicyway';
import { POST } from './route';

// =============================================================================
// Mocks
// =============================================================================

// Mock Next.js server with after function
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    after: vi.fn((callback: () => void | Promise<void>) => {
      Promise.resolve(callback()).catch(() => {
        // Ignore background task errors in tests
      });
    }),
  };
});

vi.mock('@/env', () => ({
  env: {
    JUICYWAY_BUSINESS_ID: 'test-business-id',
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('@/lib/juicyway', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/juicyway')>('@/lib/juicyway');
  return {
    ...actual,
    verifyWebhookSignature: vi.fn(),
  };
});

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(() => '<html>Order Confirmed</html>'),
  generateOrderConfirmationText: vi.fn(() => 'Order Confirmed'),
}));

vi.mock('@/lib/offline-conversions', () => ({
  sendPurchaseConversion: vi.fn(() => Promise.resolve([])),
  logConversionResults: vi.fn(),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createWebhookRequest(payload: JuicywayWebhookPayload): NextRequest {
  return new NextRequest(
    'http://localhost:3000/api/payments/juicyway/webhook',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
      },
    }
  );
}

function createSuccessPayload(
  reference = 'TXN-123456'
): JuicywayWebhookPayload {
  return {
    checksum: 'valid-checksum',
    event: 'payment.session.succeeded',
    data: {
      id: 'payment-id-123',
      amount: 10000,
      currency: 'NGN',
      reference,
      status: 'success',
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone_number: '+2341234567890',
        billing_address: {
          line1: '123 Street',
          city: 'Lagos',
          country: 'NG',
          zip_code: '100001',
        },
        ip_address: '127.0.0.1',
      },
      payment_method: {
        type: 'crypto_address',
      },
      date: '2024-01-01T00:00:00Z',
      description: 'Order payment',
      mode: 'live',
    },
  };
}

function createFailedPayload(): JuicywayWebhookPayload {
  return {
    checksum: 'valid-checksum',
    event: 'payment.session.failed',
    data: {
      id: 'payment-id-456',
      amount: 10000,
      currency: 'NGN',
      reference: 'TXN-FAILED',
      status: 'failed',
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone_number: '+2341234567890',
        billing_address: {
          line1: '123 Street',
          city: 'Lagos',
          country: 'NG',
          zip_code: '100001',
        },
        ip_address: '127.0.0.1',
      },
      payment_method: {
        type: 'crypto_address',
      },
      date: '2024-01-01T00:00:00Z',
      description: 'Order payment',
      mode: 'live',
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/payments/juicyway/webhook', () => {
  let mockVerifyWebhookSignature: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JUICYWAY_BUSINESS_ID = 'test-business-id';
    vi.stubEnv('NODE_ENV', 'test');

    // Get the mock from the mocked module
    const juicyway = await import('@/lib/juicyway');
    mockVerifyWebhookSignature = vi.mocked(juicyway.verifyWebhookSignature);
  });

  // ---------------------------------------------------------------------------
  // Configuration Tests
  // ---------------------------------------------------------------------------

  it('returns 500 when JUICYWAY_BUSINESS_ID is not configured', async () => {
    delete process.env.JUICYWAY_BUSINESS_ID;

    const payload = createSuccessPayload();
    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Server configuration error' });
  });

  // ---------------------------------------------------------------------------
  // Signature Verification Tests
  // ---------------------------------------------------------------------------

  it('returns 401 when webhook signature is invalid', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(false);

    const payload = createSuccessPayload();
    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Invalid signature' });
    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
      'payment.session.succeeded',
      payload.data,
      'valid-checksum',
      'test-business-id'
    );
  });

  // ---------------------------------------------------------------------------
  // Event Type Tests
  // ---------------------------------------------------------------------------

  it('returns 200 for failed payment event', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const payload = createFailedPayload();
    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ message: 'Failure noted' });
  });

  it('returns 200 for ignored non-success event', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const payload: JuicywayWebhookPayload = {
      ...createSuccessPayload(),
      event: 'payment.session.failed', // Not a success event
    };
    payload.data.status = 'failed';

    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ message: 'Failure noted' });
  });

  // ---------------------------------------------------------------------------
  // Transaction Not Found Tests
  // ---------------------------------------------------------------------------

  it('returns 404 when transaction is not found', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      }),
    }));

    (mockSupabase as Record<string, unknown>).from = fromMock;

    const payload = createSuccessPayload();
    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Transaction not found' });
    expect(fromMock).toHaveBeenCalledWith('transactions');
  });

  // ---------------------------------------------------------------------------
  // Idempotency Tests
  // ---------------------------------------------------------------------------

  it('returns 200 when transaction is already completed (idempotent)', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'txn-123',
              status: 'completed', // Already completed
              gateway_reference: 'TXN-123456',
              amount: '10000',
              merchant_id: 'merchant-123',
              order_id: 'order-123',
            },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    (mockSupabase as Record<string, unknown>).from = fromMock;

    const payload = createSuccessPayload();
    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ message: 'Already processed' });
  });

  // ---------------------------------------------------------------------------
  // Successful Payment Processing Tests
  // ---------------------------------------------------------------------------

  it('returns 200 and processes successful payment', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = {
      id: 'txn-123',
      status: 'pending',
      gateway_reference: 'TXN-123456',
      amount: '10000',
      gateway_fee: '150',
      platform_fee: '150',
      merchant_id: 'merchant-123',
      order_id: 'order-123',
    };

    const order = {
      id: 'order-123',
      order_number: 'ORD-001',
      customer_email: 'customer@example.com',
      customer_name: 'Jane Doe',
      customer_phone: '+2341234567890',
      subtotal: '9500',
      shipping_fee: '500',
      total: '10000',
      currency: 'NGN',
      customer_id: 'customer-123',
      shipping_address: {
        address: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
      },
      order_items: [
        {
          id: 'item-1',
          name: 'Product A',
          quantity: 1,
          price: 9500,
          product_id: 'prod-1',
        },
      ],
      ad_tracking: null,
    };

    const merchant = {
      business_name: 'Test Store',
      slug: 'test-store',
      support_email: 'support@test-store.com',
      email_sender_name: 'Test Store',
      email: 'admin@test-store.com',
      offline_conversions_enabled: false,
    };

    let transactionCallCount = 0;
    let orderUpdated = false;

    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount++;
        if (transactionCallCount === 1) {
          // First call: fetch transaction
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: transaction, error: null }),
          };
        }
        // Second call: update transaction
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'orders') {
        return {
          update: vi.fn(() => {
            orderUpdated = true;
            return {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: order, error: null }),
            };
          }),
        };
      }

      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: merchant, error: null }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    (mockSupabase as Record<string, unknown>).from = fromMock;
    mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

    const payload = createSuccessPayload();
    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      message: 'Payment processed successfully',
    });
    expect(transactionCallCount).toBe(2); // Should have been called twice (fetch + update)
    expect(orderUpdated).toBe(true);

    // Verify RPC was called for settlement
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.objectContaining({
        p_merchant_id: 'merchant-123',
        p_source_type: 'order',
        p_source_id: 'order-123',
        p_gateway: 'juicyway',
        p_gateway_reference: 'TXN-123456',
        p_gross_amount: 10000,
        p_gateway_fee: 150,
        p_platform_fee: 150,
        p_description: 'Order payment via Juicyway',
      })
    );
  });

  it('processes payment without order_id', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = {
      id: 'txn-123',
      status: 'pending',
      gateway_reference: 'TXN-123456',
      amount: '10000',
      gateway_fee: '150',
      platform_fee: '150',
      merchant_id: 'merchant-123',
      order_id: null, // No order_id
    };

    let transactionCallCount = 0;

    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount++;
        if (transactionCallCount === 1) {
          // First call: fetch transaction
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: transaction, error: null }),
          };
        }
        // Second call: update transaction
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    (mockSupabase as Record<string, unknown>).from = fromMock;
    mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

    const payload = createSuccessPayload();
    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      message: 'Payment processed successfully',
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling Tests
  // ---------------------------------------------------------------------------

  it('returns 500 on unexpected error', async () => {
    mockVerifyWebhookSignature.mockRejectedValue(
      new Error('Crypto API failure')
    );

    const payload = createSuccessPayload();
    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Webhook processing failed',
      details: 'Crypto API failure',
    });
  });

  it('returns 400 when reference is missing', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const payload = createSuccessPayload();
    payload.data.reference = ''; // Empty reference

    const request = createWebhookRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Missing reference' });
  });
});
