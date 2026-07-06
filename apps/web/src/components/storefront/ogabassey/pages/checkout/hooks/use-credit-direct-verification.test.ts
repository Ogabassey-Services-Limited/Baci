import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreditDirectVerification } from './use-credit-direct-verification';

const fetchMock = vi.fn();

function orderResponse(paymentStatus: string | null) {
  return {
    ok: true,
    json: async () => ({ payment_status: paymentStatus }),
  };
}

const baseOptions = {
  active: true,
  orderId: 'order-1',
  merchantSlug: 'test-store',
  trackingToken: 'tok-123',
  lookupEmail: null,
  pollIntervalMs: 10,
  timeoutMs: 45,
};

describe('useCreditDirectVerification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('stays idle while inactive', () => {
    const { result } = renderHook(() =>
      useCreditDirectVerification({ ...baseOptions, active: false }),
    );

    expect(result.current.phase).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls the order endpoint with the tracking token and email lookup', async () => {
    fetchMock.mockResolvedValue(orderResponse('bnpl_pending'));

    renderHook(() =>
      useCreditDirectVerification({
        ...baseOptions,
        lookupEmail: 'customer@example.com',
      }),
    );
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/storefront/orders/order-1?merchant_slug=test-store&token=tok-123&email=customer%40example.com',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('confirms once the payment status flips to bnpl_approved', async () => {
    fetchMock
      .mockResolvedValueOnce(orderResponse('bnpl_pending'))
      .mockResolvedValueOnce(orderResponse('bnpl_approved'));

    const { result } = renderHook(() =>
      useCreditDirectVerification(baseOptions),
    );
    await act(async () => {});
    expect(result.current.phase).toBe('polling');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.phase).toBe('confirmed');
  });

  it('confirms when the payment status is already paid', async () => {
    fetchMock.mockResolvedValue(orderResponse('paid'));

    const { result } = renderHook(() =>
      useCreditDirectVerification(baseOptions),
    );
    await act(async () => {});

    expect(result.current.phase).toBe('confirmed');
  });

  it('reports cancellation when the order was cancelled', async () => {
    fetchMock.mockResolvedValue(orderResponse('cancelled'));

    const { result } = renderHook(() =>
      useCreditDirectVerification(baseOptions),
    );
    await act(async () => {});

    expect(result.current.phase).toBe('cancelled');
  });

  it('keeps polling through transient fetch failures', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(orderResponse('bnpl_approved'));

    const { result } = renderHook(() =>
      useCreditDirectVerification(baseOptions),
    );
    await act(async () => {});
    expect(result.current.phase).toBe('polling');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.phase).toBe('confirmed');
  });

  it('times out after the deadline when the status never resolves', async () => {
    fetchMock.mockResolvedValue(orderResponse('bnpl_pending'));

    const { result } = renderHook(() =>
      useCreditDirectVerification(baseOptions),
    );
    await act(async () => {});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(result.current.phase).toBe('timeout');
  });

  it('restart resumes polling after a timeout', async () => {
    fetchMock.mockResolvedValue(orderResponse('bnpl_pending'));

    const { result } = renderHook(() =>
      useCreditDirectVerification(baseOptions),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(result.current.phase).toBe('timeout');

    fetchMock.mockResolvedValue(orderResponse('bnpl_approved'));
    await act(async () => {
      result.current.restart();
    });
    await act(async () => {});

    expect(result.current.phase).toBe('confirmed');
  });
});
