import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  mockAuthenticateApiRequest,
  mockGetMerchantIdForApiUser,
  mockGeneratePaymentAccount,
  mockFrom,
  mockLogger,
  mockSupabaseClient,
  mockReconciliationInsert,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    mockAuthenticateApiRequest: vi.fn(),
    mockGetMerchantIdForApiUser: vi.fn(),
    mockGeneratePaymentAccount: vi.fn(),
    mockFrom,
    mockLogger,
    mockSupabaseClient: {
      from: mockFrom,
    },
    // handlePaymentForCancelledOrder files the reconciliation row through a
    // service-role admin client (reconciliation_review is RLS-locked to
    // service_role), not the route's own auth client.
    mockReconciliationInsert: vi
      .fn()
      .mockResolvedValue({ data: null, error: null }),
  };
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
  getMerchantIdForApiUser: mockGetMerchantIdForApiUser,
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

vi.mock('@/lib/paystack', () => ({
  generatePaymentAccount: mockGeneratePaymentAccount,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

import { POST } from './route';

const ORDER_ID = 'order-123';
const MERCHANT_ID = 'merchant-123';

function createRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(
    `https://usebaci.com/api/orders/${ORDER_ID}/ship-on-credit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

function createMalformedJsonRequest() {
  return new NextRequest(
    `https://usebaci.com/api/orders/${ORDER_ID}/ship-on-credit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }
  );
}

function createParams() {
  return { params: Promise.resolve({ id: ORDER_ID }) };
}

function createSelectSingleQuery<T>(data: T, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createUpdateQuery(
  error: unknown = null,
  updatedOrder: Record<string, unknown> | null = {
    id: ORDER_ID,
    shipping_status: 'processing',
    cancelled_at: null,
  }
) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: updatedOrder, error }),
    error,
  };
}

function createPaymentAccountTable(options: {
  insertError?: unknown;
  existingAccount?: {
    account_number: string;
    bank_name: string;
    account_name: string;
    assigned_at?: string | null;
    created_at?: string | null;
    expires_at?: string | null;
    provider?: string | null;
  } | null;
  existingAccountError?: unknown;
}) {
  const selectQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.existingAccount ?? null,
      error: options.existingAccountError ?? null,
    }),
  };

  return {
    insert: vi.fn().mockResolvedValue({ error: options.insertError ?? null }),
    select: vi.fn().mockReturnValue(selectQuery),
  };
}

