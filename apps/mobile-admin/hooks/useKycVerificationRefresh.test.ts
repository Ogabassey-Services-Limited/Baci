import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKycVerificationRefresh } from './useKycVerificationRefresh';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { queryClient, Wrapper };
}

describe('useKycVerificationRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the merchant, readiness, and verification status queries', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchVerificationStatus = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useKycVerificationRefresh({
          merchantId: 'merchant-1',
          refetchVerificationStatus,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await result.current.refreshAfterVerification();
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['store-readiness'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['verification-status', 'merchant-1'],
    });
    expect(refetchVerificationStatus).toHaveBeenCalledTimes(1);
  });

  it('skips verification-status invalidation when merchant id is missing', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchVerificationStatus = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useKycVerificationRefresh({
          merchantId: null,
          refetchVerificationStatus,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await result.current.refreshAfterVerification();
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['store-readiness'],
    });
    expect(refetchVerificationStatus).toHaveBeenCalledTimes(1);
  });
});
