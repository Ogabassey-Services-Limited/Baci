import { notifyManager } from '@tanstack/query-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type PropsWithChildren } from 'react';
import { useVTUHistory } from '@/hooks/use-vtu-history';

const mockFetchWithTimeout = jest.fn();
const mockGetUser = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/lib/fetch-with-timeout', () => ({
  SHORT_TIMEOUT: 10000,
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (
      selector: (state: { user: { id: string } | null }) => unknown
    ) => selector({ user: { id: 'auth-user-1' } })
  ),
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
      queries: { retry: false, gcTime: 0 },
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
  mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'token-123' } },
  });
});

describe('useVTUHistory', () => {
  it('loads utility history for the selected filter', async () => {
    const queryClient = createTestClient();
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        transactions: [
          {
            id: 'tx-1',
            created_at: '2026-04-08T12:00:00.000Z',
            type: 'electricity',
            status: 'successful',
            amount: 2500,
            biller_name: 'EKEDC NG',
            customer_identifier: '1234567890',
            request_reference: 'VTU-123',
            customer_cashback: 0,
            payment_status: 'completed',
          },
        ],
      }),
    });

    const { result, unmount } = renderHook(() => useVTUHistory('power'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      expect.objectContaining({
        type: 'electricity',
        biller_name: 'EKEDC NG',
        payment_status: 'completed',
      }),
    ]);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/api/vtu/history?'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
    expect(mockFetchWithTimeout.mock.calls[0]?.[0]).toContain('type=electricity');

    unmount();
    queryClient.clear();
  });

  it('surfaces the server error message when the request fails', async () => {
    const queryClient = createTestClient();
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'History is unavailable' }),
    });

    const { result, unmount } = renderHook(() => useVTUHistory('all'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('History is unavailable'));

    unmount();
    queryClient.clear();
  });
});
