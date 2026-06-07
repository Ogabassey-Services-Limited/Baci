type CheckoutCompletePaymentInfo = {
  intent: 'charge';
  method: 'card';
  amount: null;
  currency: 'NGN';
  description: string;
};

export const checkoutCompletePaymentInfo = {
  intent: 'charge',
  method: 'card',
  amount: null,
  currency: 'NGN',
  description:
    'Dynamic checkout total payable through Paystack payment instructions returned by this operation.',
} as const satisfies CheckoutCompletePaymentInfo;
