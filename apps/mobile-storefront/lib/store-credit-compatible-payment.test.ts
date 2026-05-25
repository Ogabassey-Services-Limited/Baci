import {
  isStoreCreditCompatiblePayment,
  type StoreCreditPaymentMethod,
  type StoreCreditPaymentTab,
} from './store-credit-compatible-payment';

describe('isStoreCreditCompatiblePayment', () => {
  it.each(['paystack', 'korapay', 'bank_transfer'] as const)(
    'allows %s full-payment settlement',
    (selectedPayment) => {
      expect(
        isStoreCreditCompatiblePayment({
          paymentTab: 'full',
          selectedPayment,
        })
      ).toBe(true);
    }
  );

  it('rejects delayed, installment, and unsupported payment paths', () => {
    expect(
      isStoreCreditCompatiblePayment({
        paymentTab: 'installments',
        selectedPayment: 'paystack',
      })
    ).toBe(false);
    expect(
      isStoreCreditCompatiblePayment({
        paymentTab: 'full',
        selectedPayment: 'pay_on_delivery',
      })
    ).toBe(false);
  });

  it.each([
    { paymentTab: null, selectedPayment: 'paystack' },
    { paymentTab: undefined, selectedPayment: 'paystack' },
    { paymentTab: '', selectedPayment: 'paystack' },
    { paymentTab: 'delayed', selectedPayment: 'paystack' },
    { paymentTab: 'full', selectedPayment: null },
    { paymentTab: 'full', selectedPayment: undefined },
    { paymentTab: 'full', selectedPayment: '' },
    { paymentTab: 'full', selectedPayment: 'PAYSTACK' },
    { paymentTab: 'full', selectedPayment: 'crypto' },
    { paymentTab: 'full', selectedPayment: 'cheque' },
  ])(
    'rejects invalid runtime input %#',
    ({ paymentTab, selectedPayment }) => {
      expect(
        isStoreCreditCompatiblePayment({
          paymentTab: paymentTab as StoreCreditPaymentTab,
          selectedPayment: selectedPayment as StoreCreditPaymentMethod,
        })
      ).toBe(false);
    }
  );
});
