import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notifyManager } from '@tanstack/query-core';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type PropsWithChildren } from 'react';

const mockCalculateCommerce = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  calculateCommerce: (...args: unknown[]) => mockCalculateCommerce(...args),
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    from: (...args: unknown[]) => mockFrom(...args),
    removeChannel: jest.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('@/stores/auth-store', () => {
  const { create } = require('zustand');

  return {
    useAuthStore: create(() => ({
      customer: { id: 'customer-1', email: 'customer@example.com' },
      merchantId: 'merchant-1',
    })),
  };
});

import { useRedeemPoints, useWallet, walletKeys } from './use-wallet';
import { useAuthStore } from '@/stores/auth-store';

type WalletQueryData = {
  wallet: { balance: number; loyalty_points: number };
  transactions: Array<{
    id: string;
    type:
      | 'credit'
      | 'debit'
      | 'cashback'
      | 'redemption'
      | 'bonus'
      | 'adjustment'
      | 'expiry';
    amount: number;
    description: string;
    created_at: string;
  }>;
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

function setupHook() {
  const queryClient = createTestClient();
  queryClient.setQueryData<WalletQueryData>(walletKeys.data('customer-1'), {
    wallet: { balance: 0, loyalty_points: 1000 },
    transactions: [],
  });

  const hook = renderHook(() => useRedeemPoints(), {
    wrapper: createWrapper(queryClient),
  });

  return { ...hook, queryClient };
}

beforeEach(() => {
  jest.clearAllMocks();

  act(() => {
    useAuthStore.setState({
      customer: { id: 'customer-1', email: 'customer@example.com' },
      merchantId: 'merchant-1',
    });
  });

  mockCalculateCommerce.mockResolvedValue({
    success: true,
    walletCredit: 900,
    pointsRedeemed: 90,
    remainingPoints: 910,
  });
});

function createQueryResult(data: unknown, error: unknown = null) {
  return { data, error };
}

function setupWalletTableMocks({
  customerResult = createQueryResult({ loyalty_points: 1200 }),
  transactionsResult = createQueryResult([
    {
      amount: 500,
      created_at: '2026-04-01T00:00:00.000Z',
      description: 'Cashback - Airtime MTN ₦1500',
      id: 'wallet-tx-1',
      type: 'cashback',
    },
  ]),
  walletResult = createQueryResult({
    available_balance: 750,
    id: 'wallet-1',
  }),
}: {
  customerResult?: ReturnType<typeof createQueryResult>;
  transactionsResult?: ReturnType<typeof createQueryResult>;
  walletResult?: ReturnType<typeof createQueryResult>;
} = {}) {
  const customerSingle = jest.fn().mockResolvedValue(customerResult);
  const walletMaybeSingle = jest.fn().mockResolvedValue(walletResult);
  const txLimit = jest.fn().mockResolvedValue(transactionsResult);
  const tableCalls: string[] = [];

  mockFrom.mockImplementation((table: string) => {
    tableCalls.push(table);

    if (table === 'customers') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ single: customerSingle }),
        }),
      };
    }

    if (table === 'customer_wallets') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ maybeSingle: walletMaybeSingle }),
          }),
        }),
      };
    }

    if (table === 'customer_wallet_transactions') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({ limit: txLimit }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { tableCalls };
}

describe('useWallet', () => {
  it('reads customer wallet transactions instead of merchant wallet transactions', async () => {
    const { tableCalls } = setupWalletTableMocks();
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(tableCalls).toContain('customer_wallet_transactions');
    expect(tableCalls).not.toContain('wallet_transactions');
    expect(result.current.data?.transactions).toEqual([
      expect.objectContaining({
        amount: 500,
        description: 'Cashback - Airtime MTN ₦1500',
        type: 'cashback',
      }),
    ]);

    unmount();
    queryClient.clear();
  });

  it('reports an error when the customer wallet query fails', async () => {
    const { tableCalls } = setupWalletTableMocks({
      walletResult: createQueryResult(null, { message: 'wallet query failed' }),
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual({ message: 'wallet query failed' });
    expect(tableCalls).toContain('customer_wallets');

    unmount();
    queryClient.clear();
  });

  it('returns an empty wallet when no wallet row exists yet', async () => {
    const { tableCalls } = setupWalletTableMocks({
      walletResult: createQueryResult(null),
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.wallet).toEqual({
      balance: 0,
      loyalty_points: 1200,
    });
    expect(result.current.data?.transactions).toEqual([]);
    expect(tableCalls).not.toContain('customer_wallet_transactions');

    unmount();
    queryClient.clear();
  });

  it('returns an empty transaction list when the wallet has no transactions', async () => {
    setupWalletTableMocks({
      transactionsResult: createQueryResult([]),
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.transactions).toEqual([]);

    unmount();
    queryClient.clear();
  });
});

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    act(() => {
      callback();
    });
  });
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    callback();
  });
});

describe('useRedeemPoints', () => {
  it('throws when redeem_loyalty_points RPC returns malformed data', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, wallet_credited: 500 },
      error: null,
    });

    const { result, unmount, queryClient } = setupHook();

    await act(async () => {
      await expect(result.current.mutateAsync(100)).rejects.toThrow(
        'Invalid redeem_loyalty_points RPC response'
      );
    });
    unmount();
    queryClient.clear();
  });

  it('throws server-provided error when redeem_loyalty_points returns success=false', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'Insufficient points' },
      error: null,
    });

    const { result, unmount, queryClient } = setupHook();

    await act(async () => {
      await expect(result.current.mutateAsync(100)).rejects.toThrow(
        'Insufficient points'
      );
    });
    unmount();
    queryClient.clear();
  });

  it('maps successful redeem_loyalty_points RPC values into mutation result', async () => {
    mockCalculateCommerce.mockResolvedValue({
      success: true,
      walletCredit: 111,
      pointsRedeemed: 11,
      remainingPoints: 989,
    });
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        wallet_credited: 2500,
        points_deducted: 120,
        new_points_balance: 880,
        new_wallet_balance: 12500,
      },
      error: null,
    });

    const { result, unmount, queryClient } = setupHook();
    let response:
      | {
          success: boolean;
          walletCredit: number;
          pointsRedeemed: number;
          remainingPoints: number;
        }
      | undefined;

    await act(async () => {
      response = (await result.current.mutateAsync(120)) as {
        success: boolean;
        walletCredit: number;
        pointsRedeemed: number;
        remainingPoints: number;
      };
    });

    expect(response).toMatchObject({
      success: true,
      walletCredit: 2500,
      pointsRedeemed: 120,
      remainingPoints: 880,
    });
    expect(mockRpc).toHaveBeenCalledWith('redeem_loyalty_points', {
      p_customer_id: 'customer-1',
      p_merchant_id: 'merchant-1',
      p_points: 120,
      p_wallet_credit: 111,
    });
    unmount();
    queryClient.clear();
  });
});
