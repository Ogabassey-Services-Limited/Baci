import { describe, expect, it, jest } from '@jest/globals';
import { QueryObserver } from '@tanstack/query-core';
import { QueryClient } from '@tanstack/react-query';
import { clearQueryCachePreservingObservers } from './query-cache-observer-safety';

async function flushMicrotasks() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

describe('clearQueryCachePreservingObservers', () => {
  it('restarts an active query instead of orphaning it during logout', async () => {
    // Arrange: the first request is still pending when the cache is cleared.
    let resolveFirstRequest: ((value: string) => void) | undefined;
    const queryFn = jest.fn(() => {
      if (queryFn.mock.calls.length === 1) {
        return new Promise<string>((resolve) => {
          resolveFirstRequest = resolve;
        });
      }
      return Promise.resolve('fresh guest content');
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    queryClient.setQueryData(['private'], 'stale account data');
    const observer = new QueryObserver(queryClient, {
      queryKey: ['public-home'],
      queryFn,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await flushMicrotasks();

    // Act: this is the state reached when sign-out clears the cache mid-fetch.
    clearQueryCachePreservingObservers(queryClient);
    await flushMicrotasks();

    // Assert: active observers remain connected and refetch; inactive data is gone.
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toBe('fresh guest content');
    expect(queryClient.getQueryData(['private'])).toBeUndefined();

    resolveFirstRequest?.('stale account data');
    unsubscribe();
    queryClient.clear();
  });

  it('surfaces a rejected guest refetch while removing inactive account data', async () => {
    // Arrange: the second invocation is the refetch performed after logout.
    let resolveFirstRequest: ((value: string) => void) | undefined;
    const queryFn = jest.fn(() => {
      if (queryFn.mock.calls.length === 1) {
        return new Promise<string>((resolve) => {
          resolveFirstRequest = resolve;
        });
      }
      return Promise.reject(new Error('guest request failed'));
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    queryClient.setQueryData(['private'], 'stale account data');
    const observer = new QueryObserver(queryClient, {
      queryKey: ['public-home'],
      queryFn,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await flushMicrotasks();

    // Act
    clearQueryCachePreservingObservers(queryClient);
    await flushMicrotasks();

    // Assert
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().isError).toBe(true);
    expect(queryClient.getQueryData(['private'])).toBeUndefined();

    resolveFirstRequest?.('stale account data');
    unsubscribe();
    queryClient.clear();
  });
});
