import { NextRequest } from 'next/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensurePaidOrderInventoryConfirmed,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
  SerializedInventoryUnavailableError,
} from '@/lib/payments/ensure-paid-order-inventory-confirmed';

vi.mock('server-only', () => ({}));

// handlePaymentForCancelledOrder files the reconciliation row through a
// service-role admin client (reconciliation_review is RLS-locked to
// service_role), not the route's own auth client.
const mockReconciliationInsert = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: null, error: null })
);
const mockFileInventoryConfirmationFailureReview = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
const mockRunManualPaymentSideEffect = vi.hoisted(() =>
  vi.fn(async ({ execute }: { execute: () => Promise<void> }) => {
    await execute();
    return 'completed' as const;
  })
);
const mockScheduleManualPaidOrderSideEffects = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(
  () => [] as Array<() => Promise<void> | void>
);
const mockAfter = vi.hoisted(() =>
  vi.fn((callback: () => Promise<void> | void) => {
    afterCallbacks.push(callback);
  })
);

vi.mock('@/lib/payments/file-inventory-confirmation-review', () => ({
  fileInventoryConfirmationFailureReview:
    mockFileInventoryConfirmationFailureReview,
}));

vi.mock('@/lib/payments/run-manual-payment-side-effect', () => ({
  runManualPaymentSideEffect: mockRunManualPaymentSideEffect,
}));
vi.mock('@/lib/payments/schedule-manual-paid-order-side-effects', () => ({
  scheduleManualPaidOrderSideEffects: mockScheduleManualPaidOrderSideEffects,
}));

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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'reconciliation_review') {
        return { insert: mockReconciliationInsert };
      }
      throw new Error(`Unexpected admin table: ${table}`);
    }),
  })),
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
    after: mockAfter,
  };
});

// Mock API auth
const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantIdForApiUser = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
  getMerchantIdForApiUser: mockGetMerchantIdForApiUser,
}));

// Mock inventory confirmation
vi.mock('@/lib/payments/ensure-paid-order-inventory-confirmed', () => {
  class MockSerializedInventoryUnavailableError extends Error {
    constructor() {
      super('serialized_inventory_unavailable');
      this.name = 'SerializedInventoryUnavailableError';
    }
  }

  return {
    ensurePaidOrderInventoryConfirmed: vi.fn().mockResolvedValue(undefined),
    isSerializedInventoryUnavailableError: (error: unknown) =>
      error instanceof MockSerializedInventoryUnavailableError,
    rollbackOrderStatusAfterInventoryConfirmationFailure: vi
      .fn()
      .mockResolvedValue(undefined),
    SerializedInventoryUnavailableError:
      MockSerializedInventoryUnavailableError,
  };
});

// Mock Supabase server client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};
const mockServiceClient = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
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

