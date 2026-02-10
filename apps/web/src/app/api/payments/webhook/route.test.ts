import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

// Mock environment variables
vi.mock('@/env', () => ({
  env: {
    KORAPAY_SECRET_KEY: 'test-korapay-secret',
    PAYSTACK_SECRET_KEY: 'test-paystack-secret',
    NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
  },
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));

// Mock Next.js server with after function
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    after: vi.fn((callback: () => Promise<void>) => {
      // Execute callback immediately in tests (not in background)
      callback().catch(() => {
        // Ignore errors in background tasks
      });
    }),
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Supabase clients - create fresh mocks for each test
// We need to track multiple calls to from() for different tables
let mockSupabaseClient: any;
let mockServiceClient: any;

function createMockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn((table: string) => {
      // Create a new chain for each table call
      const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return chain;
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

// Create initial mocks
mockSupabaseClient = createMockSupabaseClient();
mockServiceClient = createMockSupabaseClient();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn((cookieStore?: any) => {
    // Support both signatures: createClient() and createClient(cookieStore)
    if (cookieStore) {
      // Synchronous return for createClient(cookieStore)
      return mockSupabaseClient;
    }
    // Async return for createClient()
    return Promise.resolve(mockSupabaseClient);
  }),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
}));

// Mock payment gateways
vi.mock('@/lib/korapay', () => ({
  verifyPayment: vi.fn(),
}));

vi.mock('@/lib/paystack', () => ({
  verifyTransaction: vi.fn(),
  calculatePlatformFee: vi.fn(() => ({
    platformFee: 2000, // 20 NGN in kobo
  })),
}));

// Mock email and notifications
vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(() => '<html>Email</html>'),
  generateOrderConfirmationText: vi.fn(() => 'Email text'),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: vi.fn(),
  notifyPaymentReceived: vi.fn(),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/go54', () => ({
  registerDomain: vi.fn(),
}));

vi.mock('@/lib/trigger-purchase-conversion', () => ({
  triggerPurchaseConversion: vi.fn(),
}));

vi.mock('@/services/insurance', () => ({
  purchaseInsuranceForPaidOrder: vi.fn(),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'MOCK123'),
}));

// Mock reference schema
vi.mock('@/schemas/payments', () => ({
  referenceSchema: {
    safeParse: vi.fn((value: unknown) => {
      if (typeof value === 'string' && value.length > 0) {
        return { success: true, data: value };
      }
      return { success: false, error: { message: 'Invalid reference' } };
    }),
  },
}));

// Helper to create HMAC signature
function createSignature(payload: string, secret: string): string {
  return createHmac('sha512', secret).update(payload).digest('hex');
}

// Helper to create mock request
function createMockRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  const bodyString = JSON.stringify(body);
  const url = 'https://example.com/api/payments/webhook';

  return {
    text: vi.fn(() => Promise.resolve(bodyString)),
    json: vi.fn(() => Promise.resolve(body)),
    headers: new Headers(headers),
    url,
  } as unknown as NextRequest;
}

