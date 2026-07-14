import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { completeOrderGatewayPayment } from '@/lib/payments/complete-order-gateway-payment';
import { confirmPaidOrderInventoryOrRollback } from '@/lib/payments/confirm-paid-order-inventory';
import { fileBlockedOrderPaymentReview } from '@/lib/payments/file-blocked-order-payment-review';
import { schedulePaidOrderNotifications } from '@/lib/payments/notify-paid-order';
import { getOrderOutboxState } from '@/lib/payments/order-has-outbox-rows';
import { toRichPaidOrder } from '@/lib/payments/paid-order-normalization';
import { persistPaidOrderSideEffectRetry } from '@/lib/payments/paid-order-retry-persistence';
import { PAID_ORDER_RICH_SELECT } from '@/lib/payments/paid-order-rich-select';
import { persistPrePushRetryMarkers } from '@/lib/payments/persist-pre-push-retry-markers';
import { runPaidOrderSideEffects } from '@/lib/payments/run-paid-order-side-effects';
import { settleCapturedOrderPayment } from '@/lib/payments/settle-captured-order-payment';

export type FinalizeOrderGatewayPaymentOutcome =
  | { kind: 'completion_failed'; error: unknown }
  | { kind: 'order_cancelled'; orderNumber: string | null }
  | { kind: 'order_skipped'; paymentStatus: string | null }
  | { kind: 'order_fetch_failed'; error: unknown }
  | {
      kind: 'inventory_failed';
      payload: { code?: string; error?: string };
      status: number;
    }
  | { kind: 'inventory_cleanup_failed' }
  | { kind: 'completed'; healed: boolean; orderNumber: string | null };

export interface FinalizeOrderGatewayPaymentTransaction {
  id: string;
  order_id: string | null;
  merchant_id: string;
  amount: number | string | null;
  platform_fee: number | null;
  gateway_reference: string | null;
}

