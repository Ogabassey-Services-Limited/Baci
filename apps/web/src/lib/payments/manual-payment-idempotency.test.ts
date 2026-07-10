import { describe, expect, it } from 'vitest';
import { createLegacyManualPaymentFingerprint } from './manual-payment-idempotency';

const payment = {
  amount: 5000,
  merchantId: 'merchant-1',
  notes: 'Counter payment',
  orderId: 'order-1',
  paymentMethod: 'cash',
  reference: 'REF-1',
  userId: 'user-1',
};

describe('createLegacyManualPaymentFingerprint', () => {
  it('returns the same bounded fingerprint for the same logical payment', () => {
    const first = createLegacyManualPaymentFingerprint(payment);
    const retry = createLegacyManualPaymentFingerprint({ ...payment });

    expect(retry).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when payment identity changes', () => {
    const changes = [
      { amount: 6000 },
      { merchantId: 'merchant-2' },
      { notes: 'Different note' },
      { orderId: 'order-2' },
      { paymentMethod: 'bank_transfer' },
      { reference: 'REF-2' },
      { userId: 'user-2' },
    ];

    for (const change of changes) {
      expect(
        createLegacyManualPaymentFingerprint({ ...payment, ...change })
      ).not.toBe(createLegacyManualPaymentFingerprint(payment));
    }
  });
});
