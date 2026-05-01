import { describe, expect, it } from 'vitest';
import { buildPaymentAccountConflictResponse } from '@/lib/agentic/checkout-payment-account-conflict';

describe('buildPaymentAccountConflictResponse', () => {
  it('returns a pending payment conflict when an order already exists', () => {
    expect(buildPaymentAccountConflictResponse({ orderId: 'order-1' })).toEqual(
      {
        error: 'Session already has pending payment',
        order_id: 'order-1',
        status: 'payment_pending',
      }
    );
  });

  it.each([
    { orderId: null },
    { orderId: undefined },
    { orderId: '' },
    {},
  ])('returns a DVA account conflict when orderId is not usable', (input) => {
    expect(buildPaymentAccountConflictResponse(input)).toEqual({
      error: 'Missing or corrupted DVA account',
      order_id: null,
      status: 'payment_account_missing',
    });
  });
});
