import { logger } from '@/lib/logger';
import { handlePaymentForCancelledOrder } from '@/lib/payments/handle-payment-for-cancelled-order';
import type { OrderGatewayPaymentCompletion } from '@/schemas/order-gateway-payment-completion';

export type BlockedOrderPaymentOutcome =
  | { kind: 'order_cancelled'; orderNumber: string | null }
  | { kind: 'order_skipped'; paymentStatus: string | null };

// Files the durable reconciliation_review row for a gateway payment that
// landed on an order the finalizer refuses to flip (cancelled or refunded).
// Returns the outcome for the caller to map, or null when the order is fine.
export async function fileBlockedOrderPaymentReview({
  completion,
  gateway,
  orderId,
  reference,
  transactionGatewayReference,
  transactionId,
}: {
  completion: OrderGatewayPaymentCompletion;
  gateway: string;
  orderId: string;
  reference: string;
  transactionGatewayReference: string | null;
  transactionId: string;
}): Promise<BlockedOrderPaymentOutcome | null> {
  if (completion.order_cancelled) {
    await handlePaymentForCancelledOrder({
      gatewayReference: transactionGatewayReference ?? reference,
      order: {
        cancelled_at: completion.cancelled_at ?? null,
        id: orderId,
        shipping_status: completion.shipping_status ?? null,
      },
      reason: `Gateway ${gateway} payment captured for an order cancelled before finalization`,
      transactionId,
    });
    return {
      kind: 'order_cancelled',
      orderNumber: completion.order_number ?? null,
    };
  }

  if (completion.order_skipped_status) {
    logger.error({
      message:
        'Gateway payment completed for an order whose status blocks a paid flip; manual review required',
      orderId,
      paymentStatus: completion.order_skipped_status,
      reference,
    });
    // Durable audit trail, mirroring the cancelled branch: money was captured
    // for an order we refuse to resurrect, so ops must see it in
    // reconciliation_review, not only in logs.
    await handlePaymentForCancelledOrder({
      gatewayReference: transactionGatewayReference ?? reference,
      issueType: 'payment_received_after_refund',
      order: { id: orderId },
      reason: `Gateway ${gateway} payment captured for an order already ${completion.order_skipped_status}`,
      transactionId,
    });
    return {
      kind: 'order_skipped',
      paymentStatus: completion.order_skipped_status,
    };
  }

  return null;
}
