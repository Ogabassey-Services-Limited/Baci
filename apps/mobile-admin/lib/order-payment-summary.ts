import type { PaymentStatus } from '@baci/shared';

const RECONCILABLE_PAYMENT_STATUSES = new Set<PaymentStatus>([
  'unpaid',
  'pending',
  'partially_paid',
]);

interface OrderPaymentSummaryInput {
  orderTotal: number;
  paymentStatus: PaymentStatus;
  storedAmountPaid: number;
  transactionTotal: number;
  walletAmountUsed: number;
}

export function getEffectiveOrderPaymentSummary({
  orderTotal,
  paymentStatus,
  storedAmountPaid,
  transactionTotal,
  walletAmountUsed,
}: OrderPaymentSummaryInput) {
  const ledgerAmountPaid = transactionTotal + walletAmountUsed;
  const amountPaid = Math.max(
    ledgerAmountPaid,
    storedAmountPaid,
    paymentStatus === 'paid' ? orderTotal : 0
  );
  const effectivePaymentStatus: PaymentStatus =
    paymentStatus === 'paid' ||
    (RECONCILABLE_PAYMENT_STATUSES.has(paymentStatus) &&
      orderTotal > 0 &&
      amountPaid >= orderTotal)
      ? 'paid'
      : paymentStatus;

  return {
    amountPaid,
    balance:
      effectivePaymentStatus === 'paid'
        ? 0
        : Math.max(0, orderTotal - amountPaid),
    paymentStatus: effectivePaymentStatus,
  };
}
