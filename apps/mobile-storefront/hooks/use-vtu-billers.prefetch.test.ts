import { jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { usePrefetchBillers, vtuBillerKeys } from '@/hooks/use-vtu-billers';
import { fetchWithRetry } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  fetchWithRetry: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockFetchWithRetry = fetchWithRetry as jest.MockedFunction<
  typeof fetchWithRetry
>;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function mockFrameScheduler() {
  const frameCallbacks: FrameRequestCallback[] = [];
  const requestFrameSpy = jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
  const cancelFrameSpy = jest
    .spyOn(globalThis, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);

  return { cancelFrameSpy, frameCallbacks, requestFrameSpy };
}

function flushFrames(frameCallbacks: FrameRequestCallback[]) {
  while (frameCallbacks.length > 0) {
    const callback = frameCallbacks.shift();
    callback?.(0);
  }
}

describe('usePrefetchBillers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFetchWithRetry.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ billers: [] }),
    } as Awaited<ReturnType<typeof fetchWithRetry>>);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('defers and staggers utility biller prefetches after initial frames', () => {
    const { frameCallbacks, requestFrameSpy, cancelFrameSpy } =
      mockFrameScheduler();
    const queryClient = createQueryClient();
    const { unmount } = renderHook(() => usePrefetchBillers(), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockFetchWithRetry).not.toHaveBeenCalled();

    flushFrames(frameCallbacks);
    jest.advanceTimersByTime(699);
    expect(mockFetchWithRetry).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(250);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(500);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(4);

    unmount();
    queryClient.clear();
    requestFrameSpy.mockRestore();
    cancelFrameSpy.mockRestore();
  });

  it('cancels deferred biller prefetches when the panel unmounts', () => {
    const { frameCallbacks, requestFrameSpy, cancelFrameSpy } =
      mockFrameScheduler();
    const queryClient = createQueryClient();
    const { unmount } = renderHook(() => usePrefetchBillers(), {
      wrapper: createWrapper(queryClient),
    });

    unmount();
    flushFrames(frameCallbacks);
    jest.runOnlyPendingTimers();

    expect(mockFetchWithRetry).not.toHaveBeenCalled();

    queryClient.clear();
    requestFrameSpy.mockRestore();
    cancelFrameSpy.mockRestore();
  });

  it('keeps staggered prefetch scheduling when a biller fetch rejects', async () => {
    const { frameCallbacks, requestFrameSpy, cancelFrameSpy } =
      mockFrameScheduler();
    const queryClient = createQueryClient();
    mockFetchWithRetry.mockRejectedValue(new Error('network unavailable'));

    const { unmount } = renderHook(() => usePrefetchBillers(), {
      wrapper: createWrapper(queryClient),
    });

    flushFrames(frameCallbacks);
    jest.advanceTimersByTime(1450);
    await Promise.resolve();

    expect(mockFetchWithRetry).toHaveBeenCalledTimes(4);
    expect(
      queryClient.getQueryData(vtuBillerKeys.byType('data'))
    ).toBeUndefined();

    unmount();
    queryClient.clear();
    requestFrameSpy.mockRestore();
    cancelFrameSpy.mockRestore();
  });
});
