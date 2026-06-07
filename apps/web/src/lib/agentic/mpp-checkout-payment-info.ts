export const checkoutCompletePaymentInfo = {
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
};
