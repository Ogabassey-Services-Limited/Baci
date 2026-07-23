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

  it('does not poll when disabled', async () => {
    getIntentMock.mockResolvedValue(BASE_INTENT);

    renderPolling({ enabled: false });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(getIntentMock).not.toHaveBeenCalled();
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
