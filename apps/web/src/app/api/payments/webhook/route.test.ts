import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const mockConfirmAgenticPaystackDvaPayment = vi.hoisted(() => vi.fn());
const mockGetPaystackDvaReceiverAccountNumber = vi.hoisted(() => vi.fn());
const mockMarkAgenticPaystackDvaSessionPaid = vi.hoisted(() => vi.fn());

// Mock environment variables
vi.mock('@/env', () => ({
  env: {
    KORAPAY_SECRET_KEY: 'test-korapay-secret',
    PAYSTACK_SECRET_KEY: 'test-paystack-secret',
    NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
  },
}));

vi.mock('@/lib/agentic/paystack-dva-webhook', () => ({
  confirmAgenticPaystackDvaPayment: mockConfirmAgenticPaystackDvaPayment,
  getPaystackDvaReceiverAccountNumber: mockGetPaystackDvaReceiverAccountNumber,
}));

vi.mock('@/lib/agentic/paystack-dva-session-paid', () => ({
  markAgenticPaystackDvaSessionPaid: mockMarkAgenticPaystackDvaSessionPaid,
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
    from: vi.fn((_table: string) => {
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
    // A1: rpc() must be both awaitable AND have a `.single()` chain method
    // so the new claim_payment_side_effect call (`supabase.rpc(...).single()`
    // in apply-paid-order-side-effects.ts) doesn't crash. The default
    // claim response is `we_won: true` so the helper proceeds to the
    // executor; existing `record_merchant_settlement` callers still get
    // `{data: null, error: null}` via either await form.
    rpc: vi.fn((name: string, _args?: unknown) => {
      const data =
        name === 'claim_payment_side_effect'
          ? { we_won: true, current_status: 'claimed' }
          : null;
      const result = { data, error: null };
      const chain = Object.assign(Promise.resolve(result), {
        single: () => Promise.resolve(result),
      });
      return chain;
    }),
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

vi.mock('@/lib/customer-saved-payment-methods', () => ({
  upsertPaystackAuthorization: vi.fn(),
}));

vi.mock('@/lib/vtu-fulfillment', () => ({
  fulfillPendingVtuTransaction: vi.fn(() =>
    Promise.resolve({
      status: 'successful',
      reference: 'VTU-123',
      amount: 1000,
    })
  ),
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

function createKorapaySignature(
  data: Record<string, unknown>,
  secret: string
): string {
  return createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
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
      let _callCount = 0;
      return {
        select: vi.fn(() => {
          _callCount++;
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

  // Mock RPC: chainable shape so the A1 outbox helper's
  // `.rpc('claim_payment_side_effect', ...).single()` works alongside
  // the existing `.rpc('record_merchant_settlement', ...)` await form.
  vi.mocked(mockServiceClient.rpc).mockImplementation((name: string) => {
    const data =
      name === 'claim_payment_side_effect'
        ? { we_won: true, current_status: 'claimed' }
        : null;
    const result = { data, error: null };
    return Object.assign(Promise.resolve(result), {
      single: () => Promise.resolve(result),
    }) as never;
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
    mockConfirmAgenticPaystackDvaPayment.mockResolvedValue({
      handled: false,
    });
    mockGetPaystackDvaReceiverAccountNumber.mockReturnValue(null);
    mockMarkAgenticPaystackDvaSessionPaid.mockResolvedValue({
      ok: true,
    });
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

    it('accepts valid Korapay signature when reference is nested in data', async () => {
      const body = {
        event: 'charge.success',
        data: {
          reference: 'REF123',
          status: 'success',
          amount: 1000,
          currency: 'NGN',
        },
      };
      const signature = createKorapaySignature(
        body.data,
        'test-korapay-secret'
      );

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
      expect(verifyPayment).toHaveBeenCalledWith('REF123');
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
    it('acknowledges already-processed payments when agentic reconciliation fails', async () => {
      const body = {
        event: 'charge.success',
        data: { reference: 'REF123' },
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-paystack-secret');

      const request = createMockRequest(body, {
        'x-paystack-signature': signature,
      });

      const { logger } = await import('@/lib/logger');
      const { verifyTransaction } = await import('@/lib/paystack');
      vi.mocked(verifyTransaction).mockResolvedValue({
        success: true,
        data: {
          id: 1,
          status: 'success',
          amount: 100000,
          reference: 'REF123',
          currency: 'NGN',
          channel: 'bank_transfer',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: {
            customer_code: 'CUS_test',
            email: 'test@example.com',
            first_name: 'Test',
            id: 1,
            last_name: null,
            phone: null,
          },
          metadata: null,
          fees: 0,
          fees_split: null,
        },
      });
      mockMarkAgenticPaystackDvaSessionPaid.mockResolvedValueOnce({
        error: 'session update failed',
        ok: false,
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
                  order_id: 'order-123',
                  amount: '1000',
                  currency: 'NGN',
                  gateway_reference: 'REF123',
                  metadata: {
                    transaction_type: 'agentic_checkout_payment',
                  },
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

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: 'Agentic checkout session reconciliation failed',
      });
      expect(mockMarkAgenticPaystackDvaSessionPaid).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Agentic checkout session reconciliation failed',
          reference: 'REF123',
        })
      );
    });

    it('acknowledges already-processed payments when agentic reconciliation succeeds', async () => {
      const body = {
        event: 'charge.success',
        data: { reference: 'REF123' },
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-paystack-secret');
      const request = createMockRequest(body, {
        'x-paystack-signature': signature,
      });

      const { logger } = await import('@/lib/logger');
      const { verifyTransaction } = await import('@/lib/paystack');
      vi.mocked(verifyTransaction).mockResolvedValue({
        success: true,
        data: {
          id: 1,
          status: 'success',
          amount: 100000,
          reference: 'REF123',
          currency: 'NGN',
          channel: 'bank_transfer',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: {
            customer_code: 'CUS_test',
            email: 'test@example.com',
            first_name: 'Test',
            id: 1,
            last_name: null,
            phone: null,
          },
          metadata: null,
          fees: 0,
          fees_split: null,
        },
      });
      mockMarkAgenticPaystackDvaSessionPaid.mockResolvedValueOnce({
        ok: true,
      });

      let callCount = 0;
      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'transactions') {
          callCount++;
          if (callCount === 1) {
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
                  metadata: {
                    transaction_type: 'agentic_checkout_payment',
                  },
                  status: 'completed',
                },
                error: null,
              }),
            } as any;
          }
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
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
      expect(mockMarkAgenticPaystackDvaSessionPaid).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Transaction already processed',
          reference: 'REF123',
        })
      );
    });

    it('processes an agentic DVA transaction resolved during preflight when the generic lookup misses', async () => {
      const body = {
        event: 'charge.success',
        data: {
          authorization: {
            receiver_bank_account_number: '9812858131',
          },
          reference: 'REF123',
        },
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-paystack-secret');
      const request = createMockRequest(body, {
        'x-paystack-signature': signature,
      });

      const { verifyTransaction } = await import('@/lib/paystack');
      vi.mocked(verifyTransaction).mockResolvedValue({
        success: true,
        data: {
          id: 1,
          status: 'success',
          amount: 10000,
          reference: 'REF123',
          currency: 'NGN',
          channel: 'dedicated_nuban',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: {
            customer_code: 'CUS_test',
            email: 'test@example.com',
            first_name: 'Test',
            id: 1,
            last_name: null,
            phone: null,
          },
          metadata: null,
          fees: 0,
          fees_split: null,
        },
      });
      mockGetPaystackDvaReceiverAccountNumber.mockReturnValue('9812858131');
      mockConfirmAgenticPaystackDvaPayment.mockResolvedValueOnce({
        handled: false,
        transaction: {
          amount: 100,
          currency: 'NGN',
          gateway_reference: 'BAC-TEST123',
          id: 'txn-123',
          merchant_id: 'merchant-123',
          metadata: {
            agentic_checkout_session_id: 'agentic_session_1',
            agentic_virtual_account_number: '9812858131',
            transaction_type: 'agentic_checkout_payment',
          },
          order_id: 'order-123',
          platform_fee: 2,
        },
      });
      mockMarkAgenticPaystackDvaSessionPaid.mockResolvedValueOnce({
        ok: true,
      });

      const transactionSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      });
      const transactionUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'txn-123' },
          error: null,
        }),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      });
      const orderUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            ad_tracking: {},
            currency: 'NGN',
            customer_email: 'buyer@example.com',
            customer_id: 'customer-123',
            customer_name: 'Smoke Buyer',
            customer_phone: '08000000000',
            id: 'order-123',
            merchant_id: 'merchant-123',
            order_items: [],
            order_number: 'ORD-123',
            payment_status: 'paid',
            shipping_address: {},
            shipping_fee: '0',
            shipping_status: 'processing',
            subtotal: '100',
            total: '100',
            updated_at: '2026-01-01T00:00:00Z',
          },
          error: null,
        }),
      });

      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            select: transactionSelect,
            update: transactionUpdate,
          } as any;
        }
        if (table === 'orders') {
          return { update: orderUpdate } as any;
        }
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  business_name: 'Baci Smoke',
                  cac_rc_number: null,
                  email: 'merchant@example.com',
                  email_sender_name: 'Baci Smoke',
                  slug: 'ogabassey',
                  support_email: 'support@example.com',
                  tax_identification_number: null,
                },
                error: null,
              }),
            }),
          } as any;
        }
        // A1 payment_side_effects + any other unmocked table:
        // chainable + thenable so the outbox helper's
        // `.update(...).eq().eq().eq().select('order_id')` resolves to an
        // empty array (helper records concurrent_takeover but doesn't crash).
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock so the A1 outbox helper's `await supabase.from(...).update(...).eq(...).select('order_id')` chain resolves.
          then: (onFulfilled: any) =>
            Promise.resolve({ data: [], error: null }).then(onFulfilled),
        };
        return chain;
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        message: 'Payment processed successfully',
        success: true,
      });
      expect(mockGetPaystackDvaReceiverAccountNumber).toHaveBeenCalledWith(
        body
      );
      expect(mockConfirmAgenticPaystackDvaPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          accountNumber: '9812858131',
          gatewayReference: 'REF123',
          verifiedAmount: { amount: 100, currency: 'NGN' },
        })
      );
      expect(transactionSelect).not.toHaveBeenCalled();
      expect(transactionUpdate).toHaveBeenCalled();
      expect(orderUpdate).toHaveBeenCalled();
      expect(mockMarkAgenticPaystackDvaSessionPaid).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayReference: 'REF123',
          transaction: expect.objectContaining({
            order_id: 'order-123',
          }),
        })
      );
    });
  });

  describe('Success Path', () => {
    it('uses the database-generated order number when converting chat orders', async () => {
      const body = {
        reference: 'CHAT-REF123',
        status: 'success',
        event: 'charge.success',
        amount: 11000,
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-korapay-secret');

      const request = createMockRequest(body, {
        'x-korapay-signature': signature,
      });

      const { verifyPayment } = await import('@/lib/korapay');
      const { notifyNewOrder, notifyPaymentReceived } = await import(
        '@/lib/expo-push'
      );
      const { sendEmail } = await import('@/lib/zeptomail');

      vi.mocked(verifyPayment).mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          amount: 11000,
          reference: 'CHAT-REF123',
          currency: 'NGN',
          paid_at: '2026-03-23T10:00:00Z',
          created_at: '2026-03-23T10:00:00Z',
          customer: { name: 'Jane Doe', email: 'jane@example.com' },
        },
      });

      const chatOrder = {
        id: 'chat-order-123',
        merchant_id: 'merchant-123',
        customer_id: 'customer-123',
        customer_name: 'Jane Doe',
        customer_email: 'jane@example.com',
        customer_phone: '+2348012345678',
        shipping_address: {
          address: '123 Example Street',
          city: 'Lagos',
          state: 'Lagos',
        },
        session_id: 'session-123',
        subtotal: '10000',
        shipping_fee: '1000',
        items: [
          {
            product_id: 'product-1',
            variant_id: 'variant-1',
            name: 'Chat Product',
            quantity: 1,
            price: 10000,
            image_url: 'https://example.com/product.png',
          },
        ],
      };

      let orderInsertPayload: Record<string, unknown> | null = null;
      let chatOrdersCallCount = 0;

      const chatOrdersLookupQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: chatOrder,
          error: null,
        }),
      };

      const chatOrdersClaimQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: chatOrder.id },
          error: null,
        }),
      };

      const chatOrdersUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      const ordersInsertQuery = {
        insert: vi.fn((payload: Record<string, unknown>) => {
          orderInsertPayload = payload;
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'order-123',
                order_number: 'ORD-260323-A7K3-2',
              },
              error: null,
            }),
          };
        }),
      };

      const orderItemsQuery = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const transactionsQuery = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const merchantsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            business_name: 'Test Store',
            slug: 'test-store',
            support_email: 'support@test-store.com',
            email_sender_name: 'Test Store',
            email: 'hello@test-store.com',
            tax_identification_number: null,
            cac_rc_number: null,
          },
          error: null,
        }),
      };

      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'chat_orders') {
          chatOrdersCallCount += 1;
          if (chatOrdersCallCount === 1) {
            return chatOrdersLookupQuery as any;
          }
          if (chatOrdersCallCount === 2) {
            return chatOrdersClaimQuery as any;
          }
          return chatOrdersUpdateQuery as any;
        }

        if (table === 'orders') {
          return ordersInsertQuery as any;
        }

        if (table === 'order_items') {
          return orderItemsQuery as any;
        }

        if (table === 'transactions') {
          return transactionsQuery as any;
        }

        if (table === 'merchants') {
          return merchantsQuery as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      vi.mocked(mockServiceClient.rpc).mockImplementation((name: string) => {
        const data =
          name === 'claim_payment_side_effect'
            ? { we_won: true, current_status: 'claimed' }
            : null;
        const result = { data, error: null };
        return Object.assign(Promise.resolve(result), {
          single: () => Promise.resolve(result),
        }) as never;
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        orderId: 'order-123',
        orderNumber: 'ORD-260323-A7K3-2',
      });
      expect(orderInsertPayload).toBeTruthy();
      expect(orderInsertPayload).not.toHaveProperty('order_number');
      expect(orderInsertPayload).not.toHaveProperty('tracking_token');
      expect(chatOrdersClaimQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
        })
      );
      expect(transactionsQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Payment for order ORD-260323-A7K3-2 (via chat)',
        })
      );
      expect(vi.mocked(notifyNewOrder)).toHaveBeenCalledWith(
        'merchant-123',
        'order-123',
        'ORD-260323-A7K3-2',
        'Jane Doe',
        11000, // subtotal (10000) + shipping_fee (1000)
        'NGN'
      );
      expect(vi.mocked(notifyPaymentReceived)).toHaveBeenCalledWith(
        'merchant-123',
        11000, // subtotal (10000) + shipping_fee (1000)
        'NGN',
        'ORD-260323-A7K3-2',
        'order-123'
      );
      expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Order Confirmation - #ORD-260323-A7K3-2',
        })
      );
      expect(chatOrdersUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          order_id: 'order-123',
        })
      );
    });

    it('returns 200 when chat order was already claimed before conversion', async () => {
      const body = {
        reference: 'CHAT-REF123',
        status: 'success',
        event: 'charge.success',
        amount: 11000,
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
          amount: 11000,
          reference: 'CHAT-REF123',
          currency: 'NGN',
          paid_at: '2026-03-23T10:00:00Z',
          created_at: '2026-03-23T10:00:00Z',
          customer: { name: 'Jane Doe', email: 'jane@example.com' },
        },
      });

      const chatOrder = {
        id: 'chat-order-123',
        merchant_id: 'merchant-123',
        customer_id: 'customer-123',
        customer_name: 'Jane Doe',
        customer_email: 'jane@example.com',
        customer_phone: '+2348012345678',
        shipping_address: { address: '123 Example Street' },
        session_id: 'session-123',
        subtotal: '10000',
        shipping_fee: '1000',
        items: [],
      };

      let chatOrdersCallCount = 0;
      const chatOrdersLookupQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: chatOrder,
          error: null,
        }),
      };
      const chatOrdersClaimQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      const ordersInsertQuery = {
        insert: vi.fn(),
      };

      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'chat_orders') {
          chatOrdersCallCount += 1;
          return chatOrdersCallCount === 1
            ? (chatOrdersLookupQuery as any)
            : (chatOrdersClaimQuery as any);
        }

        if (table === 'orders') {
          return ordersInsertQuery as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'Already processed' });
      expect(ordersInsertQuery.insert).not.toHaveBeenCalled();
    });

    it('returns 500 when canonical order number is missing after chat conversion', async () => {
      const body = {
        reference: 'CHAT-REF123',
        status: 'success',
        event: 'charge.success',
        amount: 11000,
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
          amount: 11000,
          reference: 'CHAT-REF123',
          currency: 'NGN',
          paid_at: '2026-03-23T10:00:00Z',
          created_at: '2026-03-23T10:00:00Z',
          customer: { name: 'Jane Doe', email: 'jane@example.com' },
        },
      });

      const chatOrder = {
        id: 'chat-order-123',
        merchant_id: 'merchant-123',
        customer_id: 'customer-123',
        customer_name: 'Jane Doe',
        customer_email: 'jane@example.com',
        customer_phone: '+2348012345678',
        shipping_address: { address: '123 Example Street' },
        session_id: 'session-123',
        subtotal: '10000',
        shipping_fee: '1000',
        items: [],
      };

      let chatOrdersCallCount = 0;
      const chatOrdersLookupQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: chatOrder,
          error: null,
        }),
      };
      const chatOrdersClaimQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: chatOrder.id },
          error: null,
        }),
      };
      const chatOrdersUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      const ordersInsertQuery = {
        insert: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'order-123',
              order_number: null,
            },
            error: null,
          }),
        })),
      };
      const transactionsQuery = {
        insert: vi.fn(),
      };

      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'chat_orders') {
          chatOrdersCallCount += 1;
          if (chatOrdersCallCount === 1) {
            return chatOrdersLookupQuery as any;
          }
          if (chatOrdersCallCount === 2) {
            return chatOrdersClaimQuery as any;
          }
          return chatOrdersUpdateQuery as any;
        }

        if (table === 'orders') {
          return ordersInsertQuery as any;
        }

        if (table === 'transactions') {
          return transactionsQuery as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const { notifyNewOrder, notifyPaymentReceived } = await import(
        '@/lib/expo-push'
      );
      const { sendEmail } = await import('@/lib/zeptomail');

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to create canonical order number',
      });
      expect(transactionsQuery.insert).not.toHaveBeenCalled();
      expect(chatOrdersUpdateQuery.update).not.toHaveBeenCalled();
      expect(vi.mocked(notifyNewOrder)).not.toHaveBeenCalled();
      expect(vi.mocked(notifyPaymentReceived)).not.toHaveBeenCalled();
      expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
    });

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
      let _merchantCallCount = 0;
      let _orderCallCount = 0;

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
          _orderCallCount++;
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
          _merchantCallCount++;
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
      vi.mocked(mockServiceClient.rpc).mockImplementation((name: string) => {
        const data =
          name === 'claim_payment_side_effect'
            ? { we_won: true, current_status: 'claimed' }
            : null;
        const result = { data, error: null };
        return Object.assign(Promise.resolve(result), {
          single: () => Promise.resolve(result),
        }) as never;
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        message: 'Payment processed successfully',
      });

      // Review feedback: assert the settlement RPC was called with the
      // BAC-* canonical key (Δ-22) and gateway-prefixed metadata (review:
      // not hardcoded paystack_reference). gateway_reference here is
      // 'REF123' from the mocked transaction; gateway is 'korapay' from
      // the x-korapay-signature header.
      expect(mockServiceClient.rpc).toHaveBeenCalledWith(
        'record_merchant_settlement',
        expect.objectContaining({
          p_gateway_reference: 'REF123',
          p_gateway: 'korapay',
          p_metadata: expect.objectContaining({
            korapay_reference: 'REF123',
            verified_gateway_fee: 0, // korapay verify response has no fees field
          }),
        })
      );
    });

    it('records settlement via fallback path when orders.update fails (review #1563 P1 regression test)', async () => {
      // Review feedback (CodeRabbit P1): the fallback I added in
      // commit fa3cc0eb1e — when `orders.update().single()` errors
      // (transient DB blip / missing row), settlement must still be
      // recorded via a direct record_merchant_settlement RPC call so
      // the merchant isn't left uncredited. Idempotency from the A0
      // partial unique index ensures a later replay with a successful
      // order update is a no-op.
      const body = {
        reference: 'REF-FB-1',
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
          reference: 'REF-FB-1',
          currency: 'NGN',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: { name: 'Test', email: 'test@example.com' },
        },
      });

      let transactionCallCount = 0;
      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'transactions') {
          transactionCallCount++;
          if (transactionCallCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'txn-fb-1',
                  merchant_id: 'merchant-fb-1',
                  order_id: 'order-fb-1',
                  amount: '1000',
                  currency: 'NGN',
                  gateway_reference: 'BAC-FB-1',
                  status: 'pending',
                  metadata: {},
                },
                error: null,
              }),
            } as never;
          }
          // Subsequent calls: transaction update (mark completed)
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'txn-fb-1' },
              error: null,
            }),
          } as never;
        }

        if (table === 'orders') {
          // CRITICAL: simulate transient DB error on the order update.
          // Before the fa3cc0eb1e fix this would silently leave the
          // merchant uncredited. After the fix, settlement still runs.
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: {
                message: 'connection terminated',
                code: '57P01',
              },
            }),
          } as never;
        }

        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as never;
      });

      vi.mocked(mockServiceClient.rpc).mockResolvedValue({
        data: null,
        error: null,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // The whole point of the fix: even though the order update
      // failed, record_merchant_settlement was called with the BAC-*
      // canonical key + the order_update_failed metadata flag so ops
      // can spot fallback-path settlements.
      expect(mockServiceClient.rpc).toHaveBeenCalledWith(
        'record_merchant_settlement',
        expect.objectContaining({
          p_gateway_reference: 'BAC-FB-1',
          p_source_type: 'order',
          p_source_id: 'order-fb-1',
          p_metadata: expect.objectContaining({
            korapay_reference: 'REF-FB-1',
            order_update_failed: true,
          }),
        })
      );
    });

    it('returns retryable status when agentic session reconciliation fails after payment processing', async () => {
      const body = {
        event: 'charge.success',
        data: { reference: 'REF123' },
      };
      const bodyString = JSON.stringify(body);
      const signature = createSignature(bodyString, 'test-paystack-secret');
      const request = createMockRequest(body, {
        'x-paystack-signature': signature,
      });
      const { logger } = await import('@/lib/logger');
      const { verifyTransaction } = await import('@/lib/paystack');
      vi.mocked(verifyTransaction).mockResolvedValue({
        success: true,
        data: {
          id: 1,
          status: 'success',
          amount: 100000,
          reference: 'REF123',
          currency: 'NGN',
          channel: 'bank_transfer',
          paid_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          customer: {
            customer_code: 'CUS_test',
            email: 'test@example.com',
            first_name: 'Test',
            id: 1,
            last_name: null,
            phone: null,
          },
          metadata: null,
          fees: 0,
          fees_split: null,
        },
      });
      mockMarkAgenticPaystackDvaSessionPaid.mockResolvedValueOnce({
        error: 'session update failed',
        ok: false,
      });

      let transactionCallCount = 0;
      vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
        if (table === 'transactions') {
          transactionCallCount++;
          if (transactionCallCount === 1) {
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
                  metadata: {
                    transaction_type: 'agentic_checkout_payment',
                  },
                },
                error: null,
              }),
            } as any;
          }
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
        if (table === 'orders') {
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
                total: '1000',
                subtotal: '900',
                shipping_fee: '100',
                currency: 'NGN',
                order_items: [],
              },
              error: null,
            }),
          } as any;
        }
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'merchant-123', business_name: 'Test Store' },
              error: null,
            }),
          } as any;
        }
        // A1: payment_side_effects mark-completed/failed UPDATE chain
        // (chainable + thenable so the helper resolves to data: []).
        if (table === 'payment_side_effects') {
          const chain: any = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock so the A1 outbox helper's `await supabase.from(...).update(...).eq(...).select('order_id')` chain resolves.
            then: (onFulfilled: any) =>
              Promise.resolve({ data: [], error: null }).then(onFulfilled),
          };
          return chain;
        }
        throw new Error(`Unexpected table ${table}`);
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: 'Agentic checkout session reconciliation failed',
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Agentic checkout session reconciliation failed',
          reference: 'REF123',
        })
      );
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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'merchant-123' },
              error: null,
            }),
          };
        }
        // transactions - not found
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        };
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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'merchant-123' },
              error: null,
            }),
          };
        }
        // transactions - not found (merchant_id doesn't match)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        };
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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'merchant-123' },
              error: null,
            }),
          };
        }
        // transactions - found
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'txn-123',
              merchant_id: 'merchant-123',
            },
            error: null,
          }),
        };
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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'merchant-123' },
              error: null,
            }),
          };
        }
        // transactions - found
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'txn-123',
              merchant_id: 'merchant-123',
            },
            error: null,
          }),
        };
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

  describe('VTU fulfillment', () => {
    it('fulfills paid VTU transactions from webhook metadata', async () => {
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
            email: 'customer@example.com',
            customer_code: 'CUS_test',
            first_name: null,
            last_name: null,
            phone: null,
          },
          metadata: null,
          authorization: {
            authorization_code: 'AUTH_123',
            card_type: 'visa DEBIT',
            last4: '1234',
            exp_month: '08',
            exp_year: '2030',
            bank: 'Access Bank',
            channel: 'card',
            signature: 'SIG_123',
            reusable: true,
            country_code: 'NG',
          },
          fees: 150,
          fees_split: null,
        },
      });

      setupSuccessfulTransactionMocks({
        metadata: {
          transaction_type: 'vtu_purchase',
          vtu_transaction_id: 'vtu-1',
          customer_id: 'customer-1',
          customer_email: 'customer@example.com',
        },
      });

      const body = {
        event: 'charge.success',
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
      expect(data).toEqual({ message: 'VTU payment fulfilled' });
    });
  });
});
