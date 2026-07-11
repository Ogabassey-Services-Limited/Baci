import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Pre-capture context loader for the PayPal capture-order route (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2). Performs every
 * transaction/order fetch and mismatch check ported from the prototype
 * (P0-security scoping: gateway + reference + order + merchant), returning
 * either the validated context or a ready-to-send `{ status, body }` so the
 * route stays under the 300-line cap. The already-completed case is returned
 * here as an idempotent 200 success.
 */

export interface PaypalCaptureTransaction {
  id: string;
  order_id: string;
  merchant_id: string;
  amount: number;
  currency: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  platform_fee: number | null;
}

export interface PaypalCaptureOrderSnapshot {
  id: string;
  merchant_id: string;
  total: number;
  currency: string | null;
  customer_email: string | null;
  order_number: string | null;
  shipping_status: string | null;
  payment_status: string | null;
  /**
   * Pre-capture amount already settled Baci-side (mixed-tender redemption).
   * Carried so the finalizer can restore it if an inventory rollback undoes the
   * paid transition (F-58).
   */
  amount_paid: number | string | null;
}

export type PaypalCaptureContext =
  | {
      proceed: true;
      /**
       * True when the transaction is already `completed` but the order never
       * advanced to `paid` (a prior capture's order write failed). The route
       * must skip the PayPal capture call and reconcile the order only.
       */
      reconcileOnly: boolean;
      transaction: PaypalCaptureTransaction;
      orderSnapshot: PaypalCaptureOrderSnapshot;
      metadata: Record<string, unknown> | null;
    }
  | { proceed: false; status: number; body: Record<string, unknown> };

export function orderNumberFallback(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

export async function loadPaypalCaptureContext(
  supabase: SupabaseClient,
  input: {
    orderId: string;
    paypalOrderId: string;
    merchantId: string;
    customerEmail: string;
  }
): Promise<PaypalCaptureContext> {
  const { orderId, paypalOrderId, merchantId, customerEmail } = input;

  const { data: transaction, error: txnFetchError } = await supabase
    .from('transactions')
    .select(
      'id, order_id, merchant_id, amount, currency, status, metadata, platform_fee'
    )
    .eq('gateway', 'paypal')
    .eq('gateway_reference', paypalOrderId)
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (txnFetchError || !transaction) {
    logger.error({
      message: 'PayPal capture failed: transaction not found',
      paypalOrderId,
      error: txnFetchError,
    });
    return {
      proceed: false,
      status: 404,
      body: { error: 'Transaction not found for this reference' },
    };
  }

  if (transaction.order_id !== orderId) {
    return {
      proceed: false,
      status: 400,
      body: { error: 'Order ID mismatch' },
    };
  }

  if (transaction.merchant_id !== merchantId) {
    return {
      proceed: false,
      status: 400,
      body: { error: 'Merchant mismatch' },
    };
  }

  const reqEmail = customerEmail.toLowerCase();
  const metadata = transaction.metadata as Record<string, unknown> | null;

  // When a first capture flipped `transactions.status` to 'completed' but its
  // order write failed, a retry lands here. Only treat the capture as an
  // idempotent success once the order is actually `paid`; otherwise fall
  // through with `reconcileOnly` so the route repairs the failed order write
  // instead of sending the customer to success on an unpaid order. Mirrors
  // /api/payments/verify's completed-transaction fall-through.
  let reconcileOnly = false;
  if (transaction.status !== 'pending') {
    if (transaction.status === 'completed') {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('order_number, payment_status')
        .eq('id', orderId)
        .eq('merchant_id', merchantId)
        .maybeSingle();
      if (existingOrder?.payment_status === 'paid') {
        return {
          proceed: false,
          status: 200,
          body: {
            success: true,
            status: 'success',
            orderNumber:
              existingOrder.order_number || orderNumberFallback(orderId),
          },
        };
      }
      reconcileOnly = true;
    } else {
      return {
        proceed: false,
        status: 400,
        body: { error: 'Transaction is already in a non-pending state' },
      };
    }
  }

  const txnMetaEmail = metadata?.customer_email as string | undefined;
  if (txnMetaEmail && txnMetaEmail.toLowerCase() !== reqEmail) {
    return {
      proceed: false,
      status: 400,
      body: { error: 'Customer email mismatch with transaction metadata' },
    };
  }

  const { data: orderSnapshot, error: orderFetchError } = await supabase
    .from('orders')
    .select(
      'id, merchant_id, total, currency, customer_email, order_number, shipping_status, payment_status, amount_paid'
    )
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (orderFetchError || !orderSnapshot) {
    return { proceed: false, status: 404, body: { error: 'Order not found' } };
  }

  if (
    orderSnapshot.customer_email &&
    orderSnapshot.customer_email.toLowerCase() !== reqEmail
  ) {
    return {
      proceed: false,
      status: 400,
      body: { error: 'Customer email mismatch with order record' },
    };
  }

  // The transaction amount is what PayPal was asked to charge (the gateway
  // residual). For a mixed-tender order (wallet credit / redeemed savings) that
  // is legitimately LESS than the order total, so only reject an OVER-charge or
  // a currency drift here — the exact captured amount is validated downstream
  // against the stored presentment metadata.
  if (
    Number(transaction.amount) > Number(orderSnapshot.total) ||
    orderSnapshot.currency !== transaction.currency
  ) {
    return {
      proceed: false,
      status: 400,
      body: { error: 'Order amount or currency mismatch with transaction' },
    };
  }

  return { proceed: true, reconcileOnly, transaction, orderSnapshot, metadata };
}
