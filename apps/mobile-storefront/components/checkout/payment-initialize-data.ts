export interface PaymentInitializeAccount {
  account_name?: string;
  account_number?: string;
  bank_name?: string;
}

export interface PaymentInitializeData {
  authorization_url?: string;
  checkout_url?: string;
  dva?: PaymentInitializeAccount;
  error?: string;
  reference?: string;
  success?: boolean;
  virtual_account?: PaymentInitializeAccount;
}

// Defensive coercion for the /api/payments/initialize response body: anything
// that is not an object collapses to {} so callers can read optional fields
// without null checks on the envelope itself.
export function toPaymentInitializeData(value: unknown): PaymentInitializeData {
  return value && typeof value === 'object'
    ? (value as PaymentInitializeData)
    : {};
}
