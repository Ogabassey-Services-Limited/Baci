import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthenticateApiRequest,
  mockGetMerchantIdForApiUser,
  mockGeneratePaymentAccount,
  mockFrom,
  mockLogger,
  mockSupabaseClient,
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
  };
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
  getMerchantIdForApiUser: mockGetMerchantIdForApiUser,
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

function createUpdateQuery(error: unknown = null) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    error,
  };
}

function createPaymentAccountTable(options: {
  insertError?: unknown;
  existingAccount?: {
    account_number: string;
    bank_name: string;
    account_name: string;
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

  it('returns 500 when inserting the payment account fails and no existing account is found', async () => {
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
          insertError: { code: '23505', message: 'insert failed' },
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

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to create payment account' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to insert order payment account',
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

  it('returns 500 when payment account fallback lookup fails', async () => {
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

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to create or fetch payment account',
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Database error fetching existing payment account',
        orderId: ORDER_ID,
      })
    );
  });
});
