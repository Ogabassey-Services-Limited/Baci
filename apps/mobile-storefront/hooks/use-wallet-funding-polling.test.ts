import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useWalletFundingPolling } from './use-wallet-funding-polling';

const mockGetOrderWalletFundingIntent =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockLoggerWarn = jest.fn<(...args: unknown[]) => void>();

jest.mock('@/lib/order-wallet-funding-intent', () => ({
  getOrderWalletFundingIntent: (...args: unknown[]) =>
    mockGetOrderWalletFundingIntent(...args),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  }),
}));

const completedIntent = {
  currency: 'NGN',
  expectedAmount: 20000,
  expiresAt: '2026-05-27T12:00:00.000Z',
  fundedAmount: 20000,
  id: '11111111-1111-4111-8111-111111111111',
  orderId: '22222222-2222-4222-8222-222222222222',
  orderPaid: true,
  status: 'completed',
  targetOrderAmount: 20000,
};
const pendingIntent = {
  ...completedIntent,
  fundedAmount: 0,
  orderPaid: false,
  status: 'pending',
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useWalletFundingPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('polls the funding intent and calls onCompleted once', async () => {
    const onCompleted = jest.fn();
    mockGetOrderWalletFundingIntent.mockResolvedValue({
      intent: completedIntent,
    });

    const { result } = renderHook(() =>
      useWalletFundingPolling({
        enabled: true,
        intentId: completedIntent.id,
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
        onCompleted,
        pollIntervalMs: 100,
        timeoutMs: 1000,
      })
    );

    await waitFor(() => {
      expect(result.current.intent).toEqual(completedIntent);
      expect(onCompleted).toHaveBeenCalledWith(completedIntent);
    });
    expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledWith({
      intentId: completedIntent.id,
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
    });
  });

  it('notifies user-facing error handlers for manual checks only', async () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    mockGetOrderWalletFundingIntent.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() =>
      useWalletFundingPolling({
        enabled: true,
        intentId: completedIntent.id,
        merchantSlug: 'ogabassey',
        onCompleted: jest.fn(),
        onError,
        pollIntervalMs: 100,
        timeoutMs: 1000,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.timedOut).toBe(true);
    expect(onError).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.checkNow({ notifyOnError: true });
    });

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Failed to check wallet-funded order status',
      expect.objectContaining({
        intentId: completedIntent.id,
      })
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.timedOut).toBe(true);
    jest.useRealTimers();
  });

  it('does not start overlapping interval polls while a request is in flight', async () => {
    jest.useFakeTimers();
    mockGetOrderWalletFundingIntent.mockReturnValue(
      new Promise(() => {
        // Keep the request pending so overlap guards can be asserted.
      })
    );

    renderHook(() =>
      useWalletFundingPolling({
        enabled: true,
        intentId: completedIntent.id,
        onCompleted: jest.fn(),
        pollIntervalMs: 100,
        timeoutMs: 1000,
      })
    );

    await waitFor(() => {
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('does not start a manual check while an interval request is in flight', async () => {
    const firstPoll = createDeferred<{ intent: typeof pendingIntent }>();
    mockGetOrderWalletFundingIntent.mockReturnValueOnce(firstPoll.promise);

    const { result } = renderHook(() =>
      useWalletFundingPolling({
        enabled: true,
        intentId: completedIntent.id,
        onCompleted: jest.fn(),
        pollIntervalMs: 10_000,
        timeoutMs: 10_000,
      })
    );

    await waitFor(() => {
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.checkNow({ notifyOnError: true });
    });

    expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstPoll.resolve({ intent: pendingIntent });
      await firstPoll.promise;
    });
  });

  it('does not poll while disabled', () => {
    renderHook(() =>
      useWalletFundingPolling({
        enabled: false,
        intentId: completedIntent.id,
        onCompleted: jest.fn(),
        pollIntervalMs: 100,
        timeoutMs: 1000,
      })
    );

    expect(mockGetOrderWalletFundingIntent).not.toHaveBeenCalled();
  });

  it('clears interval polling when unmounted', async () => {
    jest.useFakeTimers();
    mockGetOrderWalletFundingIntent.mockReturnValue(
      new Promise(() => {
        // Keep the request pending until unmount.
      })
    );
    const { unmount } = renderHook(() =>
      useWalletFundingPolling({
        enabled: true,
        intentId: completedIntent.id,
        onCompleted: jest.fn(),
        pollIntervalMs: 100,
        timeoutMs: 1000,
      })
    );

    await waitFor(() => {
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledTimes(1);
    });
    mockGetOrderWalletFundingIntent.mockClear();
    unmount();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockGetOrderWalletFundingIntent).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('ignores async completion after unmount', async () => {
    const onCompleted = jest.fn();
    const deferred = createDeferred<{ intent: typeof completedIntent }>();
    mockGetOrderWalletFundingIntent.mockReturnValueOnce(deferred.promise);

    const { unmount } = renderHook(() =>
      useWalletFundingPolling({
        enabled: true,
        intentId: completedIntent.id,
        onCompleted,
        pollIntervalMs: 100,
        timeoutMs: 1000,
      })
    );

    await waitFor(() => {
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledTimes(1);
    });
    unmount();

    await act(async () => {
      deferred.resolve({ intent: completedIntent });
      await deferred.promise;
    });

    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('sets timedOut when the polling window expires', async () => {
    jest.useFakeTimers();
    mockGetOrderWalletFundingIntent.mockReturnValue(
      new Promise(() => {
        // Keep the request pending until the timeout elapses.
      })
    );
    const { result } = renderHook(() =>
      useWalletFundingPolling({
        enabled: true,
        intentId: completedIntent.id,
        onCompleted: jest.fn(),
        pollIntervalMs: 500,
        timeoutMs: 1000,
      })
    );

    await waitFor(() => {
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.timedOut).toBe(true);
    jest.useRealTimers();
  });

  it('polls pending intents until completion and calls onCompleted once', async () => {
    jest.useFakeTimers();
    const onCompleted = jest.fn();
    const firstPoll = createDeferred<{ intent: typeof pendingIntent }>();
    const secondPoll = createDeferred<{ intent: typeof completedIntent }>();
    mockGetOrderWalletFundingIntent
      .mockReturnValueOnce(firstPoll.promise)
      .mockReturnValueOnce(secondPoll.promise);

    const { result } = renderHook(() =>
      useWalletFundingPolling({
        enabled: true,
        intentId: completedIntent.id,
        onCompleted,
        pollIntervalMs: 100,
        timeoutMs: 1000,
      })
    );

    await act(async () => {
      firstPoll.resolve({ intent: pendingIntent });
      await firstPoll.promise;
    });
    expect(result.current.intent?.status).toBe('pending');

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondPoll.resolve({ intent: completedIntent });
      await secondPoll.promise;
    });

    await waitFor(() => {
      expect(result.current.intent?.status).toBe('completed');
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });
    jest.useRealTimers();
  });

  it('resets polling when the intent id changes', async () => {
    mockGetOrderWalletFundingIntent.mockResolvedValue({
      intent: pendingIntent,
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useWalletFundingPolling>,
      { intentId: string }
    >(
      ({ intentId }) =>
        useWalletFundingPolling({
          enabled: true,
          intentId,
          merchantSlug: 'ogabassey',
          onCompleted: jest.fn(),
          pollIntervalMs: 10_000,
          timeoutMs: 10_000,
        }),
      { initialProps: { intentId: 'intent-old' } }
    );

    await waitFor(() => {
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledWith(
        expect.objectContaining({ intentId: 'intent-old' })
      );
    });

    rerender({ intentId: 'intent-new' });

    await waitFor(() => {
      expect(result.current.intent?.status).toBe('pending');
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledWith(
        expect.objectContaining({ intentId: 'intent-new' })
      );
    });
  });

  it('ignores a stale completion after the intent id changes', async () => {
    const oldCompletedIntent = {
      ...completedIntent,
      id: '33333333-3333-4333-8333-333333333333',
    };
    const newCompletedIntent = {
      ...completedIntent,
      id: '44444444-4444-4444-8444-444444444444',
    };
    const oldPoll = createDeferred<{ intent: typeof oldCompletedIntent }>();
    const onCompleted = jest.fn();
    mockGetOrderWalletFundingIntent
      .mockReturnValueOnce(oldPoll.promise)
      .mockResolvedValueOnce({ intent: newCompletedIntent });

    const { rerender } = renderHook<
      ReturnType<typeof useWalletFundingPolling>,
      { intentId: string }
    >(
      ({ intentId }) =>
        useWalletFundingPolling({
          enabled: true,
          intentId,
          merchantSlug: 'ogabassey',
          onCompleted,
          pollIntervalMs: 10_000,
          timeoutMs: 10_000,
        }),
      { initialProps: { intentId: oldCompletedIntent.id } }
    );

    await waitFor(() => {
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledWith(
        expect.objectContaining({ intentId: oldCompletedIntent.id })
      );
    });

    rerender({ intentId: newCompletedIntent.id });

    await waitFor(() => {
      expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledWith(
        expect.objectContaining({ intentId: newCompletedIntent.id })
      );
    });

    await act(async () => {
      oldPoll.resolve({ intent: oldCompletedIntent });
      await oldPoll.promise;
    });

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledWith(newCompletedIntent);
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });
});
