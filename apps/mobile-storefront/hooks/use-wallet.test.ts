import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { notifyManager } from '@tanstack/query-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type PropsWithChildren } from 'react';

const mockCalculateCommerce =
  jest.fn<(type: string, payload: unknown) => Promise<unknown>>();
const mockRpc = jest.fn<(name: string, params?: unknown) => Promise<unknown>>();
const mockFrom = jest.fn<(table: string) => unknown>();

jest.mock('@/lib/supabase', () => ({
  calculateCommerce: (type: string, payload: unknown) =>
    mockCalculateCommerce(type, payload),
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    from: (table: string) => mockFrom(table),
    removeChannel: jest.fn(),
    rpc: (name: string, params?: unknown) => mockRpc(name, params),
  },
}));

jest.mock('@/lib/config', () => ({
  CONFIG: {
    MERCHANT_ID: 'configured-merchant',
    MERCHANT_SLUG: 'ogabassey',
  },
}));

jest.mock('@/stores/auth-store', () => {
  const { create } = require('zustand');

  return {
    useAuthStore: create(() => ({
      customer: { id: 'customer-1', email: 'customer@example.com' },
      merchantId: 'merchant-1',
      user: { id: 'user-1' },
    })),
  };
});

import { useRedeemPoints, useWallet, walletKeys } from '@/hooks/use-wallet';
import { useAuthStore } from '@/stores/auth-store';

function createMockUser(id = 'user-1') {
  return {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-04-30T00:00:00.000Z',
    id,
    user_metadata: {},
  } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
}

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
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
}

