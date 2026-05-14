export const AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER =
  'paystack_bank_transfer' as const;
export const AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY =
  'pay_on_delivery' as const;

export type AgenticPaymentMethod =
  | typeof AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER
  | typeof AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY;

// Canonical provider names accepted by the completion endpoint.
// The Paystack provider also accepts the manifest-advertised method name
// (`paystack_bank_transfer`) as an alias and normalizes to `paystack`.
export const AGENTIC_PAYMENT_PROVIDER_PAYSTACK = 'paystack' as const;
export const AGENTIC_PAYMENT_PROVIDER_PAY_ON_DELIVERY =
  AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY;

export type AgenticPaymentProvider =
  | typeof AGENTIC_PAYMENT_PROVIDER_PAYSTACK
  | typeof AGENTIC_PAYMENT_PROVIDER_PAY_ON_DELIVERY;
