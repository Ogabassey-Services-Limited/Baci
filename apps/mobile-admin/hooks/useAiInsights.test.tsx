import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiInsights } from '@/hooks/useAiInsights';

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

describe('useAiInsights', () => {
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

    const { result } = renderHook(() => useAiInsights(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mocks.apiClient).not.toHaveBeenCalled();
  });

  it('fetches analytics insights for authenticated sessions', async () => {
    mocks.auth = {
      session: { access_token: 'token' },
      isLoading: false,
    };
    mocks.apiClient.mockResolvedValueOnce({
      insights: [
        {
          title: 'Fulfill orders',
          description: 'Pending fulfillment is high.',
          type: 'opportunity',
          priority: 'high',
          action: 'Ship pending orders',
        },
      ],
    });

    const { result } = renderHook(() => useAiInsights(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.apiClient).toHaveBeenCalledWith('/api/analytics/insights');
    expect(result.current.data?.insights[0]?.title).toBe('Fulfill orders');
  });

  it('exposes query error state when the insights request fails', async () => {
    mocks.auth = {
      session: { access_token: 'token' },
      isLoading: false,
    };
    mocks.apiClient.mockRejectedValueOnce(new Error('insights failed'));

    const { result } = renderHook(() => useAiInsights(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('insights failed'));
  });
});
