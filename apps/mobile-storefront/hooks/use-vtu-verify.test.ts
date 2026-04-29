import { jest } from '@jest/globals';
import { notifyManager } from '@tanstack/query-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { createElement, type PropsWithChildren } from 'react';
import { useVTUVerify } from '@/hooks/use-vtu-verify';

const mockFetchWithTimeout =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetSession = jest.fn<() => Promise<unknown>>();

jest.mock('@/lib/fetch-with-timeout', () => ({
  SHORT_TIMEOUT: 10000,
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

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
      mutations: { retry: false, gcTime: 0 },
      queries: { retry: false, gcTime: 0 },
    },
  });
}

type NotifyFunction = Parameters<typeof notifyManager.setNotifyFunction>[0];

const defaultNotifyFunction: NotifyFunction = (callback) => {
  callback();
};

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    act(() => {
      callback();
    });
  });
});

afterAll(() => {
  notifyManager.setNotifyFunction(defaultNotifyFunction);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'token-123', user: { id: 'user-1' } } },
    error: null,
  });
  mockFetchWithTimeout.mockResolvedValue({
    ok: true,
    json: async () => ({
      verified: true,
      customerName: 'Test Customer',
      message: 'Customer verified',
    }),
  });
});

describe('useVTUVerify', () => {
  it('verifies bill customers with the authenticated mobile bearer token', async () => {
    const queryClient = createTestClient();
    const { result, unmount } = renderHook(() => useVTUVerify(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        billItemIdentifier: 'ekedc-prepaid',
        customerIdentifier: '43901766923',
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/api/vtu/verify'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        }),
      })
    );

    unmount();
    queryClient.clear();
  });

  it('fails before verification when the customer is not authenticated', async () => {
    const queryClient = createTestClient();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const { result, unmount } = renderHook(() => useVTUVerify(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          billItemIdentifier: 'ekedc-prepaid',
          customerIdentifier: '43901766923',
        })
      ).rejects.toThrow('Authentication required. Please sign in again.');
    });
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });

  it('surfaces session retrieval errors before verification', async () => {
    const queryClient = createTestClient();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Session refresh failed' },
    });
    const { result, unmount } = renderHook(() => useVTUVerify(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          billItemIdentifier: 'ekedc-prepaid',
          customerIdentifier: '43901766923',
        })
      ).rejects.toThrow('Session refresh failed');
    });
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });
});
