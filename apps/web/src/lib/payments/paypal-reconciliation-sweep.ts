import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { getPaypalCheckoutCredentials } from '@/lib/payments/paypal-checkout-credentials';
import { runPaypalReconcileFunnel } from '@/lib/payments/paypal-settlement-funnel';
import { getRefund } from '@/lib/paypal';

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
    // updated_at is the sweep cursor: checked rows are touched below so an
    // abandoned oldest page cannot starve newer captures forever.
    .lt('updated_at', strandedBefore)
    .order('updated_at', { ascending: true })
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
        const { error: touchError } = await supabase
          .from('transactions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', row.id)
          .eq('status', 'pending');
        if (touchError) {
          logger.error({
            message: 'PayPal sweep: could not rotate an abandoned checkout',
            error: touchError,
            transactionId: row.id,
          });
        }
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

export interface PaypalRefundSweepResult {
  scanned: number;
  completed: number;
  stillPending: number;
  failed: number;
  truncated: boolean;
}

interface PendingPaypalRefundTransaction {
  id: string;
  merchant_id: string;
  order_id: string;
  gateway_reference: string | null;
  metadata: Record<string, unknown> | null;
}

/** Polls accepted-but-incomplete refunds until PayPal reports a terminal state. */
export async function sweepPendingPaypalRefunds(
  supabase: SupabaseClient
): Promise<PaypalRefundSweepResult> {
  const retryBefore = new Date(
    Date.now() - STRANDED_AFTER_MINUTES * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, merchant_id, order_id, gateway_reference, metadata')
    .eq('gateway', 'paypal')
    .eq('transaction_type', 'payment')
    .eq('status', 'refund_pending')
    .lt('updated_at', retryBefore)
    .order('updated_at', { ascending: true })
    .limit(MAX_ROWS_PER_RUN);

  if (error) throw new Error('paypal_refund_sweep_query_failed');
  const rows = (data ?? []) as PendingPaypalRefundTransaction[];
  const result: PaypalRefundSweepResult = {
    scanned: rows.length,
    completed: 0,
    stillPending: 0,
    failed: 0,
    truncated: rows.length === MAX_ROWS_PER_RUN,
  };
  const credentialCache = new Map<
    string,
    Awaited<ReturnType<typeof getPaypalCheckoutCredentials>>
  >();

  for (const row of rows) {
    const ids = Array.isArray(row.metadata?.paypal_pending_refund_ids)
      ? row.metadata.paypal_pending_refund_ids.filter(
          (id): id is string => typeof id === 'string' && id.length > 0
        )
      : [];
    let credentials = credentialCache.get(row.merchant_id);
    if (credentials === undefined) {
      credentials = await getPaypalCheckoutCredentials(row.merchant_id, 'live');
      credentialCache.set(row.merchant_id, credentials);
    }

    let failed = ids.length === 0 || !credentials;
    let stillPending = false;
    const completedIds: string[] = [];
    if (credentials) {
      for (const refundId of ids) {
        const lookup = await getRefund(
          credentials.clientId,
          credentials.secretKey,
          refundId,
          'live'
        );
        if (
          !lookup.success ||
          ['CANCELLED', 'FAILED'].includes(lookup.data.status)
        ) {
          failed = true;
          continue;
        }
        if (lookup.data.status === 'PENDING') stillPending = true;
        if (lookup.data.status === 'COMPLETED') completedIds.push(refundId);
      }
    }

    const checkedAt = new Date().toISOString();
    if (failed || stillPending) {
      await supabase
        .from('transactions')
        .update({ updated_at: checkedAt })
        .eq('id', row.id)
        .eq('status', 'refund_pending');
      if (failed) result.failed += 1;
      else result.stillPending += 1;
      continue;
    }

    const metadata = { ...(row.metadata ?? {}) };
    delete metadata.paypal_pending_refund_ids;
    metadata.paypal_completed_refund_ids = completedIds;
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ status: 'refunded', metadata, updated_at: checkedAt })
      .eq('id', row.id)
      .eq('status', 'refund_pending');
    if (updateError) result.failed += 1;
    else result.completed += 1;
  }

  if (result.failed > 0) {
    logger.warn({ message: 'paypal_refund_sweep_failed_rows', ...result });
  }
  return result;
}