// Helper to setup service client for successful transaction processing
function setupSuccessfulTransactionMocks(
  transactionData: Record<string, unknown> = {}
) {
  const defaultTransaction = {
    id: 'txn-123',
    merchant_id: 'merchant-123',
    amount: '1000',
    currency: 'NGN',
    gateway_reference: 'REF123',
    status: 'pending',
    order_id: null,
    metadata: {},
    ...transactionData,
  };

  // Mock the from() method to return different chains based on table name
  vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
    if (table === 'transactions') {
      // First call: .select().eq().single() for transaction lookup
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: defaultTransaction,
          error: null,
        }),
      };

      // Second call: .update().eq().neq().select().maybeSingle() for transaction update
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'txn-123' },
          error: null,
        }),
      };

      // Track call count to return appropriate chain
      let callCount = 0;
      return {
        select: vi.fn(() => {
          callCount++;
          return selectChain;
        }),
        update: vi.fn(() => updateChain),
      } as any;
    }

    // Default chain for other tables
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  // Mock RPC for settlement recording
  vi.mocked(mockServiceClient.rpc).mockResolvedValue({
    data: null,
    error: null,
  });
}

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock clients
    mockServiceClient = createMockSupabaseClient();
    mockSupabaseClient = createMockSupabaseClient();
    process.env.KORAPAY_SECRET_KEY = 'test-korapay-secret';
    process.env.PAYSTACK_SECRET_KEY = 'test-paystack-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Signature Verification', () => {
    it('returns 401 when Korapay signature is invalid', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        event: 'charge.success',
      };

      const request = createMockRequest(body, {
        'x-korapay-signature': 'invalid-signature',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Invalid signature' });
    });

    it('returns 401 when Paystack signature is invalid', async () => {
      const body = {
        event: 'charge.success',
        data: {
          reference: 'REF123',
        },
      };

      const request = createMockRequest(body, {
        'x-paystack-signature': 'invalid-signature',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Invalid signature' });
    });

    it('returns 401 when signature header is missing', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
      };

      const request = createMockRequest(body);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Invalid signature' });
    });

    it('accepts valid Korapay signature', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        event: 'charge.success',
        amount: 1000,
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      // Mock successful payment verification
      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          amount: 1000,
          reference: 'REF123',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      // Setup successful transaction mocks
      setupSuccessfulTransactionMocks();

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('accepts valid Paystack signature', async () => {
      const body = {
        event: 'charge.success',
        data: {
          reference: 'REF123',
          amount: 100000, // Paystack uses kobo
        },
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-paystack-secret');

      const request = createMockRequest(body, {
        'x-paystack-signature': signature,
      });

      // Mock successful payment verification
      const { verifyTransaction } = await import('@/lib/paystack');
      vi.mocked(verifyTransaction).mockResolvedValue({
        success: true,
        data: {
          id: 1,
          status: 'success',
          amount: 100000,
          reference: 'REF123',
          currency: 'NGN',
          channel: 'card',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: {
            id: 1,
            email: 'test@example.com',
            customer_code: 'CUS_test',
            first_name: null,
            last_name: null,
            phone: null,
          },
          metadata: null,
          fees: 150,
          fees_split: null,
        },
      });

      // Setup successful transaction mocks (Paystack amount is in kobo, so 100000 kobo = 1000 NGN)
      setupSuccessfulTransactionMocks({ amount: '1000' });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('JSON Parsing', () => {
    it('returns 400 when JSON body is invalid', async () => {
      const url = 'https://example.com/api/payments/webhook';
      const invalidJson = 'not-valid-json';
      const signature = createSignature(invalidJson, 'test-korapay-secret');

      const request = {
        text: vi.fn(() => Promise.resolve(invalidJson)),
        json: vi.fn(() => Promise.reject(new Error('Invalid JSON'))),
        headers: new Headers({
          'x-korapay-signature': signature,
        }),
        url,
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Invalid JSON body' });
    });
  });

  describe('Event Filtering', () => {
    it('ignores non-success Korapay events', async () => {
      const body = {
        reference: 'REF123',
        status: 'failed',
        event: 'charge.failed',
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'Event ignored' });
    });

    it('ignores non-success Paystack events', async () => {
      const body = {
        event: 'charge.failed',
        data: {
          reference: 'REF123',
        },
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-paystack-secret');

      const request = createMockRequest(body, {
        'x-paystack-signature': signature,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'Event ignored' });
    });

    it('processes Korapay event with status=success', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        amount: 1000,
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          amount: 1000,
          reference: 'REF123',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      setupSuccessfulTransactionMocks();

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Reference Validation', () => {
    it('returns 400 when reference is invalid', async () => {
      const body = {
        reference: '',
        status: 'success',
        event: 'charge.success',
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Invalid reference' });
    });
  });

  describe('Payment Verification', () => {
    it('returns 400 when payment verification fails', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        event: 'charge.success',
        amount: 1000,
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      // Mock payment verification failure
      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: false,
        error: 'Payment verification failed',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Payment verification failed' });
    });

    it('returns 400 when payment status is not success', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        event: 'charge.success',
        amount: 1000,
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      // Mock payment verification returns failed status
      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'failed',
          amount: 1000,
          reference: 'REF123',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Payment not successful' });
    });
  });

  describe('Transaction Lookup', () => {
    it('returns 404 when transaction is not found', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        event: 'charge.success',
        amount: 1000,
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          amount: 1000,
          reference: 'REF123',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      // Mock transaction not found - setup from() to return a chain that fails
      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found', code: 'PGRST116' },
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Transaction not found' });
    });
  });

  describe('Amount Validation', () => {
    it('returns 400 when payment amount does not match transaction amount', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        event: 'charge.success',
        amount: 2000, // Different from transaction
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          amount: 2000,
          reference: 'REF123',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      // Setup transaction with different amount
      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'txn-123',
                merchant_id: 'merchant-123',
                amount: '1000', // Expected amount
                currency: 'NGN',
                gateway_reference: 'REF123',
                status: 'pending',
              },
              error: null,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Payment amount mismatch' });
    });
  });

  describe('Idempotency', () => {
    it('handles already-processed transactions gracefully', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        event: 'charge.success',
        amount: 1000,
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          amount: 1000,
          reference: 'REF123',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      // Mock transaction lookup and update for already-processed scenario
      let callCount = 0;
      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'transactions') {
          callCount++;
          if (callCount === 1) {
            // First call: transaction lookup
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'txn-123',
                  merchant_id: 'merchant-123',
                  amount: '1000',
                  currency: 'NGN',
                  gateway_reference: 'REF123',
                  status: 'completed', // Already completed
                },
                error: null,
              }),
            } as any;
          }
          // Second call: transaction update
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // Update returns null (transaction already completed)
              error: null,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'Already processed' });
    });
  });

  describe('Success Path', () => {
    it('returns 200 and processes valid webhook successfully', async () => {
      const body = {
        reference: 'REF123',
        status: 'success',
        event: 'charge.success',
        amount: 1000,
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          amount: 1000,
          reference: 'REF123',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      // Setup complex mock for success path with order
      let transactionCallCount = 0;
      let merchantCallCount = 0;
      let orderCallCount = 0;

      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'transactions') {
          transactionCallCount++;
          if (transactionCallCount === 1) {
            // First call: transaction lookup
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'txn-123',
                  merchant_id: 'merchant-123',
                  order_id: 'order-123',
                  amount: '1000',
                  currency: 'NGN',
                  gateway_reference: 'REF123',
                  status: 'pending',
                  metadata: {},
                },
                error: null,
              }),
            } as any;
          }
          if (transactionCallCount === 2) {
            // Second call: transaction update
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              neq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'txn-123' },
                error: null,
              }),
            } as any;
          }
        }

        if (table === 'orders') {
          orderCallCount++;
          // Order update
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'order-123',
                order_number: 'ORD-123',
                customer_name: 'John Doe',
                customer_email: 'john@example.com',
                customer_phone: '+234',
                total: '1000',
                subtotal: '900',
                shipping_fee: '100',
                currency: 'NGN',
                shipping_address: {},
                order_items: [],
              },
              error: null,
            }),
          } as any;
        }

        if (table === 'merchants') {
          merchantCallCount++;
          // Merchant fetch
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'merchant-123',
                business_name: 'Test Store',
                slug: 'test-store',
                email: 'merchant@example.com',
              },
              error: null,
            }),
          } as any;
        }

        // Default chain
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      // Mock RPC call for settlement
      vi.mocked(mockServiceClient.rpc).mockResolvedValue({
        data: null,
        error: null,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        message: 'Payment processed successfully',
      });
    });
  });
});

