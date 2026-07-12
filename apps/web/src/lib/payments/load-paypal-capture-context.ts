import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { computeOrderResidualAmount } from '@/lib/payments/order-residual-amount';

/**
 * Pure STATE LOADER for the PayPal capture-order route (see
 * docs/payments/paypal-capture-reconciliation-design.md §6). It fetches the
 * transaction + order, performs the P0-security scoping/mismatch guards, and
 * computes `currentResidual` — then hands the raw state to
 * `resolvePaypalCaptureOutcome`. It NO LONGER decides proceed / reconcileOnly /
 * idempotent-200, and NO LONGER runs the one-sided `amount > total` check: those
 * decisions moved into the single authoritative resolver + residual-freshness
 * contract (§2/§4a).
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
  /** Pre-capture amount already settled Baci-side (mixed-tender redemption). */
  amount_paid: number | string | null;
  /** transactions.id that settled the order (atomic settler marker); null until
   * paid. Authoritative "did THIS txn settle the order" signal. */
  paid_transaction_id: string | null;
}

export type PaypalCaptureStateLoad =
  | {
      ok: true;
      transaction: PaypalCaptureTransaction;
      orderSnapshot: PaypalCaptureOrderSnapshot;
      metadata: Record<string, unknown> | null;
      /** transactions.amount — order-ccy residual the buyer approved (§2). */
      lockedResidual: number;
      /** computeOrderResidualAmount recomputed now (§2). */
      currentResidual: number;
      presentmentAmount?: number;
      presentmentCurrency?: string;
    }
  | { ok: false; status: number; body: Record<string, unknown> };

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
): Promise<PaypalCaptureStateLoad> {
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
      ok: false,
      status: 404,
      body: { error: 'Transaction not found for this reference' },
    };
  }

  if (transaction.order_id !== orderId) {
    return { ok: false, status: 400, body: { error: 'Order ID mismatch' } };
  }

  if (transaction.merchant_id !== merchantId) {
    return { ok: false, status: 400, body: { error: 'Merchant mismatch' } };
  }

  const reqEmail = customerEmail.toLowerCase();
  const metadata = transaction.metadata as Record<string, unknown> | null;

  // Only `pending` (about to capture) and `completed` (reconcile a lost order
  // write) are valid states for this route; anything else is a hard error.
  if (transaction.status !== 'pending' && transaction.status !== 'completed') {
    return {
      ok: false,
      status: 400,
      body: { error: 'Transaction is already in a non-pending state' },
    };
  }

  const txnMetaEmail = metadata?.customer_email as string | undefined;
  if (txnMetaEmail && txnMetaEmail.toLowerCase() !== reqEmail) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Customer email mismatch with transaction metadata' },
    };
  }

  const { data: orderSnapshot, error: orderFetchError } = await supabase
    .from('orders')
    .select(
      'id, merchant_id, total, currency, customer_email, order_number, shipping_status, payment_status, amount_paid, paid_transaction_id'
    )
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (orderFetchError || !orderSnapshot) {
    return { ok: false, status: 404, body: { error: 'Order not found' } };
  }

  if (
    orderSnapshot.customer_email &&
    orderSnapshot.customer_email.toLowerCase() !== reqEmail
  ) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Customer email mismatch with order record' },
    };
  }

  // Currency consistency between order and transaction is a data-integrity
  // guard (unrelated to residual freshness, which the resolver owns).
  if (orderSnapshot.currency !== transaction.currency) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Order currency mismatch with transaction' },
    };
  }

  const orderTotal = Number(orderSnapshot.total);
  const residual = await computeOrderResidualAmount(supabase, {
    orderId,
    merchantId,
    orderTotal,
  });
  if (!residual.ok) {
    return {
      ok: false,
      status: 500,
      body: {
        error: 'Unable to verify order payment amount',
        code: 'ORDER_AMOUNT_LOOKUP_FAILED',
      },
    };
  }

  const presentmentAmount = Number(metadata?.paypal_presentment_amount);
  const presentmentCurrency =
    typeof metadata?.paypal_presentment_currency === 'string'
      ? metadata.paypal_presentment_currency
      : undefined;

  return {
    ok: true,
    transaction,
    orderSnapshot,
    metadata,
    lockedResidual: Number(transaction.amount),
    currentResidual: residual.residualAmount,
    presentmentAmount: Number.isFinite(presentmentAmount)
      ? presentmentAmount
      : undefined,
    presentmentCurrency,
  };
}
