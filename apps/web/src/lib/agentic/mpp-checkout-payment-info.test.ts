import { describe, expect, it } from 'vitest';
import { checkoutCompletePaymentInfo } from './mpp-checkout-payment-info';

describe('checkoutCompletePaymentInfo', () => {
  it('publishes a multi-offer MPP discovery object for Paystack bank transfer', () => {
    expect(checkoutCompletePaymentInfo).toEqual({
      offers: [
        {
          intent: 'charge',
          method: 'paystack_bank_transfer',
          amount: null,
          currency: 'NGN',
          description:
            'Dynamic checkout total payable through the Paystack dedicated virtual account returned by this operation.',
        },
      ],
    });
  });
});
