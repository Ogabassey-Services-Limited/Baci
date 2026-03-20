import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayouts } from '@/hooks/usePayouts';

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('usePayouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves accounts through the canonical paystack route', async () => {
    mockApiClient.mockResolvedValueOnce({
      account_name: 'Jane Doe',
      account_number: '1234567890',
      bank_id: null,
    });

    const { result } = renderHook(() => usePayouts(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.resolveAccount.mutateAsync({
        account_number: '1234567890',
        bank_code: '044',
      });
    });

    expect(mockApiClient).toHaveBeenCalledWith('/api/paystack/resolve', {
      method: 'POST',
      body: JSON.stringify({
        account_number: '1234567890',
        bank_code: '044',
      }),
    });
  });
});
