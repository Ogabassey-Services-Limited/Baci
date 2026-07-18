import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchWithCsrf: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mocks.fetchWithCsrf,
}));

import { captureCreditDirectClientCompletion } from './credit-direct-client-completion';
import { readCreditDirectPopupMarker } from './credit-direct-popup-return';

describe('captureCreditDirectClientCompletion', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.fetchWithCsrf.mockReset();
    mocks.fetchWithCsrf.mockReturnValue(new Promise(() => undefined));
  });

  it('stores the marker synchronously and sends evidence through the CSRF-aware fetcher', () => {
    const marker = captureCreditDirectClientCompletion(
      {
        orderId: 'order-1',
        checkoutTransactionId: 'cd-transaction-1',
        customerEmail: 'customer@example.com',
        trackingToken: 'track-1',
      }
    );

    expect(marker.source).toBe('sdk_success');
    expect(marker.transactionId).toBe('cd-transaction-1');
    expect(readCreditDirectPopupMarker('order-1')).toMatchObject({
      source: 'sdk_success',
      transactionId: 'cd-transaction-1',
    });
    expect(mocks.fetchWithCsrf).toHaveBeenCalledWith(
      '/api/orders/credit-direct/client-completion',
      {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'order-1',
          checkoutTransactionId: 'cd-transaction-1',
          customerEmail: 'customer@example.com',
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

  it('returns the SDK marker when storage keeps popup provenance', () => {
    window.sessionStorage.setItem(
      'baci_credit_direct_popup:order-1',
      JSON.stringify({
        source: 'popup',
        storedAt: '2026-07-18T12:00:00.000Z',
        transactionId: 'new-sdk-reference',
      })
    );
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage unavailable');
      });

    try {
      const marker = captureCreditDirectClientCompletion({
        orderId: 'order-1',
        checkoutTransactionId: 'new-sdk-reference',
      });

      expect(marker).toMatchObject({
        source: 'sdk_success',
        transactionId: 'new-sdk-reference',
      });
    } finally {
      setItemSpy.mockRestore();
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
