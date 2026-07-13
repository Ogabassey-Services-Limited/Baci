import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyPayment as verifyKorapayPayment } from '@/lib/korapay';
import { logger } from '@/lib/logger';
import { finalizeOrderGatewayPayment } from '@/lib/payments/finalize-order-gateway-payment';
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';

// Sweep for "wedged" gateway order payments: the transaction row is
// completed (money confirmed) but the order never flipped to paid — the
// state the July 2026 incident (ORD-260711-00NT-5) sat in for two days.
// Heals paystack/korapay after re-verifying with the gateway; other
// gateways are surfaced loudly for manual reconciliation.

const AMOUNT_TOLERANCE_MAJOR_UNITS = 0.01;
const DEFAULT_LIMIT = 10;
// Grace period so the sweep never races a webhook that is mid-flight.
const DEFAULT_OLDER_THAN_MINUTES = 15;

export interface WedgedOrderSweepSummary {
  checked: number;
  healed: Array<{ orderId: string; orderNumber: string | null }>;
  detectedUnhealable: Array<{ transactionId: string; gateway: string }>;
  reviewsFiled: Array<{ transactionId: string; orderId: string }>;
  skipped: Array<{ transactionId: string; reason: string }>;
  failed: Array<{ transactionId: string; reason: string }>;
}

type WedgedCandidate = {
  id: string;
  order_id: string;
  merchant_id: string;
  amount: number | string | null;
  currency: string | null;
  platform_fee: number | null;
  gateway: string;
  gateway_reference: string | null;
  metadata: Record<string, unknown> | null;
};

// Terminal sweep outcomes are stamped onto the transaction so the hourly
// query never recycles them (and unhealable rows cannot starve the batch).
async function stampWedgeResolution(
  supabase: SupabaseClient,
  candidate: WedgedCandidate,
  resolution: string
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      metadata: {
        ...(candidate.metadata ?? {}),
        wedge_sweep_resolution: resolution,
        wedge_sweep_resolved_at: new Date().toISOString(),
      },
    })
    .eq('id', candidate.id);
  if (error) {
    // Non-fatal: the row shows up again next hour.
    logger.warn({
      error,
      message: 'Failed to stamp wedge sweep resolution',
      transactionId: candidate.id,
    });
  }
}

const HEALABLE_GATEWAYS = ['paystack', 'korapay'] as const;
type HealableGateway = (typeof HEALABLE_GATEWAYS)[number];

function isHealableGateway(gateway: string): gateway is HealableGateway {
  return (HEALABLE_GATEWAYS as readonly string[]).includes(gateway);
}

async function verifyGatewayCharge(
  gateway: HealableGateway,
  reference: string
): Promise<
  | {
      ok: true;
      amount: number;
      currency?: string;
      response: Record<string, unknown>;
    }
  | { ok: false; reason: string }
> {
  if (gateway === 'paystack') {
    const result = await verifyPaystackPayment(reference);
    if (!result.success || result.data.status !== 'success') {
      return { ok: false, reason: 'paystack_verification_not_success' };
    }
    return {
      amount: result.data.amount / 100,
      currency: result.data.currency,
      ok: true,
      response: result.data as unknown as Record<string, unknown>,
    };
  }
  if (gateway === 'korapay') {
    const result = await verifyKorapayPayment(reference);
    if (!result.success || result.data.status !== 'success') {
      return { ok: false, reason: 'korapay_verification_not_success' };
    }
    return {
      amount: result.data.amount,
      currency: result.data.currency,
      ok: true,
      response: result.data as unknown as Record<string, unknown>,
    };
  }
  return { ok: false, reason: 'unhealable_gateway' };
}

