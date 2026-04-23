import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStorePublish } from './useStorePublish';

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

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { queryClient, Wrapper };
}

describe('useStorePublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes via the web API and invalidates merchant readiness data', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const onPublished = vi.fn().mockResolvedValue(undefined);

    mockApiClient.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(
      () =>
        useStorePublish({
          merchantId: 'merchant-1',
          onPublished,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await result.current.publishStore();
    });

    expect(mockApiClient).toHaveBeenCalledWith('/api/merchant/publish', {
      method: 'POST',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['store-readiness'],
    });
    expect(onPublished).toHaveBeenCalledTimes(1);
    expect(result.current.isPublishing).toBe(false);
  });

  it('fails fast when merchant context is missing', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useStorePublish({ merchantId: null }), {
      wrapper: Wrapper,
    });

    let thrownError: unknown = null;

    await act(async () => {
      try {
        await result.current.publishStore();
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe(
      'Merchant not loaded. Please try again.'
    );
    expect(mockApiClient).not.toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(false);
  });

  it('does not invalidate caches when the API reports an unsuccessful publish', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const onPublished = vi.fn().mockResolvedValue(undefined);

    mockApiClient.mockResolvedValueOnce({
      message: 'Cannot publish store',
      success: false,
    });

    const { result } = renderHook(
      () =>
        useStorePublish({
          merchantId: 'merchant-1',
          onPublished,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await expect(result.current.publishStore()).rejects.toThrow(
        'Cannot publish store'
      );
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(onPublished).not.toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(false);
  });
});
