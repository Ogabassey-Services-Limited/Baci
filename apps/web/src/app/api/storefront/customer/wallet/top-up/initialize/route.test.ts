import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockInitializePaystackTransaction = vi.fn();
const mockInitializeKorapayPayment = vi.fn();
const mockFrom = vi.fn();
const mockTransactionInsert = vi.fn();

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
    NODE_ENV: 'production',
  },
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

vi.mock('@/lib/paystack', () => ({
  initializeTransaction: (...args: unknown[]) =>
    mockInitializePaystackTransaction(...args),
}));

vi.mock('@/lib/korapay', () => ({
  initializePayment: (...args: unknown[]) =>
    mockInitializeKorapayPayment(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { POST } from './route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/storefront/customer/wallet/top-up/initialize',
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }
  );
}

interface MockMerchant {
  business_name: string;
  id: string;
  paystack_subaccount_code: string | null;
  slug: string;
}

interface MockSettings {
  korapay_enabled: boolean | null;
  paystack_enabled: boolean | null;
  preferred_local_gateway: string | null;
}

const defaultMerchant: MockMerchant = {
  business_name: 'Baci',
  id: 'merchant-1',
  paystack_subaccount_code: 'ACCT_123',
  slug: 'ogabassey',
};

const defaultSettings: MockSettings = {
  korapay_enabled: true,
  paystack_enabled: true,
  preferred_local_gateway: 'paystack',
};

function mockSupabaseTables({
  merchant = defaultMerchant,
  settings = defaultSettings,
  transactionError = null,
}: {
  merchant?: MockMerchant;
  settings?: MockSettings;
  transactionError?: { message: string } | null;
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'merchants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: merchant, error: null }),
          }),
        }),
      };
    }

    if (table === 'merchant_feature_settings') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: settings, error: null }),
          }),
        }),
      };
    }

    if (table === 'transactions') {
      return {
        insert: mockTransactionInsert.mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: transactionError ? null : { id: 'txn-1' },
              error: transactionError,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe('POST /api/storefront/customer/wallet/top-up/initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: {},
      user: { email: 'customer@example.com', id: 'user-1' },
    });
    mockResolveVtuCustomer.mockResolvedValue({
      email: 'customer@example.com',
      first_name: 'Ada',
      id: 'customer-1',
      last_name: 'Lovelace',
      phone: '08012345678',
    });
    mockInitializePaystackTransaction.mockResolvedValue({
      authorization_url: 'https://paystack.com/pay/wallet',
    });
    mockInitializeKorapayPayment.mockResolvedValue({
      authorization_url: 'https://korapay.com/pay/wallet',
      checkout_url: 'https://korapay.com/pay/wallet',
    });
    mockSupabaseTables();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });

    const response = await POST(
      makeRequest({ amount: 1000, merchantSlug: 'ogabassey' })
    );

    expect(response.status).toBe(401);
  });

  it('returns 400 when initialize payload validation fails', async () => {
    const response = await POST(
      makeRequest({ amount: 'invalid', merchantSlug: 'ogabassey' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      error: 'Invalid input',
    });
    expect(data).toHaveProperty('details.fieldErrors.amount');
    expect(data.details.fieldErrors.amount).toEqual(
      expect.arrayContaining([expect.any(String)])
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 400 for deliberate gateway-selection failures', async () => {
    mockSupabaseTables({
      merchant: { ...defaultMerchant, paystack_subaccount_code: null },
      settings: { ...defaultSettings, korapay_enabled: false },
    });

    const response = await POST(
      makeRequest({
        amount: 2500,
        gateway: 'korapay',
        merchantSlug: 'ogabassey',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'korapay is not enabled for wallet top-ups',
    });
    expect(mockInitializeKorapayPayment).not.toHaveBeenCalled();
  });

  it('uses gateway defaults when settings columns are null', async () => {
    mockSupabaseTables({
      settings: {
        korapay_enabled: null,
        paystack_enabled: null,
        preferred_local_gateway: null,
      },
    });

    const response = await POST(
      makeRequest({
        amount: 2500,
        merchantSlug: 'ogabassey',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      gateway: 'paystack',
      success: true,
    });
    expect(mockInitializePaystackTransaction).toHaveBeenCalledTimes(1);
    expect(mockInitializeKorapayPayment).not.toHaveBeenCalled();
  });

  it('initializes with merchantId when the storefront slug is unavailable or stale', async () => {
    const response = await POST(
      makeRequest({
        amount: 2500,
        gateway: 'paystack',
        merchantId: 'merchant-1',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      gateway: 'paystack',
      success: true,
    });
    expect(mockInitializePaystackTransaction).toHaveBeenCalledTimes(1);
  });

  it('uses the database default when korapay setting is null', async () => {
    mockSupabaseTables({
      settings: {
        korapay_enabled: null,
        paystack_enabled: true,
        preferred_local_gateway: null,
      },
    });

    const response = await POST(
      makeRequest({
        amount: 2500,
        gateway: 'korapay',
        merchantSlug: 'ogabassey',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      gateway: 'korapay',
      success: true,
    });
    expect(mockInitializeKorapayPayment).toHaveBeenCalledTimes(1);
  });

  it('returns 500 without exposing upstream payment errors', async () => {
    mockInitializePaystackTransaction.mockRejectedValue(
      new Error('upstream secret failure')
    );

    const response = await POST(
      makeRequest({
        amount: 2500,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Failed to initialize wallet top-up',
    });
  });

  it('returns 500 when transaction insert fails', async () => {
    mockSupabaseTables({
      merchant: { ...defaultMerchant, paystack_subaccount_code: null },
      transactionError: { message: 'insert failed' },
    });

    const response = await POST(
      makeRequest({
        amount: 2500,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Failed to initialize wallet top-up',
    });
  });

  it('returns a wallet checkout payload for paystack', async () => {
    const response = await POST(
      makeRequest({
        amount: 2500,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      authorization_url: 'https://paystack.com/pay/wallet',
      gateway: 'paystack',
      success: true,
    });
    expect(mockInitializePaystackTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 250000,
        email: 'customer@example.com',
        metadata: expect.objectContaining({
          customer_id: 'customer-1',
          transaction_type: 'wallet_topup',
        }),
        subaccount: 'ACCT_123',
      })
    );
    expect(mockTransactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        merchant_amount: 0,
        platform_fee: 0,
        transaction_type: 'payment',
      })
    );
  });
});
