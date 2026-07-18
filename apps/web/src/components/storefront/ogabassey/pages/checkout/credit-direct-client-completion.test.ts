import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureCreditDirectClientCompletion } from './credit-direct-client-completion';
import { readCreditDirectPopupMarker } from './credit-direct-popup-return';

describe('captureCreditDirectClientCompletion', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('stores the marker synchronously and sends untrusted completion evidence', () => {
    const fetcher = vi.fn().mockReturnValue(new Promise(() => undefined));

    const marker = captureCreditDirectClientCompletion(
      {
        orderId: 'order-1',
        checkoutTransactionId: 'cd-transaction-1',
        trackingToken: 'track-1',
      },
      fetcher
    );

    expect(marker.transactionId).toBe('cd-transaction-1');
    expect(readCreditDirectPopupMarker('order-1')?.transactionId).toBe(
      'cd-transaction-1'
    );
    expect(fetcher).toHaveBeenCalledWith(
      '/api/orders/credit-direct/client-completion',
      {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'order-1',
          checkoutTransactionId: 'cd-transaction-1',
          tracking_token: 'track-1',
        }),
      }
    );
  });

  it('retains the marker when the best-effort request rejects', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));

    try {
      captureCreditDirectClientCompletion(
        {
          orderId: 'order-1',
          checkoutTransactionId: 'cd-transaction-1',
        },
        fetcher
      );

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
      expect(readCreditDirectPopupMarker('order-1')?.transactionId).toBe(
        'cd-transaction-1'
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('labels a signed-session fallback separately from a checkout transaction', () => {
    const fetcher = vi.fn().mockReturnValue(new Promise(() => undefined));

    const marker = captureCreditDirectClientCompletion(
      {
        orderId: 'order-1',
        sessionId: 'signed-session-1',
      },
      fetcher
    );

    expect(marker.transactionId).toBe('signed-session-1');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/orders/credit-direct/client-completion',
      expect.objectContaining({
        body: JSON.stringify({
          orderId: 'order-1',
          sessionId: 'signed-session-1',
        }),
      })
    );
  });
});
