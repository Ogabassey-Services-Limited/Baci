import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayouts } from '@/hooks/usePayouts';

const { mockApiClient, mockInvalidateStoreReadiness } = vi.hoisted(() => ({
  mockApiClient: vi.fn(),
  mockInvalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mockInvalidateStoreReadiness,
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

  it('invalidates only the active merchant readiness after a successful payout save', async () => {
    mockApiClient.mockResolvedValueOnce({ subaccount_code: 'SUB_123' });

    const { result } = renderHook(() => usePayouts(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.savePayoutSettings.mutateAsync({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      });
    });

    expect(mockInvalidateStoreReadiness).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1'
    );
  });

  it('does not invalidate readiness when payout saving fails', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('payout failed'));

    const { result } = renderHook(() => usePayouts(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.savePayoutSettings.mutateAsync({
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        })
      ).rejects.toThrow('payout failed');
    });

    expect(mockInvalidateStoreReadiness).not.toHaveBeenCalled();
  });
});
