import { jest } from '@jest/globals';
import { notifyManager } from '@tanstack/query-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { createElement, type PropsWithChildren } from 'react';
import { useVTUPurchase } from '@/hooks/use-vtu-purchase';

type MockFetchResponse = {
  ok: boolean;
  json: () => Promise<Record<string, unknown>>;
};

type MockUserResult = {
  data: { user: { id: string } | null };
  error: Error | null;
};

type MockSessionResult = {
  data: { session: { access_token: string } | null };
};

const mockFetchWithTimeout =
  jest.fn<(...args: unknown[]) => Promise<MockFetchResponse>>();
const mockScheduleLocalNotification =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetUser = jest.fn<() => Promise<MockUserResult>>();
const mockGetSession = jest.fn<() => Promise<MockSessionResult>>();

jest.mock('@/lib/fetch-with-timeout', () => ({
  DEFAULT_TIMEOUT: 30000,
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

jest.mock('@/services/push-notifications', () => ({
  scheduleLocalNotification: (...args: unknown[]) =>
    mockScheduleLocalNotification(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      getSession: () => mockGetSession(),
    },
  },
}));

jest.mock('@/stores/auth-store', () => {
  const { create } = require('zustand');

  return {
    useAuthStore: create(() => ({
      customer: { id: 'customer-1', email: 'customer@example.com' },
    })),
  };
});

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

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'auth-user-1' } },
    error: null,
  });
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'token-123' } },
  });
});

describe('useVTUPurchase', () => {
  it('resolves purchase success without waiting for cashback notification scheduling', async () => {
    const queryClient = createTestClient();
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        reference: 'VTU-123',
        amount: 1000,
        voucherPin: 'TOKEN-123',
        cashback: {
          amount: 50,
          credited: true,
          newBalance: 200,
        },
      }),
    });
    mockScheduleLocalNotification.mockReturnValue(new Promise(() => void 0));

    const { result, unmount } = renderHook(() => useVTUPurchase(), {
      wrapper: createWrapper(queryClient),
    });

    let response:
      | {
          success: boolean;
          reference: string;
          amount: number;
          voucherPin?: string;
          cashback?: { amount: number; credited: boolean; newBalance: number };
        }
      | undefined;

    await act(async () => {
      response = await result.current.mutateAsync({
        type: 'airtime',
        amount: 1000,
        phoneNumber: '08012345678',
        networkProvider: 'mtn',
      });
    });

    expect(response).toMatchObject({
      success: true,
      reference: 'VTU-123',
      amount: 1000,
      voucherPin: 'TOKEN-123',
    });
    expect(result.current.isPending).toBe(false);
    expect(mockScheduleLocalNotification).toHaveBeenCalledWith(
      'Cashback Received! 🎉',
      '₦50 cashback added to your wallet.',
      expect.objectContaining({
        amount: 50,
        type: 'wallet_cashback',
      }),
      1
    );
    const notificationPayload =
      mockScheduleLocalNotification.mock.calls[0]?.[2];
    expect(notificationPayload).not.toHaveProperty('voucherPin');

    unmount();
    queryClient.clear();
  });

  it('throws with server error message when API returns non-OK response', async () => {
    const queryClient = createTestClient();
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Insufficient wallet balance',
      }),
    });

    const { result, unmount } = renderHook(() => useVTUPurchase(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          type: 'airtime',
          amount: 1000,
          phoneNumber: '08012345678',
          networkProvider: 'mtn',
        })
      ).rejects.toThrow('Insufficient wallet balance');
    });

    expect(mockScheduleLocalNotification).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });

  it('throws when no authenticated user is present', async () => {
    const queryClient = createTestClient();
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result, unmount } = renderHook(() => useVTUPurchase(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          type: 'airtime',
          amount: 1000,
          phoneNumber: '08012345678',
          networkProvider: 'mtn',
        })
      ).rejects.toThrow('Authentication required. Please sign in again.');
    });

    expect(mockFetchWithTimeout).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });
});