describe('POST /api/orders/[id]/ship-on-credit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(MERCHANT_ID);
    mockGeneratePaymentAccount.mockResolvedValue({
      success: true,
      data: {
        account_number: '0123456789',
        bank_name: 'Wema Bank',
        account_name: 'Ogabassey / John Doe',
      },
    });
  });

  it('authenticates before reading a malformed request body', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Unauthorized',
      user: null,
      supabase: null,
    });

    const response = await POST(createMalformedJsonRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockGetMerchantIdForApiUser).not.toHaveBeenCalled();
  });

  it('rejects invalid credit notes before updating the order', async () => {
    const response = await POST(
      createRequest({ credit_notes: { nested: true } }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid request body' });
    expect(mockGetMerchantIdForApiUser).not.toHaveBeenCalled();
  });

  it('returns 500 when checking the current order fails after a no-row update', async () => {
    let orderQueryCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return createSelectSingleQuery({
          id: MERCHANT_ID,
          business_name: 'Ogabassey',
        });
      }

      if (table === 'orders') {
        orderQueryCount += 1;
        if (orderQueryCount === 1) {
          return createSelectSingleQuery({
            id: ORDER_ID,
            order_number: 'ORD-001',
            total: '5000',
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            payment_status: 'unpaid',
            shipping_status: 'pending',
          });
        }

        if (orderQueryCount === 2) {
          return createUpdateQuery(null, null);
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'rls failed' },
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createRequest({ credit_notes: 'Ship now' }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to verify order status' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Database error checking order after credit shipping update matched no rows',
        orderId: ORDER_ID,
      })
    );
  });

  it('keeps ship-on-credit successful when a cross-flow DVA alias conflict has no same-order fallback', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return createSelectSingleQuery({
          id: MERCHANT_ID,
          business_name: 'Ogabassey',
        });
      }

      if (table === 'orders') {
        return {
          ...createSelectSingleQuery({
            id: ORDER_ID,
            order_number: 'ORD-001',
            total: '5000',
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            payment_status: 'unpaid',
            shipping_status: 'pending',
          }),
          ...createUpdateQuery(),
        };
      }

      if (table === 'order_payment_accounts') {
        return createPaymentAccountTable({
          insertError: {
            code: 'P0001',
            message: 'PAYSTACK_DVA_ALIAS_CONFLICT',
          },
          existingAccount: null,
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createRequest({ credit_notes: 'Ship now' }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      virtualAccount: null,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Optional credit-order payment account persistence failed after shipping transition',
        orderId: ORDER_ID,
      })
    );
  });

  it('treats duplicate insert conflicts as idempotent success when the existing account is present', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return createSelectSingleQuery({
          id: MERCHANT_ID,
          business_name: 'Ogabassey',
        });
      }

      if (table === 'orders') {
        return {
          ...createSelectSingleQuery({
            id: ORDER_ID,
            order_number: 'ORD-001',
            total: '5000',
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            payment_status: 'unpaid',
            shipping_status: 'pending',
          }),
          ...createUpdateQuery(),
        };
      }

      if (table === 'order_payment_accounts') {
        return createPaymentAccountTable({
          insertError: { code: '23505', message: 'duplicate key value' },
          existingAccount: {
            account_number: '0123456789',
            bank_name: 'Wema Bank',
            account_name: 'Ogabassey / John Doe',
          },
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createRequest({ credit_notes: 'Ship now' }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: 'Order confirmed for credit shipping',
      virtualAccount: {
        account_number: '0123456789',
        bank_name: 'Wema Bank',
        account_name: 'Ogabassey / John Doe',
      },
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Order payment account already exists, treating as idempotent success',
        orderId: ORDER_ID,
      })
    );
  });

  it('does not return an expired Paystack alias after a duplicate insert conflict', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return createSelectSingleQuery({
          id: MERCHANT_ID,
          business_name: 'Ogabassey',
        });
      }

      if (table === 'orders') {
        return {
          ...createSelectSingleQuery({
            id: ORDER_ID,
            order_number: 'ORD-001',
            total: '5000',
            customer_name: 'John Doe',
            customer_email: 'new-email@example.com',
            payment_status: 'unpaid',
            shipping_status: 'pending',
          }),
          ...createUpdateQuery(),
        };
      }

      if (table === 'order_payment_accounts') {
        return createPaymentAccountTable({
          insertError: { code: '23505', message: 'duplicate key value' },
          existingAccount: {
            account_number: '0123456789',
            bank_name: 'Wema Bank',
            account_name: 'Ogabassey / Old Customer',
            assigned_at: '2020-01-01T00:00:00.000Z',
            expires_at: '2020-01-01T00:30:00.000Z',
            provider: 'paystack',
          },
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createRequest({ credit_notes: 'Ship now' }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      virtualAccount: null,
    });
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Order payment account already exists, treating as idempotent success',
      })
    );
  });

  it('files reconciliation and rejects when the order was clamped as cancelled', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return createSelectSingleQuery({
          id: MERCHANT_ID,
          business_name: 'Ogabassey',
        });
      }

      if (table === 'orders') {
        return {
          ...createSelectSingleQuery({
            id: ORDER_ID,
            order_number: 'ORD-001',
            total: '5000',
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            payment_status: 'unpaid',
            shipping_status: 'pending',
          }),
          // The update returns the CLAMPED cancelled row.
          ...createUpdateQuery(null, {
            id: ORDER_ID,
            shipping_status: 'cancelled',
            cancelled_at: '2026-06-15T00:00:00Z',
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createRequest({ credit_notes: 'Ship now' }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Order was cancelled and cannot be shipped on credit',
      code: 'ORDER_CANCELLED',
    });
    // The reconciliation row is filed through the service-role admin client.
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: ORDER_ID,
      })
    );
    // No DVA was created for the cancelled order.
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
  });

  it('keeps ship-on-credit successful when the optional fallback lookup fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return createSelectSingleQuery({
          id: MERCHANT_ID,
          business_name: 'Ogabassey',
        });
      }

      if (table === 'orders') {
        return {
          ...createSelectSingleQuery({
            id: ORDER_ID,
            order_number: 'ORD-001',
            total: '5000',
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            payment_status: 'unpaid',
            shipping_status: 'pending',
          }),
          ...createUpdateQuery(),
        };
      }

      if (table === 'order_payment_accounts') {
        return createPaymentAccountTable({
          insertError: { code: '23505', message: 'duplicate key value' },
          existingAccountError: { message: 'read failed' },
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createRequest({ credit_notes: 'Ship now' }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      virtualAccount: null,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Optional credit-order payment account lookup failed after shipping transition',
        orderId: ORDER_ID,
      })
    );
  });
});
