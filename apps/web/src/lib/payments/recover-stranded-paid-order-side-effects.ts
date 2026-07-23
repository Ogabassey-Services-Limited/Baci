import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  PAID_ORDER_SIDE_EFFECT_ATTEMPT_CAP,
  PERMANENT_PAID_ORDER_SIDE_EFFECT_ERRORS,
} from '@/lib/payments/paid-order-side-effect-retry-policy';
import { REPLAYABLE_PAID_ORDER_SIDE_EFFECT_STEPS } from '@/lib/payments/replayable-paid-order-side-effect-steps';

// A deterministic side-effect failure (e.g. the receipt-email path referencing
// a column that no migration ever created) exhausts the attempt cap and is then
// excluded from BOTH the drain SELECT and the claim RPC's re-claim guard —
// permanently stranded even after the underlying bug is fixed in a later
// deploy. Before this pre-pass an operator had to reset `attempts` by hand to
// get the receipt out (the danneey7 order, 2026-07-23).
//
// Run at the head of the drain each cron tick, this does two bounded things:
//   1. Grants each stranded-but-recoverable row ONE fresh attempt — throttled
//      to once per window — by resetting `attempts` just below the cap. A code
//      fix then drains automatically on the same/next tick. Rate-limiting, not
//      unbounded retry: a still-broken row re-caps after its single retry.
//   2. Classifies rows attempted within the window and still failing as truly
//      stranded, surfaced at error level so a genuinely permanent failure gets
//      classified (added to PERMANENT_PAID_ORDER_SIDE_EFFECT_ERRORS) instead of
//      retried forever.
//
// The throttle keys on `claimed_at` — the last time the claim RPC (re)claimed
// the row, i.e. the last attempt. This is deliberate: `claimed_at` is set only
// by the claim RPC and is NEVER rewritten by markCompleted/markFailed, so it
// survives the `result`-nulling failure path that a triggered re-run takes.
// Storing a throttle marker in `result` would be wiped on every failed retry,
// re-resetting the row every backoff window and never surfacing it.
//
// Terminate on error class (permanent-error list + terminal retirement),
// rate-limit on attempts — never hard-stop a recoverable paid-order receipt.

const DEFAULT_THROTTLE_HOURS = 24;
const DEFAULT_LIMIT = 25;
const HOUR_MS = 60 * 60 * 1000;
// One fresh claim: reset to cap-1 so a still-broken row re-caps after a single
// retry rather than burning a whole attempt budget again each window.
const RESET_ATTEMPTS = PAID_ORDER_SIDE_EFFECT_ATTEMPT_CAP - 1;

const RECOVERY_SELECT =
  'order_id, step, attempts, error, claimed_at, transactions!inner(status), orders!inner(payment_status, cancelled_at)';

export interface StrandedSideEffectRecoverySummary {
  recovered: Array<{ orderId: string; step: string }>;
  stranded: Array<{ orderId: string; step: string; error: string | null }>;
}

type CappedRow = {
  order_id: string;
  step: string;
  attempts: number;
  error: string | null;
  claimed_at: string | null;
};

export async function recoverStrandedPaidOrderSideEffects({
  supabase,
  now = new Date(),
  throttleHours = DEFAULT_THROTTLE_HOURS,
  limit = DEFAULT_LIMIT,
}: {
  supabase: SupabaseClient;
  now?: Date;
  throttleHours?: number;
  limit?: number;
}): Promise<StrandedSideEffectRecoverySummary> {
  const summary: StrandedSideEffectRecoverySummary = {
    recovered: [],
    stranded: [],
  };

  const { data, error } = await supabase
    .from('payment_side_effects')
    .select(RECOVERY_SELECT)
    .eq('status', 'failed')
    .gte('attempts', PAID_ORDER_SIDE_EFFECT_ATTEMPT_CAP)
    .not(
      'error',
      'in',
      `(${PERMANENT_PAID_ORDER_SIDE_EFFECT_ERRORS.join(',')})`
    )
    .in('step', [...REPLAYABLE_PAID_ORDER_SIDE_EFFECT_STEPS])
    .eq('transactions.status', 'completed')
    .eq('orders.payment_status', 'paid')
    .is('orders.cancelled_at', null)
    // Oldest attempt first: the rows most likely past the throttle window (so
    // eligible for a reset) sort to the front, and each reset drops a row below
    // the cap out of this result set — so a backlog larger than `limit` drains
    // deterministically across ticks instead of the unordered query starving
    // rows beyond the first page. Aligns with payment_side_effects_open_idx
    // (status, claimed_at).
    .order('claimed_at', { ascending: true })
    .limit(limit);

  if (error) {
    // Best-effort pre-pass: never take the drain (and the whole reconcile cron)
    // down over the recovery scan. Surface it and let the drain proceed.
    logger.error({
      error,
      message: 'Stranded side-effect recovery lookup failed',
    });
    return summary;
  }

  const throttleCutoff = new Date(now.getTime() - throttleHours * HOUR_MS);

  for (const raw of (data ?? []) as unknown as CappedRow[]) {
    const claimedAt = raw.claimed_at ? new Date(raw.claimed_at) : null;
    const attemptedRecently =
      claimedAt !== null &&
      !Number.isNaN(claimedAt.getTime()) &&
      claimedAt > throttleCutoff;

    if (attemptedRecently) {
      // Attempted within the window and still failing → a real strand, not a
      // transient. Surface it for classification rather than retry again.
      summary.stranded.push({
        error: raw.error,
        orderId: raw.order_id,
        step: raw.step,
      });
      continue;
    }

    // Compare-and-swap: re-assert the eligibility predicate in the UPDATE so a
    // row a concurrent actor already re-claimed (status/attempts changed) is a
    // no-op, never resetting attempts on a mid-flight claimed row.
    const { data: updated, error: updateError } = await supabase
      .from('payment_side_effects')
      .update({ attempts: RESET_ATTEMPTS })
      .eq('order_id', raw.order_id)
      .eq('step', raw.step)
      .eq('status', 'failed')
      .gte('attempts', PAID_ORDER_SIDE_EFFECT_ATTEMPT_CAP)
      .select('order_id');

    if (updateError) {
      logger.error({
        error: updateError,
        message: 'Failed to reset stranded side-effect row for retry',
        orderId: raw.order_id,
        step: raw.step,
      });
      // Could not grant the retry → the row is still stranded; surface it.
      summary.stranded.push({
        error: raw.error,
        orderId: raw.order_id,
        step: raw.step,
      });
      continue;
    }

    if (!updated || updated.length === 0) {
      // A concurrent actor moved the row (re-claim / already reset). It is being
      // handled elsewhere — neither recovered by us nor stranded.
      continue;
    }

    summary.recovered.push({ orderId: raw.order_id, step: raw.step });
  }

  return summary;
}
