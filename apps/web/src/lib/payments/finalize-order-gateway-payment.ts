import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { completeOrderGatewayPayment } from '@/lib/payments/complete-order-gateway-payment';
import { confirmPaidOrderInventoryOrRollback } from '@/lib/payments/confirm-paid-order-inventory';
import {
  type BlockedOrderPaymentOutcome,
  fileBlockedOrderPaymentReview,
} from '@/lib/payments/file-blocked-order-payment-review';
import { fileSettlementCaptureFailureReview } from '@/lib/payments/file-settlement-capture-failure-review';
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
  | BlockedOrderPaymentOutcome
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
  gateway: 'juicyway' | 'paystack' | 'korapay';
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
  const outboxState = completion.order_updated
    ? null
    : await getOrderOutboxState(supabase, orderId);
  if (
    completion.order_already_paid &&
    !completion.order_updated &&
    outboxState?.lookupFailed
  ) {
    return {
      error: new Error('payment_side_effects_lookup_failed'),
      kind: 'completion_failed',
    };
  }
  const capturedOnAlreadyPaidOrder =
    Boolean(completion.order_already_paid) &&
    !completion.order_updated &&
    (wonTransactionFlip ||
      (Boolean(outboxState?.hasRows) &&
        outboxState?.payerTransactionId !== transaction.id));
  const legacyPaidReplay =
    Boolean(completion.order_already_paid) &&
    !completion.order_updated &&
    !wonTransactionFlip &&
    outboxState?.hasRows === false;

  const shouldNotify =
    Boolean(completion.order_updated) ||
    (!capturedOnAlreadyPaidOrder && Boolean(outboxState?.onlyUntouchedSeed));

  const { data: order, error: orderFetchError } = await supabase
    .from('orders')
    .select(PAID_ORDER_RICH_SELECT)
    .eq('id', orderId)
    .single();

  if (orderFetchError || !order) {
    // Order IS paid, side effects have not run: persist pre-push markers so
    // the cron drain finds it even after redeliveries are exhausted (the
    // wedge sweep only scans NOT-paid orders).
    if (capturedOnAlreadyPaidOrder) {
      await fileSettlementCaptureFailureReview({
        error: orderFetchError,
        gateway,
        orderId,
        reference: transaction.gateway_reference ?? reference,
        transactionId: transaction.id,
      });
    } else if (wonTransactionFlip || completion.order_updated) {
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

  let richOrder: ReturnType<typeof toRichPaidOrder>;
  try {
    richOrder = toRichPaidOrder(order, {
      merchantId: transaction.merchant_id,
    });
  } catch (normalizationError) {
    // Same recovery contract as a failed fetch.
    if (capturedOnAlreadyPaidOrder) {
      await fileSettlementCaptureFailureReview({
        error: normalizationError,
        gateway,
        orderId,
        reference: transaction.gateway_reference ?? reference,
        transactionId: transaction.id,
      });
    } else if (wonTransactionFlip || completion.order_updated) {
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

  if (!capturedOnAlreadyPaidOrder) {
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
  }

  // Pre-outbox completions may still owe serialized inventory confirmation,
  // but their email and settlement ran inline. Confirm inventory, then stop
  // before the modern side-effect drain to avoid duplicating those effects.
  if (legacyPaidReplay) {
    return {
      healed,
      kind: 'completed',
      orderNumber: completion.order_number ?? null,
    };
  }

  if (shouldNotify) {
    schedulePaidOrderNotifications({
      merchantId: transaction.merchant_id,
      richOrder,
      scheduleAfter,
    });
  }

  if (
    !capturedOnAlreadyPaidOrder &&
    !shouldNotify &&
    outboxState?.onlyFreshPrePushEvidence
  ) {
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
    if (capturedOnAlreadyPaidOrder) {
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
    if (capturedOnAlreadyPaidOrder) {
      await fileSettlementCaptureFailureReview({
        error: sideEffectError,
        gateway,
        orderId: richOrder.id,
        reference: transaction.gateway_reference ?? reference,
        transactionId: transaction.id,
      });
      logger.error({
        error: sideEffectError,
        message: 'Settlement-only capture failed and was filed for review',
        orderId: richOrder.id,
        reference,
        transactionId: transaction.id,
      });
      return { error: sideEffectError, kind: 'completion_failed' };
    }

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
