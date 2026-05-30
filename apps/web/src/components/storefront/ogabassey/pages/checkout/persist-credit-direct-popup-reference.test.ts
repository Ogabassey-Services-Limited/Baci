import { describe, expect, it, vi } from 'vitest';
import { persistCreditDirectPopupReference } from './persist-credit-direct-popup-reference';

describe('persistCreditDirectPopupReference', () => {
  it('persists the Credit Direct popup transaction reference', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    await persistCreditDirectPopupReference(
      { id: 'order-1', tracking_token: 'track-1' },
      'cd-popup-transaction-1',
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledWith('/api/orders/update-payment-ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'order-1',
        paymentRef: 'cd-popup-transaction-1',
        gateway: 'credit_direct',
        tracking_token: 'track-1',
      }),
    });
  });

  it('throws with order and transaction context on non-ok responses', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'write failed',
    });

    await expect(
      persistCreditDirectPopupReference(
        { id: 'order-1' },
        'cd-popup-transaction-1',
        fetcher,
      ),
    ).rejects.toThrow(
      'Failed to persist Credit Direct popup reference for order order-1 and transaction cd-popup-transaction-1: 500 Server Error: write failed',
    );
  });
});
