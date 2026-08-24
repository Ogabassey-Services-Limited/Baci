import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

const {
  mockAuthenticateApiRequest,
  mockGetMerchantIdForApiUser,
  mockGeneratePaymentAccount,
  mockHasActivePaystackOrderDvaAlias,
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
    mockHasActivePaystackOrderDvaAlias: vi.fn(),
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

vi.mock('@/lib/payments/paystack-dva-order-alias', () => ({
  hasActivePaystackOrderDvaAlias: mockHasActivePaystackOrderDvaAlias,
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
    in: vi.fn().mockResolvedValue({ data, error }),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockResolvedValue({ error: writeError }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    upsert: vi.fn().mockResolvedValue({ error: writeError }),
    update: vi.fn().mockReturnThis(),
  };
}

const unpaidOrder = {
  id: ORDER_ID,
  order_number: 'ORD-001',
  total: '5000',
  amount_paid: '0',
  wallet_amount_used: '0',
  customer_name: 'John Doe',
  customer_email: 'john@test.com',
  customer_phone: '+2348012345678',
  payment_status: 'unpaid',
  shipping_status: 'pending',
  cancelled_at: null,
  currency: 'NGN',
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
  featureSettings = { paystack_enabled: true },
  order = unpaidOrder,
  orderError = null,
  paymentAccount = null,
  paymentAccountError = null,
  transactions = [],
  writeError = null,
}: {
  featureSettings?: unknown;
  order?: unknown;
  orderError?: unknown;
  paymentAccount?: unknown;
  paymentAccountError?: unknown;
  transactions?: unknown[];
  writeError?: unknown;
} = {}) {
  const orderQuery = mockQuery(order, orderError);
  const featureSettingsQuery = mockQuery(featureSettings);
  const transactionsQuery = mockQuery(transactions);
  const paymentAccountQuery = mockQuery(
    paymentAccount,
    paymentAccountError,
    writeError
  );
  mockFrom.mockImplementation((table: string) => {
    if (table === 'orders') return orderQuery;
    if (table === 'merchant_feature_settings') return featureSettingsQuery;
    if (table === 'transactions') return transactionsQuery;
    return paymentAccountQuery;
  });
  return paymentAccountQuery;
}

describe('POST /api/orders/[id]/generate-dva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasActivePaystackOrderDvaAlias.mockResolvedValue(false);
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

  it('rejects non-NGN orders before provisioning a Paystack account', async () => {
    authenticateMerchant();
    useOrderQueries({ order: { ...unpaidOrder, currency: 'USD' } });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('UNSUPPORTED_CURRENCY');
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
  });

  it('rejects orders without a customer email because the webhook cannot match them', async () => {
    authenticateMerchant();
    useOrderQueries({ order: { ...unpaidOrder, customer_email: null } });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('CUSTOMER_EMAIL_REQUIRED');
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
  });

  it('rejects automatic confirmation when Paystack is disabled', async () => {
    authenticateMerchant();
    useOrderQueries({ featureSettings: { paystack_enabled: false } });

    const response = await POST(createRequest(), createParams());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'GATEWAY_DISABLED' });
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
  });

  it.each([
    ['refunded', { payment_status: 'refunded' }],
    ['failed', { payment_status: 'failed' }],
    ['bnpl', { payment_status: 'bnpl_pending' }],
    ['cancelled shipping', { shipping_status: 'cancelled' }],
    ['cancelled timestamp', { cancelled_at: '2026-08-24T12:00:00.000Z' }],
  ])('rejects %s orders', async (_label, overrides) => {
    authenticateMerchant();
    useOrderQueries({ order: { ...unpaidOrder, ...overrides } });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('ORDER_NOT_ELIGIBLE_FOR_DVA');
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
  });

  it('returns existing DVA when one already exists', async () => {
    authenticateMerchant();
    const paymentAccountQuery = useOrderQueries({
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
    expect(paymentAccountQuery.update).toHaveBeenCalledWith({
      payable_amount: 5000,
    });
  });

  it('returns a legacy provider account instead of creating a second row', async () => {
    authenticateMerchant();
    const paymentAccountQuery = useOrderQueries();
    paymentAccountQuery.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          account_number: '1234567890',
          bank_name: 'Kora Bank',
          account_name: 'Ogabassey/John Doe',
          provider: 'korapay',
        },
        error: null,
      });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.existing).toBe(true);
    expect(body.virtualAccount.account_number).toBe('1234567890');
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
  });

  it('stops returning an expired Paystack account after its assignment window', async () => {
    authenticateMerchant();
    const paymentAccountQuery = useOrderQueries();
    paymentAccountQuery.maybeSingle
      .mockResolvedValueOnce({
        data: {
          account_number: '1234567890',
          bank_name: 'Wema Bank',
          account_name: 'Ogabassey/John Doe',
          provider: 'paystack',
          assigned_at: '2026-08-24T08:00:00.000Z',
          expires_at: '2026-08-24T09:30:00.000Z',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.code).toBe('PAYMENT_ACCOUNT_EXPIRED');
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
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

  it('persists the payable amount from reconciled transactions and wallet use', async () => {
    authenticateMerchant();
    const paymentAccountQuery = useOrderQueries({
      order: {
        ...unpaidOrder,
        amount_paid: '500',
        total: '10000',
        wallet_amount_used: '3000',
      },
      transactions: [
        { amount: '2000', gateway: 'paystack' },
        { amount: '1000', gateway: 'wallet' },
      ],
    });
    mockGeneratePaymentAccount.mockResolvedValue(generatedDva);

    const response = await POST(createRequest(), createParams());

    expect(response.status).toBe(200);
    expect(paymentAccountQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ payable_amount: 5000 })
    );
  });

  it('does not provision when reconciled payments cover the order', async () => {
    authenticateMerchant();
    useOrderQueries({
      transactions: [{ amount: '5000', gateway: 'paystack' }],
    });

    const response = await POST(createRequest(), createParams());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'NO_PAYABLE_AMOUNT' });
    expect(mockGeneratePaymentAccount).not.toHaveBeenCalled();
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

  it('does not persist a second active alias for the same Paystack account', async () => {
    authenticateMerchant();
    const paymentAccountQuery = useOrderQueries();
    mockGeneratePaymentAccount.mockResolvedValue(generatedDva);
    mockHasActivePaystackOrderDvaAlias.mockResolvedValue(true);

    const response = await POST(createRequest(), createParams());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'PAYSTACK_DVA_IN_USE',
    });
    expect(paymentAccountQuery.insert).not.toHaveBeenCalled();
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

  it('re-reads the winner when a concurrent insert wins the unique constraint', async () => {
    authenticateMerchant();
    const paymentAccountQuery = useOrderQueries({
      writeError: { code: '23505', message: 'duplicate key value' },
    });
    const racedAccount = {
      account_number: '9876543210',
      bank_name: 'Wema Bank',
      account_name: 'Ogabassey/John Doe',
      provider: 'paystack',
      assigned_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    paymentAccountQuery.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: racedAccount, error: null });
    mockGeneratePaymentAccount.mockResolvedValue(generatedDva);

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.existing).toBe(true);
    expect(body.virtualAccount.account_number).toBe('9876543210');
  });
});
