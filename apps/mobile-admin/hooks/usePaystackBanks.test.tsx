import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaystackBanks } from '@/hooks/usePaystackBanks';

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
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const BANKS = [
  { id: 1, name: 'GTBank', slug: 'gtbank', code: '058', active: true },
  { id: 2, name: 'Access Bank', slug: 'access', code: '044', active: true },
  { id: 3, name: 'Kuda', slug: 'kuda', code: '50211', active: true },
];

describe('usePaystackBanks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches from /api/paystack/banks without requiring auth', async () => {
    mockApiClient.mockResolvedValueOnce({ banks: BANKS });

    const { result } = renderHook(() => usePaystackBanks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient).toHaveBeenCalledWith('/api/paystack/banks', {
      requiresAuth: false,
    });
  });

  it('unwraps the .banks array and returns PaystackBank[]', async () => {
    mockApiClient.mockResolvedValueOnce({ banks: BANKS });

    const { result } = renderHook(() => usePaystackBanks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(BANKS);
  });

  it('deduplicates banks with the same code', async () => {
    const banksWithDuplicate = [
      ...BANKS,
      {
        id: 99,
        name: 'GTBank Duplicate',
        slug: 'gtbank-dup',
        code: '058',
        active: true,
      },
    ];
    mockApiClient.mockResolvedValueOnce({ banks: banksWithDuplicate });

    const { result } = renderHook(() => usePaystackBanks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const codes = result.current.data?.map((b) => b.code) ?? [];
    expect(codes.filter((c) => c === '058')).toHaveLength(1);
    expect(result.current.data).toHaveLength(3);
  });

  it('exposes isLoading while fetching', () => {
    mockApiClient.mockReturnValueOnce(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => usePaystackBanks(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('exposes isError when the request fails', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePaystackBanks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
