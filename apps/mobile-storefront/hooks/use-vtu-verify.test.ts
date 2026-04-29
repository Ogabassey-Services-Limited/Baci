import { jest } from '@jest/globals';
import { notifyManager } from '@tanstack/query-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
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
const hookCleanups: Array<() => void> = [];

function renderUseVTUVerify() {
  const queryClient = createTestClient();
  const rendered = renderHook(() => useVTUVerify(), {
    wrapper: createWrapper(queryClient),
  });
  hookCleanups.push(() => {
    rendered.unmount();
    queryClient.clear();
  });

  return rendered;
}

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    act(() => {
      callback();
    });
  });
});

afterAll(() => {
  // TanStack Query exposes a setter but no getter, so restore its documented
  // default notification behavior after wrapping notifications in act().
  notifyManager.setNotifyFunction(defaultNotifyFunction);
});

afterEach(() => {
  for (const cleanup of hookCleanups.splice(0)) {
    cleanup();
  }
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
    const { result } = renderUseVTUVerify();

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
    await waitFor(() => {
      expect(result.current.data).toEqual({
        verified: true,
        customerName: 'Test Customer',
        message: 'Customer verified',
      });
    });
  });

  it('verifies bill customers without a local session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const { result } = renderUseVTUVerify();

    await act(async () => {
      await result.current.mutateAsync({
        billItemIdentifier: 'ekedc-prepaid',
        customerIdentifier: '43901766923',
      });
    });
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/api/vtu/verify'),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
  });

  it('continues verification when session retrieval fails', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Session refresh failed' },
    });
    const { result } = renderUseVTUVerify();

    try {
      await act(async () => {
        await result.current.mutateAsync({
          billItemIdentifier: 'ekedc-prepaid',
          customerIdentifier: '43901766923',
        });
      });

      expect(console.warn).toHaveBeenCalledWith(
        'Continuing VTU verification without a local session:',
        { message: 'Session refresh failed' }
      );
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });
});