// One engine for "a gateway confirmed this order payment": webhook (first
// delivery and redelivery heal), verify, and the reconcile cron all share
// it. The flip is one atomic RPC; every follow-up step is idempotent, so
// re-running the whole function for the same payment is safe.
export async function finalizeOrderGatewayPayment({
  supabase,
  transaction,
  orderId,
  gateway,
  reference,
  gatewayResponse,
  wonTransactionFlip,
  actor,
  scheduleAfter,
}: {
  supabase: SupabaseClient;
  transaction: FinalizeOrderGatewayPaymentTransaction;
  orderId: string;
  gateway: 'paystack' | 'korapay';
  reference: string;
  gatewayResponse: Record<string, unknown>;
  // True only for the caller that flipped the transaction row itself (the
  // webhook delivery that won the `.neq('status','completed')` claim). Heal
  // and sweep callers pass false.
  wonTransactionFlip: boolean;
  actor: string;
  scheduleAfter: (task: () => Promise<void>) => void;
}): Promise<FinalizeOrderGatewayPaymentOutcome> {
  const result = await completeOrderGatewayPayment({
    actor,
    gatewayResponse,
    orderId,
    supabase,
    transactionId: transaction.id,
  });

  if (!result.ok) {
    return { error: result.error, kind: 'completion_failed' };
  }

  const completion = result.completion;
  if (completion.error_code) {
    return { error: completion, kind: 'completion_failed' };
  }

  const blockedOutcome = await fileBlockedOrderPaymentReview({
    completion,
    gateway,
    orderId,
    reference,
    transactionGatewayReference: transaction.gateway_reference,
    transactionId: transaction.id,
  });
  if (blockedOutcome) {
    return blockedOutcome;
  }

  const healed = Boolean(
    completion.already_completed && completion.order_updated
  );
  // Push has no claim-gating: it fires for the caller that transitioned the
  // order, or when the outbox holds only pre-push evidence (untouched seed /
  // fetch-failure markers) proving push was never scheduled.
  const outboxState =
    completion.order_updated || wonTransactionFlip
      ? null
      : await getOrderOutboxState(supabase, orderId);
  const shouldNotify =
    Boolean(completion.order_updated) ||
    Boolean(outboxState?.onlyUntouchedSeed);

  const { data: order, error: orderFetchError } = await supabase
    .from('orders')
    .select(PAID_ORDER_RICH_SELECT)
    .eq('id', orderId)
    .single();

  if (orderFetchError || !order) {
    // Order IS paid, side effects have not run: persist pre-push markers so
    // the cron drain finds it even after redeliveries are exhausted (the
    // wedge sweep only scans NOT-paid orders).
    if (wonTransactionFlip || completion.order_updated) {
      await persistPrePushRetryMarkers({
        error: orderFetchError,
        logMessage: 'Paid order fetch failed after atomic completion',
        orderId,
        reference,
        supabase,
        transactionId: transaction.id,
      });
    }
    return { error: orderFetchError, kind: 'order_fetch_failed' };
  }

  const inventoryOutcome = await confirmPaidOrderInventoryOrRollback({
    gateway,
    merchantId: transaction.merchant_id,
    orderId,
    orderWasUpdatedByThisCall: Boolean(completion.order_updated),
    previousPaymentStatus: completion.previous_payment_status,
    previousShippingStatus: completion.previous_shipping_status,
    reference,
    supabase,
    transactionGatewayReference: transaction.gateway_reference,
    transactionId: transaction.id,
  });
  if (inventoryOutcome.kind !== 'confirmed') {
    return inventoryOutcome;
  }

  let richOrder: ReturnType<typeof toRichPaidOrder>;
  try {
    richOrder = toRichPaidOrder(order, {
      merchantId: transaction.merchant_id,
    });
  } catch (normalizationError) {
    // Same recovery contract as a failed fetch.
    if (wonTransactionFlip || completion.order_updated) {
      await persistPrePushRetryMarkers({
        error: normalizationError,
        logMessage: 'Paid order payload failed normalization after completion',
        orderId,
        reference,
        supabase,
        transactionId: transaction.id,
      });
    }
    return { error: normalizationError, kind: 'order_fetch_failed' };
  }

  if (shouldNotify) {
    schedulePaidOrderNotifications({
      merchantId: transaction.merchant_id,
      richOrder,
      scheduleAfter,
    });
  }

  // A pure replay requires the TRANSACTION to have been completed by an
  // earlier call too: a fresh capture (verify flipping a pending transaction
  // for an order that was already paid manually/concurrently) must still
  // drain, or the captured gateway funds would never settle.
  // This call captured the funds: it flipped the transaction inside the RPC,
  // or (webhook first delivery) in the outer CAS just before it.
  const freshCapture = wonTransactionFlip || !completion.already_completed;
  const isPureReplay =
    !freshCapture &&
    Boolean(completion.order_already_paid) &&
    !completion.order_updated;
  if (isPureReplay && outboxState !== null && !outboxState.hasRows) {
    // Exact legacy marker: the atomic RPC seeds an outbox row in the same
    // transaction as every order flip, so an EMPTY outbox can only mean the
    // order was completed by the pre-outbox inline path — its email and
    // settlement already went out, and draining would duplicate them.
    logger.info({
      message:
        'Skipping side-effect drain for pure replay with no outbox history',
      orderId,
      reference,
    });
    return {
      healed,
      kind: 'completed',
      orderNumber: completion.order_number ?? null,
    };
  }

  // A fresh capture on an already-paid order owes ONLY settlement: the
  // customer was already confirmed for the payment that flipped the order.
  const settlementOnly =
    freshCapture &&
    Boolean(completion.order_already_paid) &&
    !completion.order_updated;

  // Fresh pre-push evidence means the transitioning caller may still be
  // running: draining now would consume it and suppress push forever.
  if (!shouldNotify && outboxState?.onlyFreshPrePushEvidence) {
    logger.info({
      message: 'Deferring side-effect drain while pre-push evidence is fresh',
      orderId,
      reference,
    });
    return {
      healed,
      kind: 'completed',
      orderNumber: completion.order_number ?? null,
    };
  }

  const sideEffectArgs = {
    actor,
    externalGatewayReference: reference,
    gatewayResponse,
    order: richOrder,
    scheduleAfter,
    settlementGateway: gateway,
    supabase,
    transaction: {
      amount: transaction.amount,
      gateway_reference: transaction.gateway_reference ?? null,
      id: transaction.id,
      merchant_id: transaction.merchant_id,
      order_id: richOrder.id,
      platform_fee: transaction.platform_fee,
    },
  };

  try {
    if (settlementOnly) {
      // Bypass the outbox: it is keyed on (order_id, step), so the earlier
      // payment's completed merchant_settlement row would make this claim
      // lose and these captured funds would never settle. The settlement RPC
      // is idempotent on this transaction's own gateway_reference.
      await settleCapturedOrderPayment(sideEffectArgs);
      logger.info({
        message: 'Settled a gateway capture on an order already paid elsewhere',
        orderId: richOrder.id,
        reference,
      });
      return {
        healed,
        kind: 'completed',
        orderNumber: completion.order_number ?? null,
      };
    }

    const sideEffectsResult = await runPaidOrderSideEffects(sideEffectArgs);
    logger.info({
      concurrentTakeoverSteps: sideEffectsResult.concurrentTakeoverSteps,
      failedSteps: sideEffectsResult.failedSteps,
      message: 'payment_side_effects executed',
      orderId: richOrder.id,
      ranSteps: sideEffectsResult.ranSteps,
      reference,
      skippedSteps: sideEffectsResult.skippedSteps,
    });
  } catch (sideEffectError) {
    // Mirror of the webhook's historical semantics: persist a retry marker;
    // only rethrow when even that persistence fails.
    await persistPaidOrderSideEffectRetry({
      error: sideEffectError,
      orderId: richOrder.id,
      reference,
      supabase,
      transaction: { id: transaction.id },
    });
    logger.error({
      error:
        sideEffectError instanceof Error
          ? { message: sideEffectError.message, stack: sideEffectError.stack }
          : sideEffectError,
      message: 'Paid order side effects failed after payment completion',
      orderId: richOrder.id,
      reference,
      transactionId: transaction.id,
    });
  }

  return {
    healed,
    kind: 'completed',
    orderNumber: completion.order_number ?? null,
  };
}
