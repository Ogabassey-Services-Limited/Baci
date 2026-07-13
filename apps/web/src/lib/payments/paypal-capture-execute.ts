import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import type {
  PaypalCaptureOrderSnapshot,
  PaypalCaptureTransaction,
} from '@/lib/payments/load-paypal-capture-context';
import { orderNumberFallback } from '@/lib/payments/load-paypal-capture-context';
import { markPaypalTransactionRefunded } from '@/lib/payments/mark-paypal-transaction-refunded';
import type { PaypalCaptureState } from '@/lib/payments/paypal-capture-outcome';
import { validatePaypalCaptureSet } from '@/lib/payments/paypal-capture-validation';
import { initiatePaypalOrderRefund } from '@/lib/payments/paypal-order-refund';
import { resolvePaypalSettlerVerdict } from '@/lib/payments/paypal-settler-verdict';
import {
  type ReconcilePaypalOrderInput,
  reconcilePaypalOrderToPaid,
} from '@/lib/payments/reconcile-paypal-order';
import {
  getOrder,
  type PayPalMode,
  type PayPalOrderDetails,
} from '@/lib/paypal';
import type { PaymentCredentialEnvironment } from './merchant-credentials';

/**
 * Shared execution context + lower-level helpers for the PayPal capture funnel
 * (see docs/payments/paypal-capture-reconciliation-design.md §6). The route
 * builds one `PaypalCaptureContext`, resolves the outcome, and the handlers act
 * on it — no route re-derives the decision.
 */
export interface PaypalCaptureContext {
  supabase: SupabaseClient;
  merchantId: string;
  orderId: string;
  paypalOrderId: string;
  environment: PaymentCredentialEnvironment;
  mode: PayPalMode;
  credentials: { clientId: string; secretKey: string };
  transaction: PaypalCaptureTransaction;
  orderSnapshot: PaypalCaptureOrderSnapshot;
  orderTotal: number;
  lockedResidual: number;
  currentResidual: number;
  presentmentAmount?: number;
  presentmentCurrency?: string;
}

export function buildPaypalCaptureState(
  ctx: PaypalCaptureContext,
  paypalOrderStatus: PaypalCaptureState['paypalOrderStatus']
): PaypalCaptureState {
  return {
    orderPaymentStatus: ctx.orderSnapshot.payment_status,
    orderShippingStatus: ctx.orderSnapshot.shipping_status,
    txnStatus: ctx.transaction.status,
    paypalOrderStatus,
    lockedResidual: ctx.lockedResidual,
    currentResidual: ctx.currentResidual,
    // Authoritative settler signal: the reconcile CAS stamps the settling txn on
    // orders.paid_transaction_id ATOMICALLY, so this holds even if the
    // best-effort pending→completed flip or split write was lost. A NULL marker
    // yields `unknown`, which never authorizes an auto-refund (§3c row 2).
    settlerVerdict: resolvePaypalSettlerVerdict(
      ctx.orderSnapshot.paid_transaction_id,
      ctx.transaction.id
    ),
    presentmentAmount: ctx.presentmentAmount,
  };
}

export function buildReconcileInput(
  ctx: PaypalCaptureContext
): ReconcilePaypalOrderInput {
  return {
    supabase: ctx.supabase,
    merchantId: ctx.merchantId,
    orderId: ctx.orderId,
    paypalOrderId: ctx.paypalOrderId,
    transactionId: ctx.transaction.id,
    lockedResidual: ctx.lockedResidual,
    orderTotal: ctx.orderTotal,
    prepaidTender: Math.max(ctx.orderTotal - ctx.lockedResidual, 0),
    preCaptureStatus: {
      payment_status: ctx.orderSnapshot.payment_status,
      shipping_status: ctx.orderSnapshot.shipping_status,
      amount_paid: ctx.orderSnapshot.amount_paid,
    },
  };
}

export function successResponse(ctx: PaypalCaptureContext): NextResponse {
  return NextResponse.json({
    success: true,
    status: 'success',
    orderNumber:
      ctx.orderSnapshot.order_number || orderNumberFallback(ctx.orderId),
  });
}

/**
 * Resolves the stored capture gateway_response for a captured order — from a
 * live PayPal order-details fetch when we already have one, else from the local
 * transaction row — so `refundCapturedPaypalOrder` can refund every capture.
 */
async function resolveCaptureGatewayResponse(
  ctx: PaypalCaptureContext,
  remote: PayPalOrderDetails | undefined
): Promise<unknown> {
  if (remote) {
    return remote;
  }
  const { data } = await ctx.supabase
    .from('transactions')
    .select('gateway_response')
    .eq('id', ctx.transaction.id)
    .maybeSingle();
  return data?.gateway_response ?? null;
}