// Δ-36 (A3): the route now reads completed + pending + processing rows through
// an order-scoped RPC after the tenant-scoped order read succeeds; rows with
// completed semantics carry an explicit `status: 'completed'` field so the
// TS-side filter keeps them.
describe('POST /api/orders/[id]/record-payment', () => {
  const mockOrderId = '11111111-1111-4111-8111-111111111111';
  const mockMerchantId = '22222222-2222-4222-8222-222222222222';
  const mockUserId = '33333333-3333-4333-8333-333333333333';
  const mockIdempotencyKey = '44444444-4444-4444-8444-444444444444';

  // Preload the route's email/payment dependency graph once so the first
  // validation case measures handler behavior instead of module startup.
  beforeAll(async () => {
    await import('./route');
  }, 30_000);

  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mockSendEmail.mockResolvedValue({ success: true });
    vi.mocked(ensurePaidOrderInventoryConfirmed).mockResolvedValue(undefined);
    vi.mocked(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).mockResolvedValue(undefined);

    // Reset Supabase mock chain to prevent leaks between tests.
    // vi.clearAllMocks() preserves implementations, so stubs assigned
    // in one test can leak into later cases that don't reassign them.
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

    // Default: authenticated merchant (auth runs before body parsing)
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'merchant@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);
  });

  const createRequest = (body: unknown) => {
    const normalizedBody =
      body && typeof body === 'object' && !Array.isArray(body)
        ? {
            idempotency_key: mockIdempotencyKey,
            reference: 'REF-DEFAULT',
            ...body,
          }
        : body;

    return new NextRequest(
      `http://localhost/api/orders/${mockOrderId}/record-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizedBody),
      }
    );
  };

  const flushAfterCallbacks = async () => {
    while (afterCallbacks.length > 0) {
      await afterCallbacks.shift()?.();
    }
  };

  const createRecordPaymentMerchant = () => ({
    id: mockMerchantId,
    business_name: 'Test Store',
    slug: 'test-store',
    support_email: 'support@test.com',
    email_sender_name: 'Test',
    email: 'merchant@test.com',
  });

  const createRecordPaymentOrder = () => ({
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
  });

  type RecordPaymentSupabaseFixture = {
    deleteError?: unknown;
    insertError?: unknown;
    insertTransaction?: unknown;
    recordManualPayment?: unknown;
    recordManualPaymentErrorCode?: string | null;
    merchant?: unknown;
    merchantError?: unknown;
    order?: unknown;
    orderError?: unknown;
    recordedTransaction?: unknown;
    recordedTransactionError?: unknown;
    transactions?: unknown[];
    transactionsError?: unknown;
    updateError?: unknown;
    updateOrder?: unknown;
  };

  const setupRecordPaymentSupabase = (
    fixture: RecordPaymentSupabaseFixture
  ) => {
    const insertTransaction =
      'insertTransaction' in fixture
        ? fixture.insertTransaction
        : { id: 'txn-123' };
    const hasExplicitUpdateOrder = 'updateOrder' in fixture;
    const updateOrder = hasExplicitUpdateOrder
      ? fixture.updateOrder
      : (fixture.order ?? null);

    const merchantQuery = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: fixture.merchant ?? null,
        error: fixture.merchantError ?? null,
      }),
    };
    const orderQuery = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: updateOrder,
        error: fixture.updateError ?? null,
      }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: fixture.order ?? null,
        error: fixture.orderError ?? null,
      }),
      update: vi.fn().mockReturnThis(),
    };
    const transactionQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      error: fixture.deleteError ?? null,
      in: vi.fn().mockResolvedValue({
        data: fixture.transactions ?? [],
        error: fixture.transactionsError ?? null,
      }),
      insert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: fixture.recordedTransaction ?? null,
        error: fixture.recordedTransactionError ?? null,
      }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: insertTransaction,
        error: fixture.insertError ?? null,
      }),
    };

    const from = vi.fn((table: string) => {
      if (table === 'merchants') return merchantQuery;
      if (table === 'orders') return orderQuery;
      if (table === 'transactions') return transactionQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      Boolean(value && typeof value === 'object' && !Array.isArray(value));
    const orderRecord = isRecord(fixture.order) ? fixture.order : {};
    const updateOrderRecord = isRecord(updateOrder) ? updateOrder : {};
    const completedTransactions = (fixture.transactions ?? []).filter(
      (txn): txn is Record<string, unknown> =>
        isRecord(txn) && txn.status === 'completed'
    );
    const completedAmount = completedTransactions.reduce(
      (sum, txn) => sum + (Number(txn.amount) || 0),
      0
    );
    const walletAmount = Number(orderRecord.wallet_amount_used) || 0;
    const storedAmountPaid = Number(orderRecord.amount_paid) || 0;
    const orderTotal = Number(orderRecord.total) || 0;
    const defaultTransactionId =
      isRecord(insertTransaction) && typeof insertTransaction.id === 'string'
        ? insertTransaction.id
        : null;
    const manualPaymentOverride = isRecord(fixture.recordManualPayment)
      ? fixture.recordManualPayment
      : {};
    const transactionErrorCode = (fixture.transactions ?? []).find(
      (transaction) => isRecord(transaction) && transaction.error_code
    );
    const hasPendingProcessor = (fixture.transactions ?? []).some(
      (transaction) =>
        isRecord(transaction) &&
        typeof transaction.gateway === 'string' &&
        [
          'paystack',
          'korapay',
          'kuda',
          'credit_direct',
          'credpal',
          'klump',
          'juicyway',
        ].includes(transaction.gateway.toLowerCase()) &&
        (transaction.status === 'pending' ||
          transaction.status === 'processing')
    );
    const rpc = vi.fn((name: string, params?: Record<string, unknown>) => {
      if (name === 'get_record_payment_order_transactions') {
        return Promise.resolve({
          data: fixture.transactions ?? [],
          error: fixture.transactionsError ?? null,
        });
      }
      if (name === 'record_manual_order_payment') {
        const amount = Number(params?.p_amount) || 0;
        const totalPaidBefore = Math.max(
          storedAmountPaid,
          completedAmount + walletAmount
        );
        const remainingBefore = orderTotal - totalPaidBefore;
        const duplicateReference = completedTransactions.some(
          (transaction) =>
            transaction.gateway_reference === params?.p_gateway_reference
        );
        const computedErrorCode =
          fixture.recordManualPaymentErrorCode !== undefined
            ? fixture.recordManualPaymentErrorCode
            : isRecord(transactionErrorCode) &&
                typeof transactionErrorCode.error_code === 'string'
              ? transactionErrorCode.error_code
              : hasPendingProcessor
                ? 'PENDING_GATEWAY_PAYMENT'
                : duplicateReference
                  ? 'DUPLICATE_REFERENCE'
                  : remainingBefore <= 0
                    ? 'ORDER_ALREADY_PAID'
                    : amount > remainingBefore
                      ? 'AMOUNT_EXCEEDS_REMAINING_BALANCE'
                      : null;
        const computedNewPaid = totalPaidBefore + amount;
        const computedRemainingBalance = Math.max(
          0,
          orderTotal - computedNewPaid
        );
        const computedPaymentStatus =
          computedNewPaid >= orderTotal ? 'paid' : 'partially_paid';
        const originalShippingStatus =
          typeof orderRecord.shipping_status === 'string'
            ? orderRecord.shipping_status
            : 'pending';
        const computedShippingStatus =
          originalShippingStatus === 'pending'
            ? 'processing'
            : originalShippingStatus;
        return Promise.resolve({
          data: {
            current_paid: completedAmount,
            error_code: computedErrorCode,
            new_paid: computedNewPaid,
            order_total: orderTotal,
            payment_status: computedPaymentStatus,
            previous_amount_paid: storedAmountPaid,
            previous_payment_status:
              typeof orderRecord.payment_status === 'string'
                ? orderRecord.payment_status
                : 'pending',
            previous_shipping_status: originalShippingStatus,
            remaining_balance: computedRemainingBalance,
            shipping_status:
              hasExplicitUpdateOrder &&
              typeof updateOrderRecord.shipping_status === 'string'
                ? updateOrderRecord.shipping_status
                : computedShippingStatus,
            cancelled_at:
              hasExplicitUpdateOrder &&
              typeof updateOrderRecord.cancelled_at === 'string'
                ? updateOrderRecord.cancelled_at
                : null,
            total_paid_before: totalPaidBefore,
            transaction_id: defaultTransactionId,
            ...manualPaymentOverride,
          },
          error: fixture.insertError ?? null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabaseClient.from = from;
    mockSupabaseClient.rpc = rpc;

    return { from, merchantQuery, orderQuery, rpc, transactionQuery };
  };

  const setupRecordPaymentTransactionRpc = (
    transactions: unknown[],
    error: unknown = null,
    manualPaymentErrorCode: string | null = null
  ) => {
    const rpc = vi.fn((name: string, params?: Record<string, unknown>) => {
      if (name === 'get_record_payment_order_transactions') {
        return Promise.resolve({ data: transactions, error });
      }
      if (name === 'record_manual_order_payment') {
        return Promise.resolve({
          data: {
            error_code: manualPaymentErrorCode,
            new_paid: Number(params?.p_amount) || null,
            payment_status: 'paid',
            remaining_balance: 0,
            shipping_status: 'processing',
            transaction_id: 'txn-123',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabaseClient.rpc = rpc;
    return rpc;
  };

  it('returns 400 when amount is missing', async () => {
    // Arrange
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
    expect(data).toEqual({ error: 'Invalid request body' });
  });

  it('generates a compatibility key for legacy callers', async () => {
    const { rpc } = setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-new' },
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPayment: {
        new_paid: 5000,
        order_total: 10000,
        payment_status: 'partially_paid',
        remaining_balance: 5000,
        shipping_status: 'processing',
        transaction_id: 'txn-new',
      },
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };
    const { POST } = await import('./route');
    const response = await POST(
      createRequest({
        amount: 5000,
        idempotency_key: undefined,
        payment_method: 'cash',
      }),
      params
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'record_manual_order_payment',
      expect.objectContaining({
        p_idempotency_key: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        ),
      })
    );
  });

  it('returns 400 when amount is zero', async () => {
    // Arrange
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
    expect(data).toEqual({ error: 'Invalid request body' });
  });

  it('returns 400 when amount is negative', async () => {
    // Arrange
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
    expect(data).toEqual({ error: 'Invalid request body' });
  });

  it('returns 400 when amount is not numeric', async () => {
    // Arrange
    const request = createRequest({
      amount: 'not-a-number',
      payment_method: 'cash',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid request body' });
  });

  it('returns 400 when the body is not an object', async () => {
    const request = new NextRequest(
      `http://localhost/api/orders/${mockOrderId}/record-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'null',
      }
    );
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid request body' });
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

  it('returns 401 before parsing an invalid JSON body when auth fails', async () => {
    // Arrange — auth fails AND body is malformed JSON
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Invalid token',
      user: null,
      supabase: null,
    });

    const request = new NextRequest(
      `http://localhost/api/orders/${mockOrderId}/record-payment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '<<<not json>>>',
      }
    );
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert — 401 returned without touching merchant lookup or Supabase
    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Invalid token' });
    expect(mockGetMerchantIdForApiUser).not.toHaveBeenCalled();
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
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

  it('returns 500 when merchant details lookup fails', async () => {
    const mockMerchantError = { code: '57014', message: 'statement timeout' };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    setupRecordPaymentSupabase({
      merchant: null,
      merchantError: mockMerchantError,
      order: {},
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to fetch merchant details' });
  });

  it('returns 404 when merchant details not found', async () => {
    // Arrange
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    setupRecordPaymentSupabase({
      merchant: null,
      merchantError: { code: 'PGRST116', message: 'Merchant not found' },
      order: {},
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

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: null,
      orderError: { code: 'PGRST116', message: 'Order not found' },
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
    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Order not found' });
  });

  it('returns 500 when order lookup fails', async () => {
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

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: null,
      orderError: { code: '57014', message: 'statement timeout' },
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
    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to fetch order' });
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

    setupRecordPaymentSupabase({
      insertError: { message: 'Database error' },
      insertTransaction: null,
      merchant: mockMerchant,
      order: mockOrder,
    });

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

  it('returns 400 for a malformed order id before database lookup', async () => {
    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid order id' });
    expect(mockGetMerchantIdForApiUser).not.toHaveBeenCalled();
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body cannot be parsed', async () => {
    // Arrange
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
    expect(data).toEqual({ error: 'Invalid JSON body' });
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

    const { orderQuery } = setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
    });

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
    expect(orderQuery.update).not.toHaveBeenCalled();
  });

  it('threads the order currency through to deferred paid side effects', async () => {
    const mockMerchant = createRecordPaymentMerchant();
    const mockOrder = { ...createRecordPaymentOrder(), currency: 'INR' };

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'bank_transfer',
      reference: 'REF-INR-FULL',
      notes: 'Full payment',
    });

    const { POST } = await import('./route');
    await POST(request, { params: Promise.resolve({ id: mockOrderId }) });

    expect(mockScheduleManualPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ currency: 'INR' }),
      })
    );
  });

  it('uses the RPC payment status instead of stale pre-lock totals for paid side effects', async () => {
    const mockMerchant = createRecordPaymentMerchant();
    const mockOrder = createRecordPaymentOrder();

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
      recordManualPayment: {
        new_paid: 10000,
        order_total: 15000,
        payment_status: 'partially_paid',
        remaining_balance: 5000,
        shipping_status: 'processing',
      },
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'bank_transfer',
      reference: 'REF-STALE-TOTAL',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      amount_paid: 10000,
      new_balance: 5000,
      updated_status: {
        payment_status: 'partially_paid',
        shipping_status: 'processing',
      },
    });
    expect(ensurePaidOrderInventoryConfirmed).not.toHaveBeenCalled();
    const { generatePaymentReceiptEmail } = await import(
      '@/lib/email-templates'
    );
    expect(generatePaymentReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        balanceDue: 5000,
        currency: 'NGN',
        totalAmount: 15000,
        totalPaidSoFar: 10000,
      })
    );
    await flushAfterCallbacks();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Payment Receipt'),
      })
    );
  });

  it('threads a non-NGN order currency through to the partial-payment receipt email', async () => {
    const mockMerchant = createRecordPaymentMerchant();
    const mockOrder = { ...createRecordPaymentOrder(), currency: 'INR' };

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
      recordManualPayment: {
        new_paid: 10000,
        order_total: 15000,
        payment_status: 'partially_paid',
        remaining_balance: 5000,
        shipping_status: 'processing',
      },
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'bank_transfer',
      reference: 'REF-INR-PARTIAL',
    });

    const { POST } = await import('./route');
    await POST(request, { params: Promise.resolve({ id: mockOrderId }) });

    const { generatePaymentReceiptEmail } = await import(
      '@/lib/email-templates'
    );
    expect(generatePaymentReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'INR' })
    );
  });

  it('rolls back status, deletes the manual transaction, and returns 409 when paid-order inventory confirmation fails', async () => {
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
    vi.mocked(ensurePaidOrderInventoryConfirmed).mockRejectedValueOnce(
      new SerializedInventoryUnavailableError()
    );

    const { transactionQuery } = setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
      recordManualPayment: {
        previous_payment_status: 'partially_paid',
        previous_shipping_status: 'processing',
      },
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'bank_transfer',
      reference: 'REF-INV-FAIL',
      notes: 'Full payment',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      code: 'serialized_inventory_unavailable',
      error: 'serialized_inventory_unavailable',
    });
    expect(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).toHaveBeenCalledWith(mockSupabaseClient, mockMerchantId, mockOrderId, {
      amount_paid: 0,
      payment_status: 'partially_paid',
      shipping_status: 'processing',
    });
    expect(transactionQuery.delete).toHaveBeenCalledOnce();
    expect(transactionQuery.eq).toHaveBeenCalledWith('id', 'txn-123');
  });

  it('returns cleanup failure when inventory failure rollback cannot restore state', async () => {
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

    vi.mocked(ensurePaidOrderInventoryConfirmed).mockRejectedValueOnce(
      new SerializedInventoryUnavailableError()
    );
    vi.mocked(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).mockRejectedValueOnce(new Error('rollback failed'));

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'bank_transfer',
      reference: 'REF-ROLLBACK-FAIL',
      notes: 'Full payment',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      code: 'INVENTORY_CONFIRMATION_CLEANUP_FAILED',
      error: 'Inventory confirmation cleanup failed',
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

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
    });

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

    const { orderQuery, rpc } = setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
      transactions: [
        {
          amount: 4000,
          gateway: 'manual',
          merchant_id: 'stale-denormalized-merchant',
          status: 'completed',
        },
      ],
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-BALANCE-1',
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
    expect(orderQuery.eq).toHaveBeenCalledWith('id', mockOrderId);
    expect(orderQuery.eq).toHaveBeenCalledWith('merchant_id', mockMerchantId);
    expect(rpc).toHaveBeenCalledWith(
      'record_manual_order_payment',
      expect.objectContaining({ p_order_id: mockOrderId })
    );
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

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'bank_transfer',
      reference: 'REF-SHIPPED-1',
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

  it('handles missing optional fields gracefully when a reference is provided', async () => {
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

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
    });

    const request = createRequest({
      amount: 5000,
      reference: 'REF-MINIMAL-1',
      // No payment_method or notes provided
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

  // Δ-36 (A3): whitespace-only reference is normalized to undefined and
  // the request proceeds normally. Pre-A3 the schema rejected it as
  // 'Invalid request body', which broke staff manual record-payment
  // when the optional reference field was blank. The duplicate-guard
  // simply skips when reference is undefined.
  it('accepts a whitespace-only reference by normalizing it to undefined', async () => {
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
      customer_name: 'Ada',
      customer_email: 'ada@example.com',
      customer_phone: '+234',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'pending',
      shipping_status: 'pending',
      wallet_amount_used: 0,
      order_items: [],
      shipping_address: {},
    };
    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'cash',
      reference: '   ',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);

    expect(response.status).toBe(200);
  });

  it('returns 409 when a duplicate payment reference is submitted', async () => {
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
      total: 10000,
      currency: 'NGN',
      wallet_amount_used: 0,
      shipping_status: 'pending',
      payment_status: 'partially_paid',
      order_items: [],
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    mockSupabaseClient.from = vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
      }

      if (table === 'transactions') {
        // Return existing transaction with the same reference
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                amount: 5000,
                gateway_reference: 'REF-DUPE-409',
                gateway: 'manual',
                status: 'completed',
              },
            ],
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    setupRecordPaymentTransactionRpc(
      [
        {
          amount: 5000,
          gateway_reference: 'REF-DUPE-409',
          gateway: 'manual',
          status: 'completed',
        },
      ],
      null,
      'DUPLICATE_REFERENCE'
    );

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-DUPE-409',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(409);
    expect(data).toEqual({
      error: 'Duplicate payment reference',
      code: 'DUPLICATE_REFERENCE',
    });
  });

  it('returns 409 when the atomic insert detects a stale overpayment', async () => {
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

    const { orderQuery, rpc } = setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
      recordManualPaymentErrorCode: 'AMOUNT_EXCEEDS_REMAINING_BALANCE',
      transactions: [],
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-STALE-BALANCE',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({ error: 'Amount exceeds remaining balance' });
    expect(rpc).toHaveBeenCalledWith(
      'record_manual_order_payment',
      expect.objectContaining({
        p_amount: 5000,
        p_gateway_reference: 'REF-STALE-BALANCE',
        p_merchant_id: mockMerchantId,
        p_order_id: mockOrderId,
      })
    );
    expect(orderQuery.update).not.toHaveBeenCalled();
  });

  it('returns 400 when the atomic insert rejects an invalid direct-call amount', async () => {
    const { orderQuery, rpc } = setupRecordPaymentSupabase({
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPaymentErrorCode: 'INVALID_AMOUNT',
      transactions: [],
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-INVALID-RPC-AMOUNT',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid amount' });
    expect(rpc).toHaveBeenCalledWith(
      'record_manual_order_payment',
      expect.objectContaining({
        p_amount: 5000,
        p_gateway_reference: 'REF-INVALID-RPC-AMOUNT',
        p_merchant_id: mockMerchantId,
        p_order_id: mockOrderId,
      })
    );
    expect(orderQuery.update).not.toHaveBeenCalled();
  });

  it('returns 409 when the atomic RPC detects merchant drift', async () => {
    const { orderQuery, rpc } = setupRecordPaymentSupabase({
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      transactions: [
        {
          amount: null,
          error_code: 'ORDER_PAYMENT_RECONCILIATION_REQUIRED',
          gateway: null,
          gateway_reference: null,
          status: null,
        },
      ],
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-DRIFTED-TXN',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      error:
        'This order has payments that require reconciliation before recording a manual payment.',
      code: 'ORDER_PAYMENT_RECONCILIATION_REQUIRED',
    });
    expect(rpc).toHaveBeenCalledWith(
      'record_manual_order_payment',
      expect.objectContaining({ p_order_id: mockOrderId })
    );
    expect(orderQuery.update).not.toHaveBeenCalled();
  });

  it('returns 409 when the atomic insert detects a pending processor transaction', async () => {
    const { orderQuery, rpc } = setupRecordPaymentSupabase({
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPaymentErrorCode: 'PENDING_GATEWAY_PAYMENT',
      transactions: [],
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-PENDING-RPC',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      error:
        'This order has a pending processor payment. Use payment reconciliation instead.',
      code: 'PENDING_GATEWAY_PAYMENT',
    });
    expect(rpc).toHaveBeenCalledWith(
      'record_manual_order_payment',
      expect.objectContaining({
        p_amount: 5000,
        p_gateway_reference: 'REF-PENDING-RPC',
        p_merchant_id: mockMerchantId,
        p_order_id: mockOrderId,
      })
    );
    expect(orderQuery.update).not.toHaveBeenCalled();
  });

  it('returns 409 when the atomic insert detects merchant drift', async () => {
    const { orderQuery, rpc } = setupRecordPaymentSupabase({
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPaymentErrorCode: 'ORDER_PAYMENT_RECONCILIATION_REQUIRED',
      transactions: [],
    });

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-DRIFTED-RPC',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      error:
        'This order has payments that require reconciliation before recording a manual payment.',
      code: 'ORDER_PAYMENT_RECONCILIATION_REQUIRED',
    });
    expect(rpc).toHaveBeenCalledWith(
      'record_manual_order_payment',
      expect.objectContaining({
        p_amount: 5000,
        p_gateway_reference: 'REF-DRIFTED-RPC',
        p_merchant_id: mockMerchantId,
        p_order_id: mockOrderId,
      })
    );
    expect(orderQuery.update).not.toHaveBeenCalled();
  });

  it('returns 409 when payment amount exceeds remaining balance', async () => {
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
      total: 10000,
      currency: 'NGN',
      wallet_amount_used: 0,
      shipping_status: 'pending',
      payment_status: 'partially_paid',
      order_items: [],
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    mockSupabaseClient.from = vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
      }

      if (table === 'transactions') {
        // Already paid 8000 out of 10000
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                amount: 8000,
                gateway_reference: 'REF-PREV',
                gateway: 'manual',
                status: 'completed',
              },
            ],
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    setupRecordPaymentTransactionRpc(
      [
        {
          amount: 8000,
          gateway_reference: 'REF-PREV',
          gateway: 'manual',
          status: 'completed',
        },
      ],
      null,
      'AMOUNT_EXCEEDS_REMAINING_BALANCE'
    );

    const request = createRequest({
      amount: 5000, // Trying to pay 5000 when only 2000 remains
      payment_method: 'bank_transfer',
      reference: 'REF-OVERPAY',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: 'Amount exceeds remaining balance' });
  });

  // Δ-36 (A3): A3 guard — don't let staff record a manual payment while
  // a non-manual processor transaction is still pending. Force them to
  // use reconciliation instead (the A2 path) so we don't end up with a
  // parallel manual transaction shadowing a real Paystack DVA payment.
  it('returns 409 PENDING_GATEWAY_PAYMENT when a non-manual gateway transaction is pending', async () => {
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
      total: 10000,
      currency: 'NGN',
      wallet_amount_used: 0,
      shipping_status: 'pending',
      payment_status: 'pending',
      order_items: [],
    };

    mockSupabaseClient.from = vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: mockMerchant, error: null }),
        };
      }
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
        };
      }
      if (table === 'transactions') {
        // Single combined SELECT (status IN completed|pending|processing)
        // returns a pending Paystack row → guard fires.
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                amount: 0,
                gateway: 'paystack',
                gateway_reference: 'paystack-pending-ref',
                status: 'pending',
              },
            ],
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    setupRecordPaymentTransactionRpc(
      [
        {
          amount: 0,
          gateway: 'paystack',
          gateway_reference: 'paystack-pending-ref',
          status: 'pending',
        },
      ],
      null,
      'PENDING_GATEWAY_PAYMENT'
    );

    const request = createRequest({
      amount: 10000,
      payment_method: 'cash',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      error:
        'This order has a pending processor payment. Use payment reconciliation instead.',
      code: 'PENDING_GATEWAY_PAYMENT',
    });
  });

  it('returns 409 PENDING_GATEWAY_PAYMENT when a Klump BNPL transaction is pending', async () => {
    setupRecordPaymentSupabase({
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      transactions: [
        {
          amount: 0,
          gateway: 'klump',
          gateway_reference: 'klump-pending-ref',
          status: 'pending',
        },
      ],
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'cash',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      error:
        'This order has a pending processor payment. Use payment reconciliation instead.',
      code: 'PENDING_GATEWAY_PAYMENT',
    });
  });

  it('returns 409 PENDING_GATEWAY_PAYMENT when a CredPal BNPL transaction is pending', async () => {
    setupRecordPaymentSupabase({
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      transactions: [
        {
          amount: 0,
          gateway: 'credpal',
          gateway_reference: 'credpal-pending-ref',
          status: 'processing',
        },
      ],
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'cash',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      error:
        'This order has a pending processor payment. Use payment reconciliation instead.',
      code: 'PENDING_GATEWAY_PAYMENT',
    });
  });

  it('accepts manual payments when the only existing gateway transactions are failed/cancelled', async () => {
    // Negative case: failed processor attempt should NOT block a manual
    // payment. The guard only triggers on pending|processing rows.
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
      customer_name: 'Ada',
      customer_email: 'ada@example.com',
      customer_phone: '+234',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'pending',
      shipping_status: 'pending',
      wallet_amount_used: 0,
      order_items: [],
      shipping_address: {},
    };

    setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'cash',
      notes: '', // blank notes — Δ-36 normalization in action
      reference: '   ', // whitespace ref — normalize to undefined too
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };
    const { POST } = await import('./route');
    const response = await POST(request, params);

    expect(response.status).toBe(200);
  });

  it('suppresses paid side effects when the manual-payment RPC omits updated order status', async () => {
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
      customer_name: 'Ada',
      customer_email: 'ada@example.com',
      customer_phone: '+234',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'unpaid',
      shipping_status: 'pending',
      wallet_amount_used: 0,
      order_items: [],
      shipping_address: {},
    };

    setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-new' },
      merchant: mockMerchant,
      order: mockOrder,
      recordManualPayment: {
        payment_status: null,
        shipping_status: null,
      },
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'cash',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to record payment' });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockReconciliationInsert).not.toHaveBeenCalled();
  });

  it('confirms inventory and resumes durable side effects on a paid replay', async () => {
    setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-existing' },
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPayment: {
        idempotency_replayed: true,
        new_paid: 10000,
        order_total: 10000,
        payment_status: 'paid',
        remaining_balance: 0,
        shipping_status: 'processing',
        transaction_id: 'txn-existing',
      },
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'cash',
    });
    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      idempotency_replayed: true,
      success: true,
    });
    expect(ensurePaidOrderInventoryConfirmed).toHaveBeenCalledWith(
      mockSupabaseClient,
      mockMerchantId,
      mockOrderId
    );
    expect(mockScheduleManualPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: mockMerchantId,
        transactionId: 'txn-existing',
      })
    );
  });

  it('lets the atomic RPC replay before applying pending-processor guards', async () => {
    const { rpc } = setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-existing' },
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPaymentErrorCode: null,
      recordManualPayment: {
        idempotency_replayed: true,
        new_paid: 10000,
        order_total: 10000,
        payment_status: 'paid',
        remaining_balance: 0,
        shipping_status: 'processing',
        transaction_id: 'txn-existing',
      },
      transactions: [
        {
          amount: 0,
          gateway: 'paystack',
          gateway_reference: 'processor-started-after-manual-payment',
          status: 'pending',
        },
      ],
    });

    const { POST } = await import('./route');
    const response = await POST(
      createRequest({ amount: 10000, payment_method: 'cash' }),
      { params: Promise.resolve({ id: mockOrderId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      idempotency_replayed: true,
      success: true,
    });
    expect(rpc).not.toHaveBeenCalledWith(
      'get_record_payment_order_transactions',
      expect.anything()
    );
  });

  it('does not wait for durable paid side effects before responding', async () => {
    setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-new' },
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPayment: {
        new_paid: 10000,
        order_total: 10000,
        payment_status: 'paid',
        remaining_balance: 0,
        shipping_status: 'processing',
        transaction_id: 'txn-new',
      },
    });
    const { POST } = await import('./route');
    const response = await POST(
      createRequest({ amount: 10000, payment_method: 'cash' }),
      { params: Promise.resolve({ id: mockOrderId }) }
    );

    expect(response.status).toBe(200);
    expect(mockScheduleManualPaidOrderSideEffects).toHaveBeenCalledOnce();
    expect(mockRunManualPaymentSideEffect).not.toHaveBeenCalled();
  });

  it('resumes a durable receipt side effect on a partial-payment replay', async () => {
    setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-existing' },
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPayment: {
        idempotency_replayed: true,
        new_paid: 5000,
        order_total: 10000,
        payment_status: 'partially_paid',
        remaining_balance: 5000,
        shipping_status: 'processing',
        transaction_id: 'txn-existing',
      },
    });

    const { POST } = await import('./route');
    const response = await POST(
      createRequest({ amount: 5000, payment_method: 'cash' }),
      { params: Promise.resolve({ id: mockOrderId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      idempotency_replayed: true,
      success: true,
    });
    await flushAfterCallbacks();
    expect(mockRunManualPaymentSideEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'partial_receipt',
        supabase: mockServiceClient,
        transactionId: 'txn-existing',
      })
    );
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('does not send a partial receipt for a refunded replay', async () => {
    setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-existing' },
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPayment: {
        idempotency_replayed: true,
        new_paid: 5000,
        order_total: 10000,
        payment_status: 'refunded',
        remaining_balance: 5000,
        shipping_status: 'processing',
        transaction_id: 'txn-existing',
      },
    });

    const { POST } = await import('./route');
    const response = await POST(
      createRequest({ amount: 5000, payment_method: 'cash' }),
      { params: Promise.resolve({ id: mockOrderId }) }
    );

    expect(response.status).toBe(200);
    await flushAfterCallbacks();
    expect(mockRunManualPaymentSideEffect).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('rejects a partial-payment replay without its transaction id', async () => {
    setupRecordPaymentSupabase({
      insertTransaction: null,
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPayment: {
        idempotency_replayed: true,
        new_paid: 5000,
        order_total: 10000,
        payment_status: 'partially_paid',
        remaining_balance: 5000,
        shipping_status: 'processing',
        transaction_id: null,
      },
    });

    const { POST } = await import('./route');
    const response = await POST(
      createRequest({ amount: 5000, payment_method: 'cash' }),
      { params: Promise.resolve({ id: mockOrderId }) }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to record payment',
    });
    expect(mockRunManualPaymentSideEffect).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('preserves a replayed payment and files review when inventory confirmation fails', async () => {
    vi.mocked(ensurePaidOrderInventoryConfirmed).mockRejectedValueOnce(
      new SerializedInventoryUnavailableError()
    );
    const { transactionQuery } = setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-existing' },
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPayment: {
        idempotency_replayed: true,
        new_paid: 10000,
        order_total: 10000,
        payment_status: 'paid',
        remaining_balance: 0,
        shipping_status: 'processing',
        transaction_id: 'txn-existing',
      },
    });

    const request = createRequest({ amount: 10000, payment_method: 'cash' });
    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });

    expect(response.status).toBe(409);
    expect(transactionQuery.delete).not.toHaveBeenCalled();
    expect(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).not.toHaveBeenCalled();
    expect(mockFileInventoryConfirmationFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: mockOrderId,
        transactionId: 'txn-existing',
      })
    );
  });

  it('files cancelled-order reconciliation on an idempotent replay', async () => {
    setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-existing' },
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordManualPayment: {
        cancelled_at: '2026-06-15T00:00:00Z',
        idempotency_replayed: true,
        new_paid: 10000,
        order_total: 10000,
        payment_status: 'paid',
        remaining_balance: 0,
        shipping_status: 'cancelled',
        transaction_id: 'txn-existing',
      },
    });

    const request = createRequest({ amount: 10000, payment_method: 'cash' });
    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      idempotency_replayed: true,
      order_cancelled: true,
    });
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: mockOrderId,
        txn_id: 'txn-existing',
      })
    );
    expect(ensurePaidOrderInventoryConfirmed).not.toHaveBeenCalled();
  });

  it('suppresses confirmation emails and files reconciliation when the order was clamped as cancelled', async () => {
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
      customer_name: 'Ada',
      customer_email: 'ada@example.com',
      customer_phone: '+234',
      total: 10000,
      subtotal: 9000,
      shipping_fee: 1000,
      currency: 'NGN',
      payment_status: 'unpaid',
      shipping_status: 'pending',
      wallet_amount_used: 0,
      order_items: [],
      shipping_address: {},
    };

    setupRecordPaymentSupabase({
      insertTransaction: { id: 'txn-new' },
      merchant: mockMerchant,
      order: mockOrder,
      recordedTransaction: { id: 'txn-new' },
      updateOrder: {
        id: mockOrderId,
        shipping_status: 'cancelled',
        cancelled_at: '2026-06-15T00:00:00Z',
      },
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'cash',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ order_cancelled: true, updated_status: {} });
    // No confirmation email was sent for the cancelled order.
    expect(mockSendEmail).not.toHaveBeenCalled();
    // A reconciliation row was filed for manual refund through the
    // service-role admin client.
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: mockOrderId,
        // N5: the reconciliation row is linked to the recorded transaction.
        txn_id: 'txn-new',
      })
    );
  });

  it('logs cancelled-order transaction lookup failures before filing reconciliation without a transaction link', async () => {
    const recordedTransactionError = {
      code: 'PGRST500',
      message: 'transaction lookup failed',
    };

    setupRecordPaymentSupabase({
      insertTransaction: null,
      merchant: createRecordPaymentMerchant(),
      order: createRecordPaymentOrder(),
      recordedTransactionError,
      updateOrder: {
        id: mockOrderId,
        shipping_status: 'cancelled',
        cancelled_at: '2026-06-15T00:00:00Z',
      },
    });

    const request = createRequest({
      amount: 10000,
      payment_method: 'cash',
      reference: 'manual-ref-lookup-failed',
    });

    const { logger } = await import('@/lib/logger');
    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({ id: mockOrderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ order_cancelled: true, updated_status: {} });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'RecordPayment failed to fetch recorded transaction for cancelled-order reconciliation',
        error: recordedTransactionError,
        orderId: mockOrderId,
        merchantId: mockMerchantId,
        gatewayReference: 'manual-ref-lookup-failed',
      })
    );
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: mockOrderId,
        paystack_ref: 'manual-ref-lookup-failed',
        txn_id: null,
      })
    );
  });

  it('returns 409 when order is already fully paid', async () => {
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
      total: 10000,
      currency: 'NGN',
      wallet_amount_used: 0,
      shipping_status: 'processing',
      payment_status: 'paid',
      order_items: [],
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    mockSupabaseClient.from = vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
      }

      if (table === 'transactions') {
        // Already fully paid
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                amount: 10000,
                gateway_reference: 'REF-FULL',
                gateway: 'manual',
                status: 'completed',
              },
            ],
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    setupRecordPaymentTransactionRpc(
      [
        {
          amount: 10000,
          gateway_reference: 'REF-FULL',
          gateway: 'manual',
          status: 'completed',
        },
      ],
      null,
      'ORDER_ALREADY_PAID'
    );

    const request = createRequest({
      amount: 1000,
      payment_method: 'cash',
      reference: 'REF-EXTRA',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    // Act
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: 'Order is already fully paid' });
  });

  it('rejects a reused payment reference when the idempotency key differs', async () => {
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
      total: 10000,
      currency: 'NGN',
      wallet_amount_used: 0,
      shipping_status: 'pending',
      payment_status: 'partially_paid',
      order_items: [],
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: mockUserId, email: 'test@example.com' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(mockMerchantId);

    const mockFrom = vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
      }

      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockMerchant,
            error: null,
          }),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    mockSupabaseClient.from = mockFrom;
    setupRecordPaymentTransactionRpc(
      [
        {
          amount: 5000,
          gateway_reference: 'REF-DUPE-1',
          gateway: 'manual',
          status: 'completed',
        },
      ],
      null,
      'DUPLICATE_REFERENCE'
    );

    const request = createRequest({
      amount: 5000,
      payment_method: 'bank_transfer',
      reference: 'REF-DUPE-1',
    });
    const params = { params: Promise.resolve({ id: mockOrderId }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      error: 'Duplicate payment reference',
      code: 'DUPLICATE_REFERENCE',
    });
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      'record_manual_order_payment',
      expect.objectContaining({ p_order_id: mockOrderId })
    );
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});
