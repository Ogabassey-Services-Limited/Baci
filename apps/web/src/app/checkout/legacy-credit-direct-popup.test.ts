import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeCreditDirectPopupMarker: vi.fn(),
}));

vi.mock(
  '@/components/storefront/ogabassey/pages/checkout/credit-direct-popup-return',
  () => ({
    writeCreditDirectPopupMarker: mocks.writeCreditDirectPopupMarker,
  })
);

import { captureLegacyCreditDirectPopup } from './legacy-credit-direct-popup';

describe('captureLegacyCreditDirectPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists the signed session when the popup omits a transaction id', async () => {
    const updatePaymentReference = vi.fn();

    await expect(
      captureLegacyCreditDirectPopup({
        orderId: 'order-1',
        signedSessionId: 'session-1',
        updatePaymentReference,
      })
    ).resolves.toBeNull();

    expect(mocks.writeCreditDirectPopupMarker).toHaveBeenCalledWith(
      'order-1',
      'session-1'
    );
    expect(updatePaymentReference).not.toHaveBeenCalled();
  });

  it('persists and saves a normalized popup transaction id', async () => {
    const updatePaymentReference = vi.fn().mockResolvedValue('save failed');

    await expect(
      captureLegacyCreditDirectPopup({
        checkoutTransactionId: ' txn-1 ',
        orderId: 'order-1',
        signedSessionId: 'session-1',
        updatePaymentReference,
      })
    ).resolves.toBe('save failed');

    expect(mocks.writeCreditDirectPopupMarker).toHaveBeenCalledWith(
      'order-1',
      'txn-1'
    );
    expect(updatePaymentReference).toHaveBeenCalledWith({
      orderId: 'order-1',
      paymentRef: 'txn-1',
    });
  });

  it('returns null when the normalized popup transaction id is saved', async () => {
    const updatePaymentReference = vi.fn().mockResolvedValue(null);

    await expect(
      captureLegacyCreditDirectPopup({
        checkoutTransactionId: ' txn-1 ',
        orderId: 'order-1',
        signedSessionId: 'session-1',
        updatePaymentReference,
      })
    ).resolves.toBeNull();

    expect(mocks.writeCreditDirectPopupMarker).toHaveBeenCalledWith(
      'order-1',
      'txn-1'
    );
    expect(updatePaymentReference).toHaveBeenCalledWith({
      orderId: 'order-1',
      paymentRef: 'txn-1',
    });
  });
});