/**
 * Full-refunds every completed capture on a stale/mispriced captured order, and
 * marks the transaction terminal so NO later path can settle the order against
 * the money we just returned.
 *
 * The terminal stamp is what makes the refund safe to leave behind: without it a
 * refunded-but-still-`pending` row is re-fetched by a retry (PayPal reports the
 * order COMPLETED), and `settleCompletedPaypalOrder` — which does not re-run the
 * mode/validation checks that triggered the refund — would flip it to paid.
 *
 * The stamp is applied ONLY when the capture is genuinely being reversed
 * (COMPLETED, or PENDING and therefore on its way back). Stamping it after a
 * refund PayPal REFUSED would record a reversal that never happened and close the
 * door on the retry that could still heal the order, while the merchant quietly
 * keeps the money.
 */
export async function refundCapturedPaypalOrder(
  ctx: PaypalCaptureContext,
  remote: PayPalOrderDetails | undefined,
  reason: string
): Promise<{ success: boolean; pending?: boolean; error?: string }> {
  const gatewayResponse = await resolveCaptureGatewayResponse(ctx, remote);
  const result = await initiatePaypalOrderRefund({
    merchantId: ctx.merchantId,
    gatewayResponse,
    reason,
  });

  if (result.success || result.pending) {
    await markPaypalTransactionRefunded(
      ctx.supabase,
      ctx.transaction.id,
      result.pending ? `${reason} (refund PENDING at PayPal)` : reason
    );
  }

  return {
    success: result.success,
    pending: result.pending,
    error: result.error,
  };
}

/**
 * The `reconcile_completed_unpaid` / `clamp_cancelled` execution path: ensure
 * the local txn carries the real capture response (validating it against the
 * stored presentment and flipping pending→completed), then hand off to the
 * single idempotent writer.
 */
export async function settleCompletedPaypalOrder(
  ctx: PaypalCaptureContext,
  remote: PayPalOrderDetails | undefined
): Promise<NextResponse> {
  if (ctx.transaction.status !== 'completed') {
    let details = remote;
    if (!details) {
      const fetched = await getOrder(
        ctx.credentials.clientId,
        ctx.credentials.secretKey,
        ctx.paypalOrderId,
        ctx.mode
      );
      if (!fetched.success || fetched.data.status !== 'COMPLETED') {
        return NextResponse.json(
          {
            error: 'PayPal order is not in a completed state',
            code: 'PAYPAL_ORDER_NOT_APPROVABLE',
          },
          { status: 409 }
        );
      }
      details = fetched.data;
    }

    const purchaseUnits = (details.purchase_units ?? []).map((unit) => ({
      payments: { captures: unit.payments?.captures ?? [] },
    }));
    const validation = validatePaypalCaptureSet(
      { purchase_units: purchaseUnits },
      ctx.presentmentAmount ?? Number.NaN,
      ctx.presentmentCurrency
    );
    if (!validation.ok) {
      // Funds are already captured to the merchant. Refund them before failing
      // the checkout, so the buyer is not charged for an order we reject (F4).
      const refund = await refundCapturedPaypalOrder(
        ctx,
        details,
        'PayPal reported COMPLETED but the captured set failed validation; refunding'
      );
      await filePaypalCapturePersistFailureReview({
        gatewayReference: ctx.paypalOrderId,
        merchantId: ctx.merchantId,
        orderId: ctx.orderId,
        reason:
          'PayPal order reported COMPLETED but the captured set failed validation during reconcile',
        transactionId: ctx.transaction.id,
        metadata: {
          stage: 'reconcile_validation',
          reason: validation.reason,
          refundSucceeded: refund.success,
          refundError: refund.error ?? null,
        },
      });
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const { error: flipError } = await ctx.supabase
      .from('transactions')
      .update({
        status: 'completed',
        gateway_response: details as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.transaction.id)
      .eq('status', 'pending');
    if (flipError) {
      // STOP — do not settle. Marking the order paid while this txn stays
      // `pending` with no persisted capture response would leave the refund and
      // cancellation paths unable to find a completed PayPal payment (no capture
      // IDs to refund). Fail loudly and file for reconciliation instead.
      logger.error({
        message:
          'PayPal reconcile: failed to persist the completed capture; refusing to settle',
        error: flipError,
        transactionId: ctx.transaction.id,
      });
      await filePaypalCapturePersistFailureReview({
        gatewayReference: ctx.paypalOrderId,
        merchantId: ctx.merchantId,
        orderId: ctx.orderId,
        reason:
          'PayPal reported COMPLETED but persisting the captured transaction failed; order NOT settled',
        transactionId: ctx.transaction.id,
        metadata: { stage: 'reconcile_transaction_persist_failed' },
      });
      return NextResponse.json(
        {
          error: 'Failed to persist captured payment',
          code: 'CAPTURE_PERSIST_FAILED',
        },
        { status: 500 }
      );
    }
  }

  return reconcilePaypalOrderToPaid(buildReconcileInput(ctx));
}
