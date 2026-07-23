import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getIntentMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/order-wallet-funding-intent-client', () => ({
  getOrderWalletFundingIntent: getIntentMock,
}));

import { useWalletFundingPolling } from './use-wallet-funding-polling';

const BASE_INTENT = {
  currency: 'NGN',
  expectedAmount: 5000,
  expiresAt: '2026-07-13T10:30:00.000Z',
  fundedAmount: 0,
  id: 'intent-1',
  orderId: 'order-1',
  status: 'pending' as const,
  targetOrderAmount: 5000,
};

function renderPolling(
  overrides: Partial<Parameters<typeof useWalletFundingPolling>[0]> = {}
) {
  const onCompleted = vi.fn();
  const view = renderHook(() =>
    useWalletFundingPolling({
      enabled: true,
      intentId: 'intent-1',
      merchantId: 'merchant-1',
      merchantSlug: 'test-store',
      onCompleted,
      pollIntervalMs: 1000,
      ...overrides,
    })
  );
  return { onCompleted, view };
}

describe('useWalletFundingPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not poll when disabled', () => {
    // Deterministic: fake timers prove no interval fires without depending on
    // the real scheduler (repo forbids real timers in tests).
    vi.useFakeTimers();
    try {
      getIntentMock.mockResolvedValue(BASE_INTENT);

      renderPolling({ enabled: false });

      vi.advanceTimersByTime(10_000);
      expect(getIntentMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('exposes the polled intent and fires onCompleted once when the order is paid', async () => {
    getIntentMock.mockResolvedValue({
      ...BASE_INTENT,
      fundedAmount: 5000,
      orderPaid: true,
      status: 'completed',
    });

    const { onCompleted, view } = renderPolling();

    await waitFor(() => {
      expect(view.result.current.intent?.status).toBe('completed');
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);

    // Terminal ⇒ the interval is torn down, so a manual check is a no-op.
    await act(async () => {
      view.result.current.checkNow();
    });
    expect(getIntentMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the partial transfer polling instead of stopping', async () => {
    getIntentMock.mockResolvedValue({
      ...BASE_INTENT,
      fundedAmount: 2000,
      remainingAmount: 3000,
      status: 'underfunded',
    });

    const { onCompleted, view } = renderPolling();

    await waitFor(() => {
      expect(view.result.current.intent?.status).toBe('underfunded');
    });
    expect(onCompleted).not.toHaveBeenCalled();

    await act(async () => {
      view.result.current.checkNow();
    });
    expect(getIntentMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('never reports an ambiguous transfer as completed', async () => {
    getIntentMock.mockResolvedValue({
      ...BASE_INTENT,
      status: 'review_required',
    });

    const { onCompleted, view } = renderPolling();

    await waitFor(() => {
      expect(view.result.current.intent?.status).toBe('review_required');
    });
    expect(onCompleted).not.toHaveBeenCalled();
  });

  // Regression (cross-intent completion): a manual "check now" for transfer A
  // that resolves late must NOT fire onCompleted once the customer has closed A
  // and opened transfer B — otherwise checkout would clear the cart and redirect
  // to B's success page while B is still unpaid.
  it('drops a late manual check once the customer switches to another transfer', async () => {
    getIntentMock.mockResolvedValue({ ...BASE_INTENT, status: 'pending' });

    const onCompleted = vi.fn();
    const { rerender, result } = renderHook(
      ({ intentId }) =>
        useWalletFundingPolling({
          enabled: true,
          intentId,
          merchantId: 'merchant-1',
          merchantSlug: 'test-store',
          onCompleted,
          // Effectively disable the interval so only the manual check is racing.
          pollIntervalMs: 10_000_000,
        }),
      { initialProps: { intentId: 'intent-a' } }
    );

    // Let the initial auto-poll settle so the manual check is not blocked.
    await waitFor(() => {
      expect(result.current.intent?.status).toBe('pending');
    });

    // The manual check for A is issued but its response is held in flight.
    let resolveManual: (intent: unknown) => void = () => {};
    getIntentMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveManual = resolve;
        })
    );
    act(() => {
      result.current.checkNow();
    });

    // Customer closes A and starts transfer B before A's check resolves.
    rerender({ intentId: 'intent-b' });

    // A's manual check now returns `completed` — but it belongs to the old intent.
    await act(async () => {
      resolveManual({
        ...BASE_INTENT,
        fundedAmount: 5000,
        id: 'intent-a',
        orderPaid: true,
        status: 'completed',
      });
    });

    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('surfaces a poll failure as an error without claiming payment', async () => {
    getIntentMock.mockRejectedValue(new Error('offline'));

    const { onCompleted, view } = renderPolling();

    await waitFor(() => {
      expect(view.result.current.error).toBe('offline');
    });
    expect(view.result.current.intent).toBeNull();
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
