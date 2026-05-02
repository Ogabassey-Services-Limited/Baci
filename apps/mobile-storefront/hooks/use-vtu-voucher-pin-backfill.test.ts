import { jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useVtuVoucherPinBackfill, POLL_INTERVAL_MS, MAX_POLL_ATTEMPTS } from './use-vtu-voucher-pin-backfill';

const mockGetSession = jest.fn<() => Promise<{ data: { session: null | { access_token: string } } }>>();
const mockFetchWithTimeout = jest.fn<(url: string, options: RequestInit) => Promise<Response>>();
const mockUseAuthStore = jest.fn<() => string | null>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
  },
}));

jest.mock('@/lib/fetch-with-timeout', () => ({
  fetchWithTimeout: (url: string, options: RequestInit) =>
    mockFetchWithTimeout(url, options),
  SHORT_TIMEOUT: 5000,
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user?: { id: string } | null }) => string | null) => {
    const id = mockUseAuthStore();
    return selector(id ? { user: { id } } : { user: null });
  },
}));

jest.mock('@/env', () => ({ EXPO_PUBLIC_API_URL: 'http://localhost:3001' }));
jest.mock('@/lib/config', () => ({ CONFIG: { MERCHANT_SLUG: 'test-merchant' } }));

function makeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: jest.fn<() => Promise<unknown>>().mockResolvedValue(body),
  } as unknown as Response;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const BASE_INPUT = {
  enabled: true,
  reference: 'REF-001',
  utilityType: 'power' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockUseAuthStore.mockReturnValue('user-1');
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useVtuVoucherPinBackfill', () => {
  it('returns the voucher pin once the poll finds a match', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      makeResponse({
        transactions: [{ request_reference: 'REF-001', voucher_pin: '1234-5678' }],
      })
    );

    const { result } = renderHook(() => useVtuVoucherPinBackfill(BASE_INPUT), { wrapper });

    await waitFor(() => expect(result.current).toBe('1234-5678'));
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('polls up to MAX_POLL_ATTEMPTS then stops', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      makeResponse({ transactions: [{ request_reference: 'REF-001', voucher_pin: null }] })
    );

    const { result } = renderHook(() => useVtuVoucherPinBackfill(BASE_INPUT), { wrapper });

    // Drain the initial fetch then advance one interval per remaining attempt
    await waitFor(() => expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1));
    for (let i = 1; i < MAX_POLL_ATTEMPTS; i++) {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await waitFor(() =>
        expect(mockFetchWithTimeout).toHaveBeenCalledTimes(i + 1)
      );
    }

    // Advance one more interval — the hook must NOT fire an extra request
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(MAX_POLL_ATTEMPTS);
    expect(result.current).toBeNull();
  });

  it('returns null and does not fetch when enabled is false', () => {
    const { result } = renderHook(
      () => useVtuVoucherPinBackfill({ ...BASE_INPUT, enabled: false }),
      { wrapper }
    );

    expect(result.current).toBeNull();
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('returns null immediately when apiType is null (unsupported utility type)', () => {
    const { result } = renderHook(
      () => useVtuVoucherPinBackfill({ ...BASE_INPUT, utilityType: 'airtime' as never }),
      { wrapper }
    );

    expect(result.current).toBeNull();
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('returns null immediately when userId is absent (unauthenticated)', () => {
    mockUseAuthStore.mockReturnValue(null);

    const { result } = renderHook(() => useVtuVoucherPinBackfill(BASE_INPUT), { wrapper });

    expect(result.current).toBeNull();
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('returns null when the HTTP request fails', async () => {
    mockFetchWithTimeout.mockResolvedValue(makeResponse({}, false));

    const { result } = renderHook(() => useVtuVoucherPinBackfill(BASE_INPUT), { wrapper });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
      expect(result.current).toBeNull();
    });
  });

  it('returns null when the response body does not match the schema', async () => {
    mockFetchWithTimeout.mockResolvedValue(makeResponse({ unexpected: true }));

    const { result } = renderHook(() => useVtuVoucherPinBackfill(BASE_INPUT), { wrapper });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
      expect(result.current).toBeNull();
    });
  });
});
