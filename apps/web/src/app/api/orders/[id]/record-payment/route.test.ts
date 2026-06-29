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

// Δ-36 (A3): the route now does a SINGLE `transactions` SELECT covering
// completed + pending + processing rows, then filters in TS. The chain
// shape is `.eq().eq().in()` so the concurrent transaction read is tenant-scoped. Existing mocks were
// updated to match; rows with completed semantics carry an explicit
// `status: 'completed'` field so the TS-side filter keeps them.
describe('POST /api/orders/[id]/record-payment', () => {
  const mockOrderId = 'order-123';
  const mockMerchantId = 'merchant-456';
  const mockUserId = 'user-789';

  // Preload the route's email/payment dependency graph once so the first
  // validation case measures handler behavior instead of module startup.
  beforeAll(async () => {
    await import('./route');
  }, 30_000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(undefined);
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
        ? { reference: 'REF-DEFAULT', ...body }
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

  type RecordPaymentSupabaseFixture = {
    deleteError?: unknown;
    insertError?: unknown;
    insertTransaction?: unknown;
    merchant?: unknown;
    merchantError?: unknown;
    order?: unknown;
    orderError?: unknown;
    recordedTransaction?: unknown;
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
    const updateOrder =
      'updateOrder' in fixture ? fixture.updateOrder : (fixture.order ?? null);

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
        error: null,
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

    mockSupabaseClient.from = from;

    return { from, merchantQuery, orderQuery, transactionQuery };
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
      merchantError: { message: 'Merchant not found' },
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
      orderError: { message: 'Order not found' },
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

    setupRecordPaymentSupabase({
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
      payment_status: 'pending',
      shipping_status: 'pending',
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

    const { orderQuery, transactionQuery } = setupRecordPaymentSupabase({
      merchant: mockMerchant,
      order: mockOrder,
      transactions: [{ amount: 4000, gateway: 'manual', status: 'completed' }],
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
    expect(transactionQuery.eq).toHaveBeenCalledWith('order_id', mockOrderId);
    expect(transactionQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      mockMerchantId
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

  it('suppresses paid side effects when the order status update fails after transaction insert', async () => {
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
      updateError: { message: 'update failed' },
      updateOrder: null,
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
    expect(data).toMatchObject({
      status_update_failed: true,
      updated_status: {},
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockReconciliationInsert).not.toHaveBeenCalled();
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

  it('returns the existing result when the same payment reference is retried', async () => {
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

    const transactionsQuery = {
      in: vi.fn().mockResolvedValue({
        data: [
          {
            amount: 5000,
            gateway_reference: 'REF-DUPE-1',
            gateway: 'manual',
            status: 'completed',
          },
        ],
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: transactionsQuery.in,
        };
      }

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
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });
});
