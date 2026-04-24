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
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
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

  it('awaits the merchant invalidation before invalidating store readiness', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const events: string[] = [];
    let resolveMerchant: (() => void) | undefined;
    const merchantInvalidation = new Promise<void>((resolve) => {
      resolveMerchant = resolve;
    });

    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation((filters) => {
        const key = Array.isArray(filters?.queryKey)
          ? String(filters?.queryKey[0])
          : 'unknown';
        events.push(`invalidate:${key}`);
        if (key === 'merchant') {
          return merchantInvalidation;
        }
        return Promise.resolve();
      });

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
      const refreshPromise = result.current.refreshAfterVerification();
      // Allow the initial merchant invalidation to be scheduled before resolving.
      await Promise.resolve();
      expect(events).toEqual(['invalidate:merchant']);
      resolveMerchant?.();
      await refreshPromise;
    });

    expect(events[0]).toBe('invalidate:merchant');
    expect(events).toContain('invalidate:store-readiness');
    expect(events).toContain('invalidate:verification-status');
    expect(events.indexOf('invalidate:store-readiness')).toBeGreaterThan(
      events.indexOf('invalidate:merchant')
    );
    expect(invalidateQueries).toHaveBeenCalledTimes(3);
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
