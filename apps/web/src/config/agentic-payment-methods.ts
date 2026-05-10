export const AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER =
  'paystack_bank_transfer' as const;
export const AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY =
  'pay_on_delivery' as const;

export type AgenticPaymentMethod =
  | typeof AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER
  | typeof AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY;
