import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { finalizeOrderGatewayPayment } from '@/lib/payments/finalize-order-gateway-payment';
import {
  type HealableGateway,
  verifyGatewayCharge,
} from '@/lib/payments/verify-gateway-charge';

// Second half of the reconcile cron: orders that ARE paid but whose outbox
// side effects (receipt email, settlement, ad tracking) recorded a failure —
// e.g. the paid-order fetch failed after the atomic flip, or the side-effect
// runner itself crashed and persistPaidOrderSideEffectRetry filed markers.
// The wedge sweep cannot see these (it scans NOT-paid orders only), so this
// drain re-runs the finalizer, whose claim-gated outbox retries exactly the
// failed steps. Stub/permanent errors are excluded to avoid retry loops.

const PERMANENT_STEP_ERRORS = [
  'wired_in_b3_5',
  'financial_totals_inconsistent',
];
const HEALABLE_GATEWAYS = new Set(['paystack', 'korapay']);
const DEFAULT_LIMIT = 10;
// Comfortably past the claim RPC's 60s takeover window.
const STALE_CLAIM_MINUTES = 15;

export interface FailedSideEffectDrainSummary {
  drained: Array<{ orderId: string }>;
  failed: Array<{ orderId: string; reason: string }>;
  skipped: Array<{ orderId: string; reason: string }>;
}

type DrainCandidateRow = {
  order_id: string;
  transaction_id: string | null;
  transactions: {
    id: string;
    order_id: string | null;
    merchant_id: string;
    amount: number | string | null;
    platform_fee: number | null;
    gateway: string;
    gateway_reference: string | null;
    gateway_response: Record<string, unknown> | null;
  };
};

export async function drainFailedPaidOrderSideEffects({
  supabase,
  scheduleAfter,
  limit = DEFAULT_LIMIT,
}: {
  supabase: SupabaseClient;
  scheduleAfter: (task: () => Promise<void>) => void;
  limit?: number;
}): Promise<FailedSideEffectDrainSummary> {
  const summary: FailedSideEffectDrainSummary = {
    drained: [],
    failed: [],
    skipped: [],
  };

  const DRAIN_SELECT =
    'order_id, transaction_id, transactions!inner(id, order_id, merchant_id, amount, platform_fee, gateway, gateway_reference, gateway_response), orders!inner(id, payment_status, cancelled_at)';

  const { data: failedRows, error: lookupError } = await supabase
    .from('payment_side_effects')
    .select(DRAIN_SELECT)
    .eq('status', 'failed')
    .not('error', 'in', `(${PERMANENT_STEP_ERRORS.join(',')})`)
    .eq('transactions.status', 'completed')
    .eq('orders.payment_status', 'paid')
    .is('orders.cancelled_at', null)
    .limit(limit * 3);

  if (lookupError) {
    throw new Error(`failed_side_effect_lookup_failed: ${lookupError.message}`);
  }

  // A worker that dies between claim_payment_side_effect and
  // markCompleted/markFailed leaves the row 'claimed' forever; the claim
  // RPC's 60s takeover only helps if something re-runs the order. Sweep
  // stale claims too so a crashed verify/webhook run cannot strand its
  // email/settlement steps.
  const staleClaimCutoff = new Date(
    Date.now() - STALE_CLAIM_MINUTES * 60_000
  ).toISOString();
  const { data: staleRows, error: staleLookupError } = await supabase
    .from('payment_side_effects')
    .select(DRAIN_SELECT)
    .eq('status', 'claimed')
    .lt('claimed_at', staleClaimCutoff)
    .eq('transactions.status', 'completed')
    .eq('orders.payment_status', 'paid')
    .is('orders.cancelled_at', null)
    .limit(limit * 3);

  if (staleLookupError) {
    throw new Error(
      `stale_side_effect_lookup_failed: ${staleLookupError.message}`
    );
  }

  const byOrder = new Map<string, DrainCandidateRow>();
  for (const raw of [...(failedRows ?? []), ...(staleRows ?? [])]) {
    const row = raw as unknown as DrainCandidateRow;
    if (!byOrder.has(row.order_id)) {
      byOrder.set(row.order_id, row);
    }
    if (byOrder.size >= limit) {
      break;
    }
  }

  for (const [orderId, row] of byOrder) {
    try {
      const txn = row.transactions;
      const gateway = txn.gateway;
      if (!HEALABLE_GATEWAYS.has(gateway)) {
        summary.skipped.push({ orderId, reason: 'unhealable_gateway' });
        continue;
      }
      if (!txn.gateway_reference) {
        summary.skipped.push({ orderId, reason: 'missing_gateway_reference' });
        continue;
      }

      let gatewayResponse = txn.gateway_response;
      if (!gatewayResponse) {
        const verification = await verifyGatewayCharge(
          gateway as HealableGateway,
          txn.gateway_reference
        );
        if (!verification.ok) {
          summary.skipped.push({ orderId, reason: verification.reason });
          continue;
        }
        gatewayResponse = verification.response;
      }

      const outcome = await finalizeOrderGatewayPayment({
        actor: 'cron:reconcile-gateway-paid-orders:drain',
        gateway: gateway as 'paystack' | 'korapay',
        gatewayResponse,
        orderId,
        reference: txn.gateway_reference,
        scheduleAfter,
        supabase,
        transaction: {
          amount: txn.amount,
          gateway_reference: txn.gateway_reference,
          id: txn.id,
          merchant_id: txn.merchant_id,
          order_id: txn.order_id,
          platform_fee: txn.platform_fee,
        },
        wonTransactionFlip: false,
      });

      if (outcome.kind === 'completed') {
        logger.warn({
          message: 'Drained failed paid-order side effects via reconcile cron',
          orderId,
          transactionId: txn.id,
        });
        summary.drained.push({ orderId });
      } else {
        summary.failed.push({ orderId, reason: outcome.kind });
      }
    } catch (drainError) {
      logger.error({
        error: drainError,
        message: 'Failed-side-effect drain errored for order',
        orderId,
      });
      summary.failed.push({
        orderId,
        reason:
          drainError instanceof Error ? drainError.message : 'unknown_error',
      });
    }
  }

  return summary;
}