export async function reconcileWedgedGatewayOrders({
  supabase,
  scheduleAfter,
  limit = DEFAULT_LIMIT,
  olderThanMinutes = DEFAULT_OLDER_THAN_MINUTES,
}: {
  supabase: SupabaseClient;
  scheduleAfter: (task: () => Promise<void>) => void;
  limit?: number;
  olderThanMinutes?: number;
}): Promise<WedgedOrderSweepSummary> {
  const summary: WedgedOrderSweepSummary = {
    checked: 0,
    detectedUnhealable: [],
    failed: [],
    healed: [],
    reviewsFiled: [],
    skipped: [],
  };

  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();

  // Cancelled/refunded orders stay in scope: their captured funds need a
  // reconciliation_review row (the finalizer files it), after which the
  // transaction is stamped so it never consumes the batch again. The same
  // stamp retires unhealable-gateway detections and permanent verification
  // mismatches, so they cannot starve healable candidates out of the limit.
  const { data: candidates, error: lookupError } = await supabase
    .from('transactions')
    .select(
      'id, order_id, merchant_id, amount, currency, platform_fee, gateway, gateway_reference, metadata, orders!inner(id, payment_status, cancelled_at)'
    )
    .eq('status', 'completed')
    .eq('transaction_type', 'payment')
    .not('order_id', 'is', null)
    .lt('updated_at', cutoff)
    .neq('orders.payment_status', 'paid')
    .is('metadata->wedge_sweep_resolution', null)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (lookupError) {
    throw new Error(`wedged_order_lookup_failed: ${lookupError.message}`);
  }

  for (const raw of candidates ?? []) {
    const candidate = raw as unknown as WedgedCandidate;
    summary.checked += 1;

    try {
      if (!candidate.gateway_reference) {
        summary.skipped.push({
          reason: 'missing_gateway_reference',
          transactionId: candidate.id,
        });
        // Permanent: without a reference there is nothing to verify against,
        // so retire the row instead of letting it recycle hourly.
        await stampWedgeResolution(
          supabase,
          candidate,
          'missing_gateway_reference'
        );
        continue;
      }

      if (!isHealableGateway(candidate.gateway)) {
        logger.error({
          gateway: candidate.gateway,
          message:
            'Wedged gateway order payment detected on a gateway the sweep cannot re-verify; manual reconciliation required',
          orderId: candidate.order_id,
          transactionId: candidate.id,
        });
        summary.detectedUnhealable.push({
          gateway: candidate.gateway,
          transactionId: candidate.id,
        });
        await stampWedgeResolution(
          supabase,
          candidate,
          'unhealable_gateway_logged'
        );
        continue;
      }

      const verification = await verifyGatewayCharge(
        candidate.gateway,
        candidate.gateway_reference
      );

      if (!verification.ok) {
        summary.skipped.push({
          reason: verification.reason,
          transactionId: candidate.id,
        });
        continue;
      }

      const expectedAmount = Number(candidate.amount) || 0;
      if (
        Math.abs(verification.amount - expectedAmount) >
        AMOUNT_TOLERANCE_MAJOR_UNITS
      ) {
        summary.skipped.push({
          reason: 'amount_mismatch',
          transactionId: candidate.id,
        });
        await stampWedgeResolution(supabase, candidate, 'amount_mismatch');
        continue;
      }
      if (
        candidate.currency &&
        verification.currency &&
        candidate.currency.toUpperCase() !== verification.currency.toUpperCase()
      ) {
        summary.skipped.push({
          reason: 'currency_mismatch',
          transactionId: candidate.id,
        });
        await stampWedgeResolution(supabase, candidate, 'currency_mismatch');
        continue;
      }

      const outcome = await finalizeOrderGatewayPayment({
        actor: 'cron:reconcile-gateway-paid-orders',
        gateway: candidate.gateway,
        gatewayResponse: verification.response,
        orderId: candidate.order_id,
        reference: candidate.gateway_reference,
        scheduleAfter,
        supabase,
        transaction: {
          amount: candidate.amount,
          gateway_reference: candidate.gateway_reference,
          id: candidate.id,
          merchant_id: candidate.merchant_id,
          order_id: candidate.order_id,
          platform_fee: candidate.platform_fee,
        },
        wonTransactionFlip: false,
      });

      if (outcome.kind === 'completed') {
        logger.warn({
          healed: outcome.healed,
          message: 'Sweep healed a wedged gateway order payment',
          orderId: candidate.order_id,
          orderNumber: outcome.orderNumber,
          transactionId: candidate.id,
        });
        summary.healed.push({
          orderId: candidate.order_id,
          orderNumber: outcome.orderNumber,
        });
      } else if (
        outcome.kind === 'order_cancelled' ||
        outcome.kind === 'order_skipped'
      ) {
        // The finalizer filed the reconciliation_review row for the captured
        // funds; stamp the transaction so this terminal state is processed
        // exactly once.
        summary.reviewsFiled.push({
          orderId: candidate.order_id,
          transactionId: candidate.id,
        });
        await stampWedgeResolution(supabase, candidate, outcome.kind);
      } else {
        summary.failed.push({
          reason: outcome.kind,
          transactionId: candidate.id,
        });
      }
    } catch (candidateError) {
      logger.error({
        error: candidateError,
        message: 'Wedged order sweep failed for candidate',
        transactionId: candidate.id,
      });
      summary.failed.push({
        reason:
          candidateError instanceof Error
            ? candidateError.message
            : 'unknown_error',
        transactionId: candidate.id,
      });
    }
  }

  return summary;
}
