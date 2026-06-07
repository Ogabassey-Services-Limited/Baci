import { describe, expect, it } from 'vitest';
import { checkoutCompletePaymentInfo } from './mpp-checkout-payment-info';

describe('checkoutCompletePaymentInfo', () => {
  it('publishes a scanner-compatible MPP discovery object for Paystack checkout', () => {
    expect(checkoutCompletePaymentInfo).toEqual({
      intent: 'charge',
      method: 'card',
      amount: null,
      currency: 'NGN',
      description:
        'Dynamic checkout total payable through Paystack payment instructions returned by this operation.',
    });
  });
});
