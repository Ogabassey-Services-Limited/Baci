import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { runPaypalReconcileFunnel } from '@/lib/payments/paypal-settlement-funnel';

/**
 * The safety net behind every PayPal write path.
 *
 * PayPal BYOK has NO webhook here and, until now, no cron. That is the single
 * structural reason the bugs in this integration were unrecoverable rather than
 * merely annoying: money moves at PayPal, our follow-up write fails, and nothing
 * ever comes back to look. Every fix so far has hardened the request path — but the
 * request path is exactly what is gone when the process dies mid-capture. PayPal's
 * own webhooks are unreliable enough that their guidance is to reconcile by polling
 * regardless, so a sweeper is the correct primitive, not a workaround.
 *
 * It reuses the ONE settlement funnel rather than re-deriving anything:
 * `runPaypalReconcileFunnel` runs with `intent: 'reconcile_only'`, which cannot
 * charge anyone. If PayPal never captured, the funnel says so and the row is left
 * alone. If PayPal DID capture, it settles through the same writer, with the same
 * residual-freshness, cancellation and duplicate-refund rules as every other path.
 * A sweeper that could charge would be a liability; this one cannot.
 */

/** How long a pending PayPal transaction must sit before we consider it stranded. */
const STRANDED_AFTER_MINUTES = 10;

/** Bounded per run so one bad row cannot starve the schedule. */
const MAX_ROWS_PER_RUN = 50;

export interface PaypalSweepResult {
  scanned: number;
  settled: number;
  notCaptured: number;
  failed: number;
  /** True when we hit the row cap — more work remains for the next run. */
  truncated: boolean;
}

interface StrandedPaypalTransaction {
  id: string;
  merchant_id: string;
  order_id: string;
  gateway_reference: string;
}

/**
 * Finds PayPal payments that are still `pending` locally well after the buyer
 * should have finished, and asks PayPal what actually happened to each.
 *
 * The dangerous state this exists for: `captureOrder()` succeeded — PayPal took the
 * buyer's money — and then the local write failed, the request timed out, or the
 * process died. The row stays `pending`, `/verify` short-circuits pending PayPal
 * rows without a live lookup, and the buyer has been charged for an order that will
 * never ship.
 */
export async function sweepStrandedPaypalCaptures(
  supabase: SupabaseClient
): Promise<PaypalSweepResult> {
  const strandedBefore = new Date(
    Date.now() - STRANDED_AFTER_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('transactions')
    .select('id, merchant_id, order_id, gateway_reference')
    .eq('gateway', 'paypal')
    // Payments only — refund audit rows are also gateway=paypal.
    .eq('transaction_type', 'payment')
    .eq('status', 'pending')
    .not('gateway_reference', 'is', null)
    .lt('created_at', strandedBefore)
    .order('created_at', { ascending: true })
    .limit(MAX_ROWS_PER_RUN);

  if (error) {
    logger.error({
      message: 'PayPal sweep: could not load stranded transactions',
      error,
    });
    throw new Error('paypal_sweep_query_failed');
  }

  const rows = (data ?? []) as StrandedPaypalTransaction[];
  const result: PaypalSweepResult = {
    scanned: rows.length,
    settled: 0,
    notCaptured: 0,
    failed: 0,
    truncated: rows.length === MAX_ROWS_PER_RUN,
  };

  for (const row of rows) {
    try {
      const outcome = await runPaypalReconcileFunnel(supabase, {
        merchantId: row.merchant_id,
        orderId: row.order_id,
        paypalOrderId: row.gateway_reference,
      });

      if (!outcome.ok) {
        // The funnel could not even load the context (bad state, missing
        // credentials). It has already logged; count it and move on so one broken
        // row cannot block the rest.
        result.failed += 1;
        continue;
      }

      const body = (await outcome.response.clone().json()) as {
        code?: string;
        success?: boolean;
      };

      if (body?.code === 'PAYPAL_NOT_CAPTURED') {
        // PayPal never took the money. Nothing to recover — the buyer simply did
        // not finish, and this row is a normal abandoned checkout.
        result.notCaptured += 1;
        continue;
      }

      if (outcome.response.status >= 200 && outcome.response.status < 300) {
        result.settled += 1;
        logger.warn({
          message:
            'PayPal sweep: recovered a captured payment that never got recorded',
          orderId: row.order_id,
          transactionId: row.id,
          paypalOrderId: row.gateway_reference,
        });
        continue;
      }

      // A non-2xx that is not "not captured" is a genuine problem (stale amount,
      // cancelled order, duplicate). The funnel has already refunded or filed a
      // review as appropriate — surface the count so the schedule can alert.
      result.failed += 1;
    } catch (sweepError) {
      result.failed += 1;
      logger.error({
        message: 'PayPal sweep: reconciling a stranded transaction threw',
        error: sweepError,
        orderId: row.order_id,
        transactionId: row.id,
      });
    }
  }

  if (result.settled > 0 || result.failed > 0) {
    logger.warn({
      message: 'paypal_sweep_recovered_or_failed',
      ...result,
    });
  }

  return result;
}
