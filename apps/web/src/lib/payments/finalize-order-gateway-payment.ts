import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { completeOrderGatewayPayment } from '@/lib/payments/complete-order-gateway-payment';
import {
  ensurePaidOrderInventoryConfirmed,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
} from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import { fileBlockedOrderPaymentReview } from '@/lib/payments/file-blocked-order-payment-review';
import { fileInventoryConfirmationFailureReview } from '@/lib/payments/file-inventory-confirmation-review';
import { buildInventoryConfirmationFailurePayload } from '@/lib/payments/inventory-confirmation-response';
import { schedulePaidOrderNotifications } from '@/lib/payments/notify-paid-order';
import { getOrderOutboxState } from '@/lib/payments/order-has-outbox-rows';
import { toRichPaidOrder } from '@/lib/payments/paid-order-normalization';
import { persistPaidOrderSideEffectRetry } from '@/lib/payments/paid-order-retry-persistence';
import { PAID_ORDER_RICH_SELECT } from '@/lib/payments/paid-order-rich-select';
import { runPaidOrderSideEffects } from '@/lib/payments/run-paid-order-side-effects';

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

// One engine for "a gateway confirmed this order payment — make our records
// reflect it". Used by the Paystack/Korapay webhook (first delivery AND the
// already-processed redelivery heal) and by the reconcile-gateway-paid-orders
// cron sweep. The order/transaction flip itself is a single atomic RPC; the
// follow-up steps (inventory, push, side-effects outbox) are individually
// idempotent, so re-running this whole function for the same payment is safe.
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
  // Push notifications have no claim-gating (unlike the outbox). They fire
  // for the caller that transitioned the order (the RPC's advisory lock
  // makes that exactly one caller), OR when the outbox still holds nothing
  // but the RPC's untouched seed row — evidence that the transitioning
  // caller crashed before ever scheduling push, so it was never sent.
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
    // The order IS paid at this point but no side effects have run. Persist
    // failed outbox rows so the reconcile cron's side-effect drain can find
    // this order even after gateway redeliveries are exhausted (the wedge
    // sweep itself only scans NOT-paid orders and would never see it).
    if (wonTransactionFlip || completion.order_updated) {
      try {
        await persistPaidOrderSideEffectRetry({
          error: orderFetchError,
          orderId,
          reference,
          supabase,
          transaction: { id: transaction.id },
        });
      } catch (persistError) {
        logger.error({
          error: persistError,
          message:
            'Failed to persist side-effect retry markers after paid-order fetch failure',
          orderId,
        });
      }
    }
    return { error: orderFetchError, kind: 'order_fetch_failed' };
  }

  try {
    await ensurePaidOrderInventoryConfirmed(
      supabase,
      transaction.merchant_id,
      orderId
    );
  } catch (inventoryError) {
    logger.error({
      error: inventoryError,
      message: 'Failed to confirm inventory for paid order',
      orderId,
    });

    if (completion.order_updated) {
      try {
        await rollbackOrderStatusAfterInventoryConfirmationFailure(
          supabase,
          transaction.merchant_id,
          orderId,
          {
            payment_status: completion.previous_payment_status ?? 'pending',
            shipping_status: completion.previous_shipping_status ?? 'pending',
          }
        );
      } catch (rollbackError) {
        await fileInventoryConfirmationFailureReview({
          gatewayReference: transaction.gateway_reference ?? reference,
          merchantId: transaction.merchant_id,
          metadata: {
            gateway,
            inventoryError:
              inventoryError instanceof Error
                ? inventoryError.message
                : inventoryError,
            rollbackError:
              rollbackError instanceof Error
                ? rollbackError.message
                : rollbackError,
            source: 'gateway_payment_finalizer_inventory_rollback',
          },
          orderId,
          reason:
            'Gateway payment reached paid state, but serialized inventory confirmation and status rollback both failed.',
          transactionId: transaction.id,
        });
        return { kind: 'inventory_cleanup_failed' };
      }
    }

    const payload = buildInventoryConfirmationFailurePayload(inventoryError);
    return {
      kind: 'inventory_failed',
      payload,
      status: payload.code === 'serialized_inventory_unavailable' ? 409 : 500,
    };
  }

  const richOrder = toRichPaidOrder(order, {
    merchantId: transaction.merchant_id,
  });

  if (shouldNotify) {
    schedulePaidOrderNotifications({
      merchantId: transaction.merchant_id,
      richOrder,
      scheduleAfter,
    });
  }

  const isPureReplay =
    !wonTransactionFlip &&
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

  try {
    const sideEffectsResult = await runPaidOrderSideEffects({
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
    });
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
