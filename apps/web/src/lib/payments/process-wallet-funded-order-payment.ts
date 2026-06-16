import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { findActiveWalletFundingIntentForTransfer } from '@/lib/order-wallet-funding-intents';
import { ensurePaidOrderInventoryConfirmed } from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import {
  type CancellableOrderRow,
  handlePaymentForCancelledOrder,
  isOrderClampedAsCancelled,
} from '@/lib/payments/handle-payment-for-cancelled-order';
import { fileAmbiguousReview } from '@/lib/payments/order-wallet-funding-ambiguity';
import {
  fetchOrderPaymentTransaction,
  fetchOrderPaymentTransactionByOrder,
} from '@/lib/payments/order-wallet-funding-queries';
import type { ScheduleAfter } from '@/lib/payments/paid-order-side-effect-types';
import { extractVerifiedGatewayFeeNgn } from '@/lib/payments/verified-gateway-fee';
import { runWalletFundedPaidOrderSideEffects } from '@/lib/payments/wallet-funded-order-side-effects';

const WALLET_TOP_UP_TRANSACTION_TYPE = 'wallet_topup';
const ORDER_PAYMENT_TRANSACTION_RETRY_DELAYS_MS = [500, 1000, 2000] as const;

/**
 * True when finalize_wallet_funded_order RAISEd because the intent was no longer
 * processable (cancelled/expired/completed). For the cancellation flow the
 * caller re-checks the order state to decide whether to ack-and-reconcile.
 */
function isWalletIntentNotProcessableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  return (
    code === 'P0001' &&
    typeof message === 'string' &&
    message.includes('wallet_order_funding_intent_not_processable')
  );
}

interface WalletFundingTransaction {
  amount: number | string | null;
  id: string;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
}

interface FinalizerResult {
  debited_amount?: number | string | null;
  excess_amount?: number | string | null;
  funded_amount?: number | string | null;
  order_id?: string | null;
  order_paid?: boolean | null;
  order_payment_transaction_id?: string | null;
}

export function buildFinalizeWalletParams({
  amount,
  currency,
  gatewayFee,
  gatewayReference,
  intentId,
  paidAt,
  transactionId,
}: {
  amount: number;
  currency: string;
  gatewayFee: number;
  gatewayReference: string;
  intentId: string;
  paidAt: Date;
  transactionId: string;
}) {
  return {
    p_currency: currency,
    p_gateway_fee: gatewayFee,
    p_gateway_reference: gatewayReference,
    p_intent_id: intentId,
    p_paid_at: paidAt.toISOString(),
    p_received_amount: amount,
    p_transaction_id: transactionId,
  };
}

const finalizerResultSchema = z.looseObject({
  debited_amount: z.union([z.number(), z.string()]).nullable().optional(),
  excess_amount: z.union([z.number(), z.string()]).nullable().optional(),
  funded_amount: z.union([z.number(), z.string()]).nullable().optional(),
  order_id: z.string().nullable().optional(),
  order_paid: z.boolean().nullable().optional(),
  order_payment_transaction_id: z.string().nullable().optional(),
});

export type ProcessWalletFundedOrderPaymentResult =
  | { kind: 'none' }
  | {
      body: Record<string, unknown>;
      kind: 'processed';
      orderPaid: boolean;
      status: 200;
    };

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getPaidAt(gatewayResponse: Record<string, unknown>) {
  const rawPaidAt = gatewayResponse.paid_at;
  const paidAt = typeof rawPaidAt === 'string' ? new Date(rawPaidAt) : null;
  return paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null;
}

function getCurrency(gatewayResponse: Record<string, unknown>) {
  const currency = gatewayResponse.currency;
  return typeof currency === 'string' && currency.trim()
    ? currency.trim().toUpperCase()
    : 'NGN';
}

function normalizeFinalizerResult(data: unknown): FinalizerResult {
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = finalizerResultSchema.safeParse(row);
  if (parsed.success) {
    return parsed.data;
  }
  logger.warn({
    issues: parsed.error.issues,
    message: 'Wallet-funded order finalizer returned malformed data',
    row,
  });
  throw new Error('Wallet-funded order finalizer returned malformed data');
}

function normalizeFinalizerAmount(
  value: number | string | null | undefined,
  fallback: number
) {
  const amount = Number(value ?? fallback);
  return Number.isFinite(amount) ? amount : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOrderCancellationState({
  merchantId,
  orderId,
  supabase,
}: {
  merchantId: string;
  orderId: string;
  supabase: SupabaseClient;
}): Promise<CancellableOrderRow | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, shipping_status, cancelled_at')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .maybeSingle<CancellableOrderRow>();
  if (error) {
    throw error;
  }
  return data;
}

function fetchFinalizedOrderPaymentTransaction({
  finalizer,
  merchantId,
  orderId,
  supabase,
}: {
  finalizer: FinalizerResult;
  merchantId: string;
  orderId: string;
  supabase: SupabaseClient;
}) {
  return finalizer.order_payment_transaction_id
    ? fetchOrderPaymentTransaction({
        merchantId,
        transactionId: finalizer.order_payment_transaction_id,
        supabase,
      })
    : fetchOrderPaymentTransactionByOrder({
        merchantId,
        orderId,
        supabase,
      });
}

