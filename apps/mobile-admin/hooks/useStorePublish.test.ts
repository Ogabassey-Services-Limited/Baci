import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStorePublish } from './useStorePublish';

const { mockApiClient, TestNetworkError } = vi.hoisted(() => {
  class TestNetworkError extends Error {
    public readonly isTimeout: boolean;
    public readonly isOffline: boolean;
    public readonly statusCode?: number;
    public readonly data?: unknown;

    constructor(
      message: string,
      options: {
        isTimeout?: boolean;
        isOffline?: boolean;
        statusCode?: number;
        data?: unknown;
      } = {}
    ) {
      super(message);
      this.name = 'NetworkError';
      this.isTimeout = options.isTimeout ?? false;
      this.isOffline = options.isOffline ?? false;
      this.statusCode = options.statusCode;
      this.data = options.data;
    }
  }
  return {
    mockApiClient: vi.fn(),
    TestNetworkError,
  };
});

vi.mock('@/lib/api-client', () => ({
  NetworkError: TestNetworkError,
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
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
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
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant-payout'],
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

  it('surfaces validation errors with missingItems when apiClient throws NetworkError', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const onPublished = vi.fn().mockResolvedValue(undefined);

    mockApiClient.mockRejectedValueOnce(
      new TestNetworkError('Cannot publish store', {
        statusCode: 400,
        data: {
          error: 'Cannot publish store',
          message: 'Please complete the following required items:',
          missingItems: ['Bank account details', 'Contact information'],
        },
      })
    );

    const { result } = renderHook(
      () =>
        useStorePublish({
          merchantId: 'merchant-1',
          onPublished,
        }),
      { wrapper: Wrapper }
    );

    let thrownError: unknown = null;
    await act(async () => {
      try {
        await result.current.publishStore();
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBeInstanceOf(Error);
    const message = (thrownError as Error).message;
    expect(message).toContain('Please complete the following required items');
    expect(message).toContain('- Bank account details');
    expect(message).toContain('- Contact information');
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(onPublished).not.toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(false);
  });

  it('rethrows non-NetworkError failures unchanged', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const onPublished = vi.fn();

    const original = new Error('boom');
    mockApiClient.mockRejectedValueOnce(original);

    const { result } = renderHook(
      () =>
        useStorePublish({
          merchantId: 'merchant-1',
          onPublished,
        }),
      { wrapper: Wrapper }
    );

    let thrownError: unknown = null;
    await act(async () => {
      try {
        await result.current.publishStore();
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBe(original);
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(onPublished).not.toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(false);
  });
});
