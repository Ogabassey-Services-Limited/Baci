import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetchWalletData } from './wallet-data';

type QueryResult = {
  data: unknown;
  error: unknown;
};

const mockFrom = jest.fn<(table: string) => unknown>();
const mockTrackEvent = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

jest.mock('@/services/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

function createResult(data: unknown, error: unknown = null): QueryResult {
  return { data, error };
}

function setupSupabaseTables(
  overrides: Partial<Record<string, QueryResult>> = {}
) {
  const tableResults: Record<string, QueryResult> = {
    customers: createResult([{ id: 'customer-1', loyalty_points: 1200 }]),
    customer_wallet_payment_accounts: createResult(null),
    customer_wallet_transactions: createResult([]),
    customer_wallets: createResult({
      available_balance: '5000',
      id: 'wallet-1',
    }),
    customer_savings_goals: createResult([]),
    ...overrides,
  };
  const tableCalls: string[] = [];

  mockFrom.mockImplementation((table: string) => {
    tableCalls.push(table);
    const query = {
      eq: jest.fn(() => query),
      in: jest.fn(async () => tableResults[table]),
      limit: jest.fn(async () => tableResults[table]),
      maybeSingle: jest.fn(async () => tableResults[table]),
      order: jest.fn(() => query),
      select: jest.fn(() => query),
    };
    return query;
  });

  return { tableCalls };
}

describe('fetchWalletData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty wallet without querying when no owner identifier exists', async () => {
    const result = await fetchWalletData(null, 'merchant-1', null);

    expect(result).toEqual({
      wallet: {
        balance: 0,
        earnings_balance: 0,
        funding_account: null,
        loyalty_points: 0,
        requires_funding_account_consent: true,
        savings_balance: 0,
        total_balance: 0,
      },
      transactions: [],
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('coerces loyalty points when a resolved customer id is unavailable', async () => {
    setupSupabaseTables({
      customers: createResult([{ loyalty_points: '1200.5' }]),
    });

    const result = await fetchWalletData(null, 'merchant-1', 'user-1');

    expect(result.wallet.loyalty_points).toBe(1200.5);
    expect(result.wallet.balance).toBe(0);
    expect(result.transactions).toEqual([]);
  });

  it('combines wallet, funding account, savings balance, and valid transactions', async () => {
    setupSupabaseTables({
      customer_wallet_payment_accounts: createResult({
        account_name: 'Ogabassey/Jane Doe',
        account_number: '1234567890',
        bank_name: 'Titan Paystack',
        provider: 'paystack',
      }),
      customer_savings_goals: createResult([
        { current_amount: '20000' },
        { current_amount: 15000.5 },
        { current_amount: 'bad-number' },
      ]),
      customer_wallet_transactions: createResult([
        {
          amount: '2500',
          created_at: '2026-05-21T10:00:00.000Z',
          description: null,
          id: 'tx-1',
          type: 'credit',
        },
        {
          amount: 'not-a-number',
          created_at: '2026-05-21T10:00:00.000Z',
          id: 'tx-invalid',
          type: 'credit',
        },
      ]),
    });

    const result = await fetchWalletData('customer-1', 'merchant-1', 'user-1');

    expect(result.wallet).toEqual({
      balance: 5000,
      earnings_balance: 5000,
      funding_account: {
        account_name: 'Ogabassey/Jane Doe',
        account_number: '1234567890',
        bank_name: 'Titan Paystack',
        provider: 'paystack',
      },
      loyalty_points: 1200,
      requires_funding_account_consent: false,
      savings_balance: 35000.5,
      total_balance: 40000.5,
    });
    expect(result.transactions).toEqual([
      {
        amount: 2500,
        created_at: '2026-05-21T10:00:00.000Z',
        description: '',
        id: 'tx-1',
        type: 'credit',
      },
    ]);
  });

  it('logs and returns an empty wallet when multiple customer owners match', async () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    setupSupabaseTables({
      customers: createResult([
        { id: 'customer-1', loyalty_points: 1200 },
        { id: 'customer-2', loyalty_points: 900 },
      ]),
    });

    const result = await fetchWalletData(null, 'merchant-1', 'user-1');

    expect(result.wallet.balance).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      'Expected one customer wallet owner, received multiple rows',
      expect.objectContaining({
        merchantId: 'merchant-1',
        userId: 'user-1',
      })
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'multiple_customer_wallet_owner',
      expect.objectContaining({ severity: 'data_integrity' })
    );

    warnSpy.mockRestore();
  });

  it('drops malformed funding account rows and requires consent', async () => {
    setupSupabaseTables({
      customer_wallet_payment_accounts: createResult({
        account_name: 'Ogabassey/Jane Doe',
        account_number: 'not-an-account',
        bank_name: 'Titan Paystack',
        provider: 'paystack',
      }),
    });

    const result = await fetchWalletData('customer-1', 'merchant-1', 'user-1');

    expect(result.wallet.funding_account).toBeNull();
    expect(result.wallet.requires_funding_account_consent).toBe(true);
  });

  it.each([
    ['customer lookup', 'customers'],
    ['wallet lookup', 'customer_wallets'],
    ['funding account lookup', 'customer_wallet_payment_accounts'],
    ['savings lookup', 'customer_savings_goals'],
    ['transaction lookup', 'customer_wallet_transactions'],
  ])('throws %s errors', async (_label, tableName) => {
    setupSupabaseTables({
      [tableName]: createResult(null, new Error(`${tableName} failed`)),
    });

    await expect(
      fetchWalletData('customer-1', 'merchant-1', 'user-1')
    ).rejects.toThrow(`${tableName} failed`);
  });
});
