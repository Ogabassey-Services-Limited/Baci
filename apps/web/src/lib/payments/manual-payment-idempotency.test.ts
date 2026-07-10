import { describe, expect, it } from 'vitest';
import { createLegacyManualPaymentIdempotencyKey } from './manual-payment-idempotency';

const payment = {
  amount: 5000,
  merchantId: 'merchant-1',
  notes: 'Counter payment',
  orderId: 'order-1',
  paymentMethod: 'cash',
  reference: 'REF-1',
  userId: 'user-1',
};

describe('createLegacyManualPaymentIdempotencyKey', () => {
  it('returns the same bounded key for the same logical payment', () => {
    const first = createLegacyManualPaymentIdempotencyKey(payment);
    const retry = createLegacyManualPaymentIdempotencyKey({ ...payment });

    expect(retry).toBe(first);
    expect(first).toMatch(/^legacy:[0-9a-f]{64}$/);
    expect(first.length).toBeLessThanOrEqual(128);
  });

  it('changes when payment identity changes', () => {
    expect(
      createLegacyManualPaymentIdempotencyKey({ ...payment, amount: 6000 })
    ).not.toBe(createLegacyManualPaymentIdempotencyKey(payment));
    expect(
      createLegacyManualPaymentIdempotencyKey({
        ...payment,
        reference: 'REF-2',
      })
    ).not.toBe(createLegacyManualPaymentIdempotencyKey(payment));
  });
});
