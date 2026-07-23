import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockAuthenticate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticate,
}));

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

function request() {
  return new Request(
    'http://localhost:3000/api/storefront/customer/wallet?merchant=ogabassey'
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

function transactionsQuery(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  };
}

function maybeSingleQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  };
}

function savingsQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  };
}

/**
 * The funding check loop uses `transactions` as its pre-transfer BASELINE. An
 * empty baseline served with a 200 is read as "this wallet had no top-ups",
 * so any top-up the loop then sees is announced as the customer's transfer.
 * These tests pin the contract that an empty list can only ever mean the truth.
 */
describe('GET /api/storefront/customer/wallet — baseline integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue(new Map());
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'jane@example.com', id: 'user-1' } },
      error: null,
    });
    mockAuthenticate.mockResolvedValue({
      error: null,
      supabase: { from: mockFrom, rpc: mockRpc },
      user: { email: 'jane@example.com', id: 'user-1' },
    });
    mockRpc.mockResolvedValue({
      data: [{ wallet_paystack_dva_enabled: true }],
      error: null,
    });
  });

  function mockTables(overrides: {
    transactions?: ReturnType<typeof transactionsQuery>;
    wallet?: ReturnType<typeof singleQuery>;
  }) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return singleQuery({ id: 'merchant-1' });
      if (table === 'customers') {
        return singleQuery({ id: 'customer-1', loyalty_points: 0 });
      }
      if (table === 'customer_wallets') {
        return (
          overrides.wallet ??
          singleQuery({
            available_balance: '5000',
            id: 'wallet-1',
            total_earned: '5000',
            total_redeemed: '0',
          })
        );
      }
      if (table === 'customer_wallet_transactions') {
        return overrides.transactions ?? transactionsQuery([]);
      }
      if (table === 'customer_savings_goals') return savingsQuery([]);
      if (table === 'customer_wallet_payment_accounts') {
        return maybeSingleQuery({
          account_name: 'Ogabassey/Jane Doe',
          account_number: '1234567890',
          bank_name: 'Titan Paystack',
          provider: 'paystack',
        });
      }
      if (table === 'customer_wallet_accounts') return maybeSingleQuery(null);
      throw new Error(`Unexpected table ${table}`);
    });
  }

  it('fails closed with 500 when the transactions query errors, instead of serving an empty baseline with a funding account', async () => {
    // Arrange: the transactions read blows up, but the funding account resolves.
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockTables({
      transactions: transactionsQuery([], { message: 'statement timeout' }),
    });

    // Act
    const response = await GET(request());
    const body = await response.json();

    // Assert: never a 200 carrying `transactions: []` + a usable fundingAccount.
    expect(response.status).toBe(500);
    expect(body).toEqual({
      balance: 0,
      error: 'Failed to fetch wallet',
      transactions: [],
    });
    expect(body.fundingAccount).toBeUndefined();
    consoleErrorSpy.mockRestore();
  });

  it('fails closed with 500 when the wallet lookup errors for a reason other than "no row"', async () => {
    // Arrange
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockTables({
      wallet: singleQuery(null, { code: '57014', message: 'query cancelled' }),
    });

    // Act
    const response = await GET(request());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(body).toEqual({
      balance: 0,
      error: 'Failed to fetch wallet',
      transactions: [],
    });
    consoleErrorSpy.mockRestore();
  });

  it('still returns the empty wallet contract when the customer genuinely has no wallet row (PGRST116)', async () => {
    // Arrange: "no row returned" is the truth, not a failure.
    mockTables({ wallet: singleQuery(null, { code: 'PGRST116' }) });

    // Act
    const response = await GET(request());
    const body = await response.json();

    // Assert: an empty baseline here is sound — there are genuinely no rows.
    expect(response.status).toBe(200);
    expect(body.transactions).toEqual([]);
    expect(body.balance).toBe(0);
    expect(body.fundingAccount).toMatchObject({ accountNumber: '1234567890' });
  });

  it('serves the transactions baseline with source_type on the happy path', async () => {
    // Arrange
    mockTables({
      transactions: transactionsQuery([
        {
          amount: '5000',
          balance_after: '5000',
          created_at: '2026-05-21T10:00:00.000Z',
          description: 'Wallet top-up via paystack',
          id: 'wallet-txn-1',
          source_type: 'wallet_topup',
          type: 'credit',
        },
      ]),
    });

    // Act
    const response = await GET(request());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]).toMatchObject({
      id: 'wallet-txn-1',
      source_type: 'wallet_topup',
      type: 'credit',
    });
  });
});
