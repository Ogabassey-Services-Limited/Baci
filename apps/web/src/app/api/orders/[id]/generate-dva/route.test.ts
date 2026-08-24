import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

const {
  mockAuthenticateApiRequest,
  mockGetMerchantIdForApiUser,
  mockGeneratePaymentAccount,
  mockFrom,
  mockRpc,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn().mockResolvedValue({ error: null });
  return {
    mockAuthenticateApiRequest: vi.fn(),
    mockGetMerchantIdForApiUser: vi.fn(),
    mockGeneratePaymentAccount: vi.fn(),
    mockFrom,
    mockRpc,
    mockSupabaseClient: {
      auth: { getUser: vi.fn() },
      from: mockFrom,
      rpc: mockRpc,
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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from './route';

const ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const MERCHANT_ID = 'merchant-123';

function createRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/orders/${ORDER_ID}/generate-dva`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function createParams(id = ORDER_ID) {
  return { params: Promise.resolve({ id }) };
}

function mockQuery(
  data: unknown,
  error: unknown = null,
  writeError: unknown = null
) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockResolvedValue({ error: writeError }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    upsert: vi.fn().mockResolvedValue({ error: writeError }),
  };
}

const unpaidOrder = {
  id: ORDER_ID,
  order_number: 'ORD-001',
  total: '5000',
  amount_paid: '0',
  customer_name: 'John Doe',
  customer_email: 'john@test.com',
  customer_phone: '+2348012345678',
  payment_status: 'unpaid',
  merchant_id: MERCHANT_ID,
};

const generatedDva = {
  success: true,
  data: {
    account_number: '9876543210',
    account_name: 'Ogabassey/John Doe',
    bank_name: 'Wema Bank',
    customer_code: 'CUS_test123',
  },
};

function authenticateMerchant(merchantId: string | null = MERCHANT_ID) {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: { id: 'user-1' },
    error: null,
    supabase: mockSupabaseClient,
  });
  mockGetMerchantIdForApiUser.mockResolvedValue(merchantId);
}

function useOrderQueries({
  order = unpaidOrder,
  orderError = null,
  paymentAccount = null,
  paymentAccountError = null,
  writeError = null,
}: {
  order?: unknown;
  orderError?: unknown;
  paymentAccount?: unknown;
  paymentAccountError?: unknown;
  writeError?: unknown;
} = {}) {
  const orderQuery = mockQuery(order, orderError);
  const paymentAccountQuery = mockQuery(
    paymentAccount,
    paymentAccountError,
    writeError
  );
  mockFrom.mockImplementation((table: string) =>
    table === 'orders' ? orderQuery : paymentAccountQuery
  );
  return paymentAccountQuery;
}

describe('POST /api/orders/[id]/generate-dva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(401);
  });

  it('returns 404 when merchant not found', async () => {
    authenticateMerchant(null);

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Merchant not found');
  });

  it('returns 400 for an invalid order ID', async () => {
    authenticateMerchant();

    const response = await POST(createRequest(), createParams('not-an-id'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'INVALID_ORDER_ID',
      error: 'Invalid order ID',
    });
    expect(mockGetMerchantIdForApiUser).not.toHaveBeenCalled();
  });

  it('returns 404 when order not found', async () => {
    authenticateMerchant();
    useOrderQueries({
      order: null,
      orderError: { code: 'PGRST116', message: 'Not found' },
    });

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(404);
  });

  it('returns 400 when order is already paid', async () => {
    authenticateMerchant();
    useOrderQueries({
      order: { ...unpaidOrder, payment_status: 'paid' },
    });

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Order is already paid');
  });

  it('returns existing DVA when one already exists', async () => {
    authenticateMerchant();
    useOrderQueries({
      paymentAccount: {
        account_number: '1234567890',
        bank_name: 'Wema Bank',
        account_name: 'Ogabassey/John Doe',
      },
    });

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.existing).toBe(true);
    expect(body.virtualAccount.account_number).toBe('1234567890');
  });

  it('returns 500 when checking for an existing DVA fails', async () => {
    authenticateMerchant();
    useOrderQueries({
      paymentAccountError: { message: 'connection reset' },
    });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to verify existing payment account');
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
  });

  it('provisions automatic invoice confirmation without creating a pending payment', async () => {
    authenticateMerchant();
    useOrderQueries();
    mockGeneratePaymentAccount.mockResolvedValue(generatedDva);

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.existing).toBe(false);
    expect(body.virtualAccount.account_number).toBe('9876543210');
    expect(body.virtualAccount.bank_name).toBe('Wema Bank');

    expect(mockGeneratePaymentAccount).toHaveBeenCalledWith({
      email: 'john@test.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+2348012345678',
      orderId: ORDER_ID,
    });

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 502 when Paystack DVA creation fails', async () => {
    authenticateMerchant();
    useOrderQueries();

    mockGeneratePaymentAccount.mockResolvedValue({
      success: false,
      error: 'wema-bank and titan-paycom both failed',
      code: 'DVA_CREATION_FAILED',
    });

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toContain('DVA creation failed');
  });

  it('returns 500 when the automatic confirmation account cannot be persisted', async () => {
    authenticateMerchant();
    useOrderQueries({
      writeError: { message: 'insert failed' },
    });
    mockGeneratePaymentAccount.mockResolvedValue(generatedDva);

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: 'PAYMENT_ACCOUNT_PERSIST_FAILED',
      error: 'Failed to save automatic confirmation account',
    });
  });
});