async function fetchFinalizedOrderPaymentTransactionWithRetry({
  customerId,
  finalizer,
  fundedAmount,
  gatewayReference,
  intentId,
  merchantId,
  orderId,
  supabase,
}: {
  customerId: string;
  finalizer: FinalizerResult;
  fundedAmount: number;
  gatewayReference: string;
  intentId: string;
  merchantId: string;
  orderId: string;
  supabase: SupabaseClient;
}) {
  let orderTransaction = await fetchFinalizedOrderPaymentTransaction({
    finalizer,
    merchantId,
    orderId,
    supabase,
  });
  if (orderTransaction) {
    return orderTransaction;
  }

  for (const [
    index,
    retryDelayMs,
  ] of ORDER_PAYMENT_TRANSACTION_RETRY_DELAYS_MS.entries()) {
    logger.warn({
      attempt: index + 1,
      customerId,
      fundedAmount,
      gatewayReference,
      intentId,
      merchantId,
      message:
        'Missing order payment transaction for paid wallet-funded order; retrying lookup',
      orderId,
      retryDelayMs,
    });
    await sleep(retryDelayMs);
    orderTransaction = await fetchFinalizedOrderPaymentTransaction({
      finalizer,
      merchantId,
      orderId,
      supabase,
    });
    if (orderTransaction) {
      return orderTransaction;
    }
  }

  return null;
}