function setupHook() {
  const queryClient = createTestClient();
  queryClient.setQueryData<WalletQueryData>(
    walletKeys.data({ merchantId: 'merchant-1', ownerId: 'customer-1' }),
    {
      wallet: { balance: 0, loyalty_points: 1000 },
      transactions: [],
    }
  );

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
      user: createMockUser('user-1'),
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
  customerResult = createQueryResult([
    { id: 'customer-1', loyalty_points: 1200 },
  ]),
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
  const normalizedCustomerResult = Array.isArray(customerResult.data)
    ? customerResult
    : createQueryResult(
        customerResult.data ? [customerResult.data] : [],
        customerResult.error
      );
  const customerLimit = jest
    .fn<() => Promise<ReturnType<typeof createQueryResult>>>()
    .mockResolvedValue(normalizedCustomerResult);
  const walletMaybeSingle = jest
    .fn<() => Promise<ReturnType<typeof createQueryResult>>>()
    .mockResolvedValue(walletResult);
  const txLimit = jest
    .fn<() => Promise<ReturnType<typeof createQueryResult>>>()
    .mockResolvedValue(transactionsResult);
  const tableCalls: string[] = [];
  const customerFilters: [string, unknown][] = [];

  mockFrom.mockImplementation((table: string) => {
    tableCalls.push(table);

    if (table === 'customers') {
      const customerEqChain = {
        eq: jest.fn((column: string, value: unknown) => {
          customerFilters.push([column, value]);
          return customerEqChain;
        }),
        limit: customerLimit,
      };

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn((column: string, value: unknown) => {
            customerFilters.push([column, value]);
            return customerEqChain;
          }),
        }),
      };
    }

    if (table === 'customer_wallets') {
      const walletEqChain = {
        eq: jest.fn(() => walletEqChain),
        maybeSingle: walletMaybeSingle,
      };

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn(() => walletEqChain),
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

  return { customerFilters, tableCalls };
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

  it('normalizes wallet numeric fields returned as Postgres strings', async () => {
    setupWalletTableMocks({
      transactionsResult: createQueryResult([
        {
          amount: '0.75',
          created_at: '2026-04-30T20:53:51.407Z',
          description: 'Cashback - Airtime MTN ₦100',
          id: 'wallet-tx-1',
          type: 'cashback',
        },
      ]),
      walletResult: createQueryResult({
        available_balance: '3.25',
        id: 'wallet-1',
      }),
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.wallet.balance).toBe(3.25);
    expect(result.current.data?.transactions).toEqual([
      expect.objectContaining({
        amount: 0.75,
        description: 'Cashback - Airtime MTN ₦100',
        type: 'cashback',
      }),
    ]);

    unmount();
    queryClient.clear();
  });

  it('loads wallet data while customer hydration is still pending', async () => {
    const { customerFilters } = setupWalletTableMocks({
      customerResult: createQueryResult({
        id: 'customer-1',
        loyalty_points: 1200,
      }),
      walletResult: createQueryResult({
        available_balance: '3.25',
        id: 'wallet-1',
      }),
    });
    act(() => {
      useAuthStore.setState({
        customer: null,
        merchantId: 'merchant-1',
        user: createMockUser('user-1'),
      });
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.wallet).toEqual({
      balance: 3.25,
      loyalty_points: 1200,
    });
    expect(customerFilters).toContainEqual(['user_id', 'user-1']);

    unmount();
    queryClient.clear();
  });

  it('returns an empty wallet when customer lookup has no rows', async () => {
    const { tableCalls } = setupWalletTableMocks({
      customerResult: createQueryResult([]),
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual({
      wallet: { balance: 0, loyalty_points: 0 },
      transactions: [],
    });
    expect(tableCalls).not.toContain('customer_wallets');

    unmount();
    queryClient.clear();
  });

  it('returns an empty wallet and warns when customer lookup has multiple rows', async () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { tableCalls } = setupWalletTableMocks({
      customerResult: createQueryResult([
        { id: 'customer-1', loyalty_points: 1200 },
        { id: 'customer-2', loyalty_points: 900 },
      ]),
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual({
      wallet: { balance: 0, loyalty_points: 0 },
      transactions: [],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Expected one customer wallet owner, received multiple rows',
      {
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        userId: 'user-1',
      }
    );
    expect(tableCalls).not.toContain('customer_wallets');

    warnSpy.mockRestore();
    unmount();
    queryClient.clear();
  });

  it('uses the configured merchant when auth merchant hydration is still pending', async () => {
    const { customerFilters } = setupWalletTableMocks({
      customerResult: createQueryResult({
        id: 'customer-1',
        loyalty_points: 1200,
      }),
      walletResult: createQueryResult({
        available_balance: '3.25',
        id: 'wallet-1',
      }),
    });
    act(() => {
      useAuthStore.setState({
        customer: null,
        merchantId: null,
        user: createMockUser('user-1'),
      });
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.wallet.balance).toBe(3.25);
    expect(customerFilters).toContainEqual([
      'merchant_id',
      'configured-merchant',
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

  it('reports an error when the wallet transactions query fails', async () => {
    setupWalletTableMocks({
      transactionsResult: createQueryResult(null, {
        message: 'transactions query failed',
      }),
    });
    const queryClient = createTestClient();

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual({
      message: 'transactions query failed',
    });

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

  it('rolls back and invalidates the query key captured before auth changes', async () => {
    let rejectCommerce: ((reason?: Error) => void) | undefined;
    mockCalculateCommerce.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectCommerce = reject;
      })
    );
    const { result, unmount, queryClient } = setupHook();
    const originalQueryKey = walletKeys.data({
      merchantId: 'merchant-1',
      ownerId: 'customer-1',
    });
    const changedQueryKey = walletKeys.data({
      merchantId: 'merchant-2',
      ownerId: 'customer-2',
    });
    queryClient.setQueryData<WalletQueryData>(originalQueryKey, {
      wallet: { balance: 0, loyalty_points: 1000 },
      transactions: [],
    });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    let mutationPromise!: Promise<unknown>;
    act(() => {
      mutationPromise = result.current.mutateAsync(100);
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryData<WalletQueryData>(originalQueryKey)?.wallet
          .loyalty_points
      ).toBe(900)
    );

    act(() => {
      useAuthStore.setState({
        customer: { id: 'customer-2', email: 'changed@example.com' },
        merchantId: 'merchant-2',
        user: createMockUser('user-2'),
      });
    });

    await act(async () => {
      rejectCommerce?.(new Error('commerce failed'));
      await expect(mutationPromise).rejects.toThrow('commerce failed');
    });

    expect(queryClient.getQueryData<WalletQueryData>(originalQueryKey)).toEqual(
      {
        wallet: { balance: 0, loyalty_points: 1000 },
        transactions: [],
      }
    );
    expect(queryClient.getQueryData(changedQueryKey)).toBeUndefined();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: originalQueryKey,
    });

    invalidateSpy.mockRestore();
    unmount();
    queryClient.clear();
  });

  it('clamps optimistic loyalty points at zero', async () => {
    let resolveCommerce: ((value: unknown) => void) | undefined;
    mockCalculateCommerce.mockReturnValue(
      new Promise((resolve) => {
        resolveCommerce = resolve;
      })
    );
    const { result, unmount, queryClient } = setupHook();
    const queryKey = walletKeys.data({
      merchantId: 'merchant-1',
      ownerId: 'customer-1',
    });
    queryClient.setQueryData<WalletQueryData>(queryKey, {
      wallet: { balance: 0, loyalty_points: 50 },
      transactions: [],
    });

    let mutationPromise!: Promise<unknown>;
    act(() => {
      mutationPromise = result.current.mutateAsync(100);
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryData<WalletQueryData>(queryKey)?.wallet
          .loyalty_points
      ).toBe(0)
    );

    mockRpc.mockResolvedValue({
      data: {
        new_points_balance: 0,
        new_wallet_balance: 1000,
        points_deducted: 50,
        success: true,
        wallet_credited: 1000,
      },
      error: null,
    });
    act(() => {
      resolveCommerce?.({
        remainingPoints: 0,
        success: true,
        walletCredit: 1000,
      });
    });

    await act(async () => {
      await mutationPromise;
    });

    unmount();
    queryClient.clear();
  });
});
