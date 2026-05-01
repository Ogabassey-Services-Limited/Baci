const ERROR_MISSING_CORRUPTED_DVA_ACCOUNT = 'Missing or corrupted DVA account';
const ERROR_SESSION_PENDING_PAYMENT = 'Session already has pending payment';
const PAYMENT_STATUS_ACCOUNT_MISSING = 'payment_account_missing';
const PAYMENT_STATUS_PAYMENT_PENDING = 'payment_pending';

export type PaymentAccountConflictResponse =
  | {
      error: typeof ERROR_SESSION_PENDING_PAYMENT;
      order_id: string;
      status: typeof PAYMENT_STATUS_PAYMENT_PENDING;
    }
  | {
      error: typeof ERROR_MISSING_CORRUPTED_DVA_ACCOUNT;
      order_id: null;
      status: typeof PAYMENT_STATUS_ACCOUNT_MISSING;
    };

export function buildPaymentAccountConflictResponse({
  orderId,
}: {
  orderId?: string | null;
}): PaymentAccountConflictResponse {
  if (orderId) {
    return {
      error: ERROR_SESSION_PENDING_PAYMENT,
      order_id: orderId,
      status: PAYMENT_STATUS_PAYMENT_PENDING,
    };
  }

  return {
    error: ERROR_MISSING_CORRUPTED_DVA_ACCOUNT,
    order_id: null,
    status: PAYMENT_STATUS_ACCOUNT_MISSING,
  };
}