export async function processWalletFundedOrderPayment({
  gatewayReference,
  gatewayResponse,
  scheduleAfter,
  supabase,
  transaction,
}: {
  gatewayReference: string;
  gatewayResponse: Record<string, unknown>;
  scheduleAfter: ScheduleAfter;
  supabase: SupabaseClient;
  transaction: WalletFundingTransaction;
}): Promise<ProcessWalletFundedOrderPaymentResult> {
  const metadata = transaction.metadata ?? {};
  if (metadata.transaction_type !== WALLET_TOP_UP_TRANSACTION_TYPE) {
    return { kind: 'none' };
  }

  const walletPaymentAccountId = getMetadataString(
    metadata,
    'wallet_payment_account_id'
  );
  const amount = Number(transaction.amount);
  if (!walletPaymentAccountId || !Number.isFinite(amount) || amount <= 0) {
    return { kind: 'none' };
  }

  const paidAt = getPaidAt(gatewayResponse);
  if (!paidAt) {
    logger.warn({
      gatewayReference,
      gatewayResponse,
      merchantId: transaction.merchant_id,
      message:
        'Retrying wallet-funded order matching because Paystack paid_at is missing or invalid',
      walletPaymentAccountId,
    });
    throw new Error(
      `Missing or invalid Paystack paid_at for wallet-funded order transfer ${gatewayReference} on merchant ${transaction.merchant_id}`
    );
  }

  const match = await findActiveWalletFundingIntentForTransfer({
    amount,
    paidAt,
    supabase,
    walletPaymentAccountId,
  });

  if (match.kind === 'ambiguous') {
    logger.warn({
      customerId: getMetadataString(metadata, 'customer_id'),
      gatewayReference,
      intentIds: match.intentIds,
      merchantId: transaction.merchant_id,
      message: 'Wallet DVA transfer matched multiple order funding intents',
      walletPaymentAccountId,
    });
    await fileAmbiguousReview({
      gatewayReference,
      intentIds: match.intentIds,
      supabase,
    });
    return { kind: 'none' };
  }
  if (match.kind === 'none') {
    return { kind: 'none' };
  }

  const gatewayFee = extractVerifiedGatewayFeeNgn('paystack', gatewayResponse);
  logger.info({
    customerId: match.intent.customerId,
    gatewayReference,
    intentId: match.intent.id,
    merchantId: match.intent.merchantId,
    message: 'Finalizing wallet-funded order payment',
    orderId: match.intent.orderId,
  });
  const { data, error } = await supabase.rpc(
    'finalize_wallet_funded_order',
    buildFinalizeWalletParams({
      amount,
      currency: getCurrency(gatewayResponse),
      gatewayFee,
      gatewayReference,
      intentId: match.intent.id,
      paidAt,
      transactionId: transaction.id,
    })
  );
  if (error) {
    // A customer cancellation marks the funding intent 'cancelled', so a late
    // DVA transfer makes finalize_wallet_funded_order RAISE
    // 'wallet_order_funding_intent_not_processable' (P0001) — and that RAISE
    // rolls back the reconciliation row the RPC tried to file. If the order is
    // cancelled, ack 2xx (no Paystack retry loop) and re-file the reconciliation
    // row from here instead of rethrowing (which would 500 the webhook).
    if (isWalletIntentNotProcessableError(error)) {
      const cancelledState = await fetchOrderCancellationState({
        merchantId: match.intent.merchantId,
        orderId: match.intent.orderId,
        supabase,
      });
      if (cancelledState && isOrderClampedAsCancelled(cancelledState)) {
        await handlePaymentForCancelledOrder({
          gatewayReference,
          order: cancelledState,
          reason:
            'Wallet-funded order payment received for an order cancelled before finalization',
          transactionId: transaction.id,
        });
        return {
          body: { orderId: match.intent.orderId, status: 'cancelled' },
          kind: 'processed',
          orderPaid: false,
          status: 200,
        };
      }

      if (!cancelledState) {
        logger.warn({
          gatewayReference,
          intentId: match.intent.id,
          merchantId: match.intent.merchantId,
          message:
            'Wallet-funded order intent was not processable and order was not found; acking webhook to avoid retry storm',
          orderId: match.intent.orderId,
        });
        return {
          body: { orderId: match.intent.orderId, status: 'unknown' },
          kind: 'processed',
          orderPaid: false,
          status: 200,
        };
      }
    }
    logger.error({
      error,
      gatewayReference,
      intentId: match.intent.id,
      merchantId: match.intent.merchantId,
      message: 'Wallet-funded order finalizer RPC failed',
      orderId: match.intent.orderId,
    });
    throw error;
  }

  const finalizer = normalizeFinalizerResult(data);
  logger.info({
    customerId: match.intent.customerId,
    fundedAmount: finalizer.funded_amount ?? amount,
    gatewayReference,
    intentId: match.intent.id,
    merchantId: match.intent.merchantId,
    message: 'Wallet-funded order finalizer completed',
    orderId: finalizer.order_id ?? match.intent.orderId,
    orderPaid: finalizer.order_paid === true,
  });
  if (finalizer.order_paid === true && !finalizer.order_id) {
    logger.warn({
      customerId: match.intent.customerId,
      gatewayReference,
      intentId: match.intent.id,
      merchantId: match.intent.merchantId,
      message:
        'Wallet-funded order finalizer marked order paid without an order id',
    });
    throw new Error(
      `Missing order id for paid wallet-funded order intent ${match.intent.id}`
    );
  }
  if (finalizer.order_paid && finalizer.order_id) {
    // The finalize_wallet_funded_order RPC does not expose cancellation, and a
    // cancelled order is clamped by prevent_cancelled_order_reopen (its
    // payment_status stays unpaid, so fetchPaidOrder — which filters
    // payment_status='paid' — would throw and 500 the webhook). Read the
    // order's cancellation state first; if clamped, suppress all paid-order
    // side effects and file a reconciliation row instead.
    const orderCancellationState = await fetchOrderCancellationState({
      merchantId: match.intent.merchantId,
      orderId: finalizer.order_id,
      supabase,
    });
    if (isOrderClampedAsCancelled(orderCancellationState)) {
      await handlePaymentForCancelledOrder({
        gatewayReference,
        order: orderCancellationState ?? { id: finalizer.order_id },
        reason:
          'Wallet-funded order payment finalized for an order cancelled before finalization',
        transactionId: finalizer.order_payment_transaction_id ?? transaction.id,
      });

      return {
        body: {
          debitedAmount: normalizeFinalizerAmount(finalizer.debited_amount, 0),
          fundedAmount: normalizeFinalizerAmount(
            finalizer.funded_amount,
            amount
          ),
          orderId: finalizer.order_id,
          status: 'cancelled',
        },
        kind: 'processed',
        orderPaid: false,
        status: 200,
      };
    }

    await ensurePaidOrderInventoryConfirmed(
      supabase,
      match.intent.merchantId,
      finalizer.order_id
    );

    const fundedAmount = normalizeFinalizerAmount(
      finalizer.funded_amount,
      amount
    );
    const orderTransaction =
      await fetchFinalizedOrderPaymentTransactionWithRetry({
        customerId: match.intent.customerId,
        finalizer,
        fundedAmount,
        gatewayReference,
        intentId: match.intent.id,
        merchantId: match.intent.merchantId,
        orderId: finalizer.order_id,
        supabase,
      });
    if (orderTransaction) {
      await runWalletFundedPaidOrderSideEffects({
        gatewayFee,
        gatewayReference,
        gatewayResponse,
        intent: match.intent,
        orderId: finalizer.order_id,
        orderTransaction,
        scheduleAfter,
        supabase,
      });
    } else {
      logger.warn({
        attempts: ORDER_PAYMENT_TRANSACTION_RETRY_DELAYS_MS.length + 1,
        customerId: match.intent.customerId,
        fundedAmount,
        gatewayReference,
        intentId: match.intent.id,
        merchantId: match.intent.merchantId,
        message:
          'Missing order payment transaction for paid wallet-funded order; will retry',
        orderId: finalizer.order_id,
      });
      throw new Error(
        `Missing order payment transaction for paid wallet-funded order ${finalizer.order_id}`
      );
    }
  }

  return {
    body: {
      debitedAmount: normalizeFinalizerAmount(finalizer.debited_amount, 0),
      fundedAmount: normalizeFinalizerAmount(finalizer.funded_amount, amount),
      orderId: finalizer.order_id ?? match.intent.orderId,
      status: finalizer.order_paid ? 'completed' : 'underfunded',
    },
    kind: 'processed',
    orderPaid: finalizer.order_paid === true,
    status: 200,
  };
}
