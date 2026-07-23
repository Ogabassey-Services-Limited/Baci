import { handlePaymentForCancelledOrder } from '@/lib/payments/handle-payment-for-cancelled-order';

export function fileSettlementCaptureFailureReview({
  error,
  gateway,
  orderId,
  reference,
  transactionId,
}: {
  error: unknown;
  gateway: string;
  orderId: string;
  reference: string;
  transactionId: string;
}): Promise<boolean> {
  const detail = error instanceof Error ? error.message : String(error);
  return handlePaymentForCancelledOrder({
    gatewayReference: reference,
    issueType: 'merchant_settlement_failed',
    order: { id: orderId },
    reason: `Gateway ${gateway} capture on an already-paid order could not be settled: ${detail}`,
    transactionId,
  });
}
