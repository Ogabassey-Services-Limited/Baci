import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebsiteAnalytics } from '@/hooks/useWebsiteAnalytics';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
  auth: {
    session: null as { access_token: string } | null,
    isLoading: false,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mocks.apiClient(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useWebsiteAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth = {
      session: null,
      isLoading: false,
    };
  });

  it('does not fetch while auth is loading', () => {
    mocks.auth = {
      session: { access_token: 'token' },
      isLoading: true,
    };

    const { result } = renderHook(() => useWebsiteAnalytics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mocks.apiClient).not.toHaveBeenCalled();
  });

  it('fetches website performance data for authenticated sessions', async () => {
    mocks.auth = {
      session: { access_token: 'token' },
      isLoading: false,
    };
    mocks.apiClient.mockResolvedValueOnce({
      summary: {
        bestSeller: { name: 'Product A' },
      },
      aiInsights: {
        insights: ['Good performance'],
      },
    });

    const { result } = renderHook(() => useWebsiteAnalytics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/analytics/website-performance'
    );
    expect(result.current.data?.summary.bestSeller?.name).toBe('Product A');
    expect(result.current.data?.aiInsights.insights[0]).toBe(
      'Good performance'
    );
  });

  it('exposes query error state when the request fails', async () => {
    mocks.auth = {
      session: { access_token: 'token' },
      isLoading: false,
    };
    mocks.apiClient.mockRejectedValueOnce(new Error('fetch failed'));

    const { result } = renderHook(() => useWebsiteAnalytics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('fetch failed'));
  });
});