describe('GET /api/payments/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock clients
    mockServiceClient = createMockSupabaseClient();
    mockSupabaseClient = createMockSupabaseClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const url =
        'https://example.com/api/payments/webhook?reference=REF123&gateway=korapay';
      const request = {
        url,
      } as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Reference Validation', () => {
    it('returns 400 when reference is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const url =
        'https://example.com/api/payments/webhook?reference=&gateway=korapay';
      const request = {
        url,
      } as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Invalid reference' });
    });

    it('returns 400 when reference is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const url = 'https://example.com/api/payments/webhook?gateway=korapay';
      const request = {
        url,
      } as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Invalid reference' });
    });
  });

  describe('Merchant Authorization', () => {
    it('returns 403 when merchant account is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabaseClient.from().single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const url =
        'https://example.com/api/payments/webhook?reference=REF123&gateway=korapay';
      const request = {
        url,
      } as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: 'Merchant account not found' });
    });
  });

  describe('Transaction Lookup', () => {
    it('returns 404 when transaction is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock merchant found
      mockSupabaseClient.from().single.mockResolvedValueOnce({
        data: { id: 'merchant-123' },
        error: null,
      });

      // Mock transaction not found
      mockSupabaseClient.from().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const url =
        'https://example.com/api/payments/webhook?reference=REF123&gateway=korapay';
      const request = {
        url,
      } as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Transaction not found' });
    });

    it('returns 404 when transaction belongs to different merchant (IDOR protection)', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock merchant found
      mockSupabaseClient.from().single.mockResolvedValueOnce({
        data: { id: 'merchant-123' },
        error: null,
      });

      // Mock transaction not found (because merchant_id doesn't match)
      mockSupabaseClient.from().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const url =
        'https://example.com/api/payments/webhook?reference=REF123&gateway=korapay';
      const request = {
        url,
      } as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Transaction not found' });
    });
  });

  describe('Success Path', () => {
    it('returns payment data when transaction is found and verified', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock merchant found
      mockSupabaseClient.from().single.mockResolvedValueOnce({
        data: { id: 'merchant-123' },
        error: null,
      });

      // Mock transaction found
      mockSupabaseClient.from().single.mockResolvedValueOnce({
        data: {
          id: 'txn-123',
          merchant_id: 'merchant-123',
        },
        error: null,
      });

      // Mock Korapay verification
      const { verifyPayment } = await import('@/lib/korapay');
      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          amount: 1000,
          reference: 'REF123',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      const url =
        'https://example.com/api/payments/webhook?reference=REF123&gateway=korapay';
      const request = {
        url,
      } as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        gateway: 'korapay',
        payment: {
          success: true,
          data: { status: 'success', amount: 1000 },
        },
      });
    });

    it('defaults to paystack gateway when gateway param is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabaseClient.from().single.mockResolvedValueOnce({
        data: { id: 'merchant-123' },
        error: null,
      });

      mockSupabaseClient.from().single.mockResolvedValueOnce({
        data: {
          id: 'txn-123',
          merchant_id: 'merchant-123',
        },
        error: null,
      });

      const { verifyTransaction } = await import('@/lib/paystack');
      vi.mocked(verifyTransaction).mockResolvedValue({
        success: true,
        data: {
          id: 1,
          status: 'success',
          amount: 100000,
          reference: 'REF123',
          currency: 'NGN',
          channel: 'card',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: {
            id: 1,
            email: 'test@example.com',
            customer_code: 'CUS_test',
            first_name: null,
            last_name: null,
            phone: null,
          },
          metadata: null,
          fees: 150,
          fees_split: null,
        },
      });

      const url =
        'https://example.com/api/payments/webhook?reference=REF123&gateway=invalid';
      const request = {
        url,
      } as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.gateway).toBe('paystack');
    });
  });
});
