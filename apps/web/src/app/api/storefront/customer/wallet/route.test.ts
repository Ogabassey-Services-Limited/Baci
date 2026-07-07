import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import { GET } from './route';

function request(path = '?merchant=ogabassey') {
  return new Request(
    `http://localhost:3000/api/storefront/customer/wallet${path}`
  );
}

function singleQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  const select = vi.fn(() => query);
  const eq = vi.fn(() => query);
  const single = vi.fn().mockResolvedValue({ data, error });
  Object.assign(query, { eq, select, single });
  return query;
}

function maybeSingleQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    }),
  };
}

function savingsQuery(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data, error }),
    }),
  };
}

function transactionsQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  };
}

describe('GET /api/storefront/customer/wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue(new Map());
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'jane@example.com', id: 'user-1' } },
      error: null,
    });
    // get_storefront_payment_settings RPC — SECURITY DEFINER, returns the
    // merchant's wallet DVA flag for storefront customers.
    mockRpc.mockResolvedValue({
      data: [{ wallet_paystack_dva_enabled: true }],
      error: null,
    });
  });

  it('returns 400 when merchant slug is missing', async () => {
    const response = await GET(request(''));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Merchant slug is required' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the customer is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'not authenticated' },
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      balance: 0,
      error: 'Unauthorized',
      transactions: [],
    });
  });

  it('returns 500 when an unexpected database error escapes the wallet fetch', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('database unavailable');
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      balance: 0,
      error: 'Failed to fetch wallet',
      transactions: [],
    });
  });

  it('returns 404 when the merchant lookup does not find a store', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return singleQuery(null, { code: 'PGRST116' });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Merchant not found' });
  });

  it('returns the expanded empty wallet contract when the customer is not linked yet', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return singleQuery({ id: 'merchant-1' });
      if (table === 'customers') return singleQuery(null);
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      balance: 0,
      earningsBalance: 0,
      fundingAccount: null,
      hasWallet: false,
      loyaltyPoints: 0,
      requiresFundingAccountConsent: true,
      savingsBalance: 0,
      totalEarned: 0,
      totalRedeemed: 0,
      transactions: [],
      walletDvaEnabled: true,
    });
  });

  it('keeps the core wallet response available when optional wallet helpers fail', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return singleQuery({ id: 'merchant-1' });
      if (table === 'customers') {
        return singleQuery({
          id: 'customer-1',
          loyalty_points: 1200,
        });
      }
      if (table === 'customer_wallets') {
        return singleQuery({
          available_balance: '5000',
          id: 'wallet-1',
          total_earned: '8000',
          total_redeemed: '3000',
        });
      }
      if (table === 'customer_wallet_transactions') {
        return transactionsQuery([]);
      }
      if (table === 'customer_savings_goals') {
        return savingsQuery([], { message: 'savings timeout' });
      }
      if (table === 'customer_wallet_payment_accounts') {
        return maybeSingleQuery(null, { message: 'funding account timeout' });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      balance: 5000,
      fundingAccount: null,
      requiresFundingAccountConsent: true,
      savingsBalance: 0,
      walletDvaEnabled: true,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Customer wallet optional fetch failed',
      {
        error: { message: 'savings timeout' },
        label: 'savings balance',
      }
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Customer wallet optional fetch failed',
      {
        error: { message: 'funding account timeout' },
        label: 'funding account',
      }
    );
    consoleErrorSpy.mockRestore();
  });

  it('returns wallet, savings, loyalty, transactions, and funding account summary', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return singleQuery({ id: 'merchant-1' });
      if (table === 'customers') {
        return singleQuery({
          id: 'customer-1',
          loyalty_points: 1200,
        });
      }
      if (table === 'customer_wallets') {
        return singleQuery({
          available_balance: '5000',
          id: 'wallet-1',
          total_earned: '8000',
          total_redeemed: '3000',
        });
      }
      if (table === 'customer_wallet_transactions') {
        return transactionsQuery([
          {
            amount: '5000',
            balance_after: '5000',
            created_at: '2026-05-21T10:00:00.000Z',
            description: 'Wallet top-up via paystack',
            id: 'wallet-txn-1',
            type: 'credit',
          },
        ]);
      }
      if (table === 'customer_savings_goals') {
        return savingsQuery([
          { current_amount: '20000' },
          { current_amount: '15000.5' },
        ]);
      }
      if (table === 'customer_wallet_payment_accounts') {
        return maybeSingleQuery({
          account_name: 'Ogabassey/Jane Doe',
          account_number: '1234567890',
          bank_name: 'Titan Paystack',
          provider: 'paystack',
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      balance: 5000,
      earningsBalance: 5000,
      fundingAccount: {
        accountName: 'Ogabassey/Jane Doe',
        accountNumber: '1234567890',
        bankName: 'Titan Paystack',
        provider: 'paystack',
      },
      hasWallet: true,
      loyaltyPoints: 1200,
      requiresFundingAccountConsent: false,
      savingsBalance: 35000.5,
      totalEarned: 8000,
      totalRedeemed: 3000,
      walletDvaEnabled: true,
    });
    expect(body.transactions).toHaveLength(1);
  });

  it('reports walletDvaEnabled false when the merchant has DVA funding disabled', async () => {
    mockRpc.mockResolvedValue({
      data: [{ wallet_paystack_dva_enabled: false }],
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return singleQuery({ id: 'merchant-1' });
      if (table === 'customers') return singleQuery(null);
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.walletDvaEnabled).toBe(false);
  });
});
