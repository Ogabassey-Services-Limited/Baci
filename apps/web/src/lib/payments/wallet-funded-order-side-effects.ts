import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderWalletFundingIntent } from '@/lib/order-wallet-funding-intent-types';
import { fetchPaidOrder } from '@/lib/payments/order-wallet-funding-queries';
import type {
  PaidOrderSideEffectTransaction,
  ScheduleAfter,
} from '@/lib/payments/paid-order-side-effect-types';
import { runPaidOrderSideEffects } from '@/lib/payments/run-paid-order-side-effects';
import { getWalletFundedOrderAllocatedGatewayFee } from '@/lib/payments/wallet-funded-order-fee-allocation';

function assertWalletFundingIntent(
  intent: OrderWalletFundingIntent
): asserts intent is OrderWalletFundingIntent {
  if (!(intent?.id && intent?.merchantId && intent?.orderId)) {
    throw new Error(
      'Invalid wallet funding intent for paid-order side effects'
    );
  }
}

function withContext<T>({
  gatewayReference,
  operation,
  orderId,
  run,
}: {
  gatewayReference: string;
  operation: string;
  orderId: string;
  run: () => Promise<T>;
}) {
  return run().catch((error) => {
    throw new Error(
      `Wallet-funded order side effects failed during ${operation} for order ${orderId} via gateway reference ${gatewayReference}`,
      { cause: error }
    );
  });
}

function assertWalletFundedOrderContext({
  intent,
  orderId,
  orderTransaction,
}: {
  intent: OrderWalletFundingIntent;
  orderId: string;
  orderTransaction: PaidOrderSideEffectTransaction;
}) {
  if (intent.orderId !== orderId) {
    throw new Error(
      `Wallet funding intent ${intent.id} belongs to order ${intent.orderId}, not ${orderId}`
    );
  }
  if (orderTransaction.order_id !== orderId) {
    throw new Error(
      `Transaction ${orderTransaction.id} belongs to order ${orderTransaction.order_id}, not ${orderId}`
    );
  }
  if (orderTransaction.merchant_id !== intent.merchantId) {
    throw new Error(
      `Transaction ${orderTransaction.id} belongs to merchant ${orderTransaction.merchant_id}, not ${intent.merchantId}`
    );
  }
}

export async function runWalletFundedPaidOrderSideEffects({
  gatewayReference,
  gatewayResponse,
  gatewayFee,
  intent,
  orderId,
  orderTransaction,
  scheduleAfter,
  supabase,
}: {
  gatewayFee: number;
  gatewayReference: string;
  gatewayResponse: Record<string, unknown>;
  intent: OrderWalletFundingIntent;
  orderId: string;
  orderTransaction: PaidOrderSideEffectTransaction;
  scheduleAfter: ScheduleAfter;
  supabase: SupabaseClient;
}) {
  assertWalletFundingIntent(intent);
  assertWalletFundedOrderContext({ intent, orderId, orderTransaction });

  const order = await withContext({
    gatewayReference,
    operation: 'fetchPaidOrder',
    orderId,
    run: () =>
      fetchPaidOrder({
        merchantId: intent.merchantId,
        orderId,
        supabase,
      }),
  });

  const allocatedGatewayFeeNgn = await withContext({
    gatewayReference,
    operation: 'getWalletFundedOrderAllocatedGatewayFee',
    orderId,
    run: () =>
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: gatewayFee,
        intent,
        supabase,
      }),
  });

  await withContext({
    gatewayReference,
    operation: 'runPaidOrderSideEffects',
    orderId,
    run: () =>
      runPaidOrderSideEffects({
        actor: `wallet-funded-order:${gatewayReference}`,
        allocatedGatewayFeeNgn,
        externalGatewayReference: gatewayReference,
        gatewayResponse,
        order,
        scheduleAfter,
        settlementGateway: intent.provider,
        supabase,
        transaction: orderTransaction,
      }),
  });
}
