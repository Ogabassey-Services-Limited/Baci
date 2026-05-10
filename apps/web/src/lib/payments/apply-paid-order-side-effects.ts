// Phase A — A1 outbox helper (Δ-7, Δ-24, Δ-31, Δ-38, Δ-58, Δ-60, Δ-61, Δ-66, Δ-67, Δ-69, Δ-70).
// Replaces the old TOCTTOU "check flag → run → set flag" pattern. Each side
// effect of a paid order (email, FIRS, loyalty, ad tracking, settlement) is
// claimed in `payment_side_effects` via the SECURITY DEFINER RPC
// `claim_payment_side_effect`. The worker that wins the claim runs the
// executor; the mark-completed UPDATE is token-gated so a stale-claim
// takeover by a peer worker can't double-mark.
//
// Δ-66 / Δ-69 / Δ-70 client invariant: this helper REQUIRES a service-role
// Supabase client. The repo factory is `createServiceClient` from
// `@/lib/supabase/service` (NOT `@/lib/supabase/admin`'s `createAdminClient`,
// which is a different export name). The TS type alone is documentation —
// real runtime safety is the RPC's `auth.role() = 'service_role'` guard
// (Δ-67). Production callers (webhook, A2 script, B4 cron) must construct
// the client via `createServiceClient()` and pass it.
//
// Δ-31 / Δ-38: the helper short-circuits `firs_invoice` and `loyalty_points`
// when the order's totals are not consistent with its `tax_basis`. Both
// integrations depend on a correct `total`, and replaying a failed claim
// after B3.5 backfill picks them up automatically.
//
// Δ-61 (email): ZeptoMail does not support an `Idempotency-Key` header. The
// `payment_side_effects` claim row is the dedup record. The email executor
// should set ZeptoMail's `client_reference = 'order:<id>:paid_email'` for a
// server-side audit trail. Residual risk: at most one duplicate email if a
// worker sends successfully and dies inside the 60s claim window before
// marking completed.

import { logger } from '@/lib/logger';
import {
  claimStep,
  markCompleted,
  markFailed,
} from '@/lib/payments/apply-paid-order-side-effects-internals';
import {
  type FinancialConsistencyResult,
  financialConsistency,
} from '@/lib/payments/financial-consistency';
import type { createServiceClient } from '@/lib/supabase/service';

type ServiceRoleClient = ReturnType<typeof createServiceClient>;

export type SideEffectStep =
  | 'paid_email'
  | 'firs_invoice'
  | 'loyalty_points'
  | 'ad_tracking_conversion'
  | 'merchant_settlement';

const FINANCIAL_CONSISTENCY_GATED_STEPS: ReadonlySet<SideEffectStep> = new Set([
  'firs_invoice',
  'loyalty_points',
]);

const STEP_ORDER: readonly SideEffectStep[] = [
  'paid_email',
  'firs_invoice',
  'loyalty_points',
  'ad_tracking_conversion',
  'merchant_settlement',
];

export type PaidOrder = {
  id: string;
  merchant_id: string;
  payment_status: 'paid' | 'pending' | string;
  tax_basis: 'exclusive' | 'inclusive' | null;
  subtotal: number;
  shipping_fee: number;
  gift_wrapping_fee: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
};

export type PaidTransaction = {
  id: string;
  order_id: string;
  merchant_id: string;
  gateway_reference: string | null;
  amount: number | string | null;
};

export type StepContext = {
  order: PaidOrder;
  transaction: PaidTransaction;
  gatewayResponse: Record<string, unknown>;
  consistency: FinancialConsistencyResult;
};

// Executor returns a result payload (any plain TS object) to be stored in
// `payment_side_effects.result`. Throwing means the step failed — the helper
// captures `error.message` into `payment_side_effects.error` and continues
// to the next step. Returning `undefined` is allowed (no result payload).
export type StepExecutor = (
  ctx: StepContext
) => Promise<Record<string, unknown> | undefined>;

export type ApplyPaidOrderSideEffectsArgs = {
  supabase: ServiceRoleClient;
  // The order MUST already be marked `payment_status='paid'` by the
  // caller's atomic flip (webhook UPDATE / claim_paystack_paid_atomic
  // RPC). The helper enforces this with a runtime check before touching
  // the outbox; callers that pass a stale `pending` row trigger
  // `order_not_paid`.
  order: PaidOrder;
  transaction: PaidTransaction;
  gatewayResponse: Record<string, unknown>;
  // e.g. 'webhook:<request_id>' | 'cron:<run_id>' | 'script:reconcile-paystack-dva'
  actor: string;
  executors: Partial<Record<SideEffectStep, StepExecutor>>;
};

// `concurrentTakeoverSteps` is a SUBSET of `ranSteps` — executor ran but
// the mark-completed UPDATE lost the row-write race. Subtract for
// uniquely-completed-by-this-worker metrics. Boundary idempotency at
// each integration prevents double external execution.
export type ApplyPaidOrderSideEffectsResult = {
  ranSteps: SideEffectStep[];
  skippedSteps: SideEffectStep[];
  failedSteps: Array<{ step: SideEffectStep; error: string }>;
  concurrentTakeoverSteps: SideEffectStep[];
};

export async function applyPaidOrderSideEffects(
  args: ApplyPaidOrderSideEffectsArgs
): Promise<ApplyPaidOrderSideEffectsResult> {
  const { supabase, order, transaction, gatewayResponse, actor, executors } =
    args;

  if (order.payment_status !== 'paid') {
    throw new Error(
      `order_not_paid: order ${order.id} is ${order.payment_status} — caller must flip via the atomic RPC before invoking the outbox`
    );
  }
  if (transaction.order_id !== order.id) {
    throw new Error(
      `order_transaction_mismatch: transaction ${transaction.id} order_id=${transaction.order_id} but order=${order.id}`
    );
  }

  const consistency = financialConsistency({
    tax_basis: order.tax_basis,
    subtotal: order.subtotal,
    shipping_fee: order.shipping_fee,
    gift_wrapping_fee: order.gift_wrapping_fee,
    tax_amount: order.tax_amount,
    discount_amount: order.discount_amount,
    total: order.total,
  });

  const result: ApplyPaidOrderSideEffectsResult = {
    ranSteps: [],
    skippedSteps: [],
    failedSteps: [],
    concurrentTakeoverSteps: [],
  };

  for (const step of STEP_ORDER) {
    const executor = executors[step];
    if (!executor) {
      continue;
    }

    const myToken = crypto.randomUUID();
    const claimResult = await claimStep(supabase, {
      orderId: order.id,
      transactionId: transaction.id,
      step,
      token: myToken,
      claimedBy: actor,
    });

    if (!claimResult.we_won) {
      // Either already completed (skip) or another worker is mid-flight
      // with a fresh claim (defer — let the other worker finish).
      result.skippedSteps.push(step);
      logger.info({
        message: 'payment_side_effects: step claim deferred',
        orderId: order.id,
        step,
        currentStatus: claimResult.current_status,
        actor,
      });
      continue;
    }

    // Δ-31 / Δ-38: financial-consistency gate. FIRS and loyalty depend on a
    // correct `total`; abort with a structured error so the failed claim is
    // retried automatically once B3.5 reclassifies the order's tax_basis.
    if (
      !consistency.consistent &&
      FINANCIAL_CONSISTENCY_GATED_STEPS.has(step)
    ) {
      await markFailed(supabase, {
        orderId: order.id,
        step,
        token: myToken,
        error: 'financial_totals_inconsistent',
        // Δ-59: plain TS object, never `jsonb_build_object` in TS.
        result: consistency.detail,
      });
      result.failedSteps.push({
        step,
        error: 'financial_totals_inconsistent',
      });
      continue;
    }

    // Review feedback (PR1563 Jules): split the executor call from the
    // mark-completed UPDATE so a markCompleted throw doesn't get logged
    // as "step executor threw". Different operational implications:
    //   - executor throw → boundary integration failed; nothing happened
    //     externally; replay re-runs the side effect.
    //   - markCompleted throw → external side effect already succeeded
    //     (email sent, settlement RPC committed); we just couldn't
    //     record it. Replay still safe via per-integration boundary
    //     idempotency, but the operator should know the difference.
    let stepResult: Awaited<ReturnType<StepExecutor>>;
    try {
      stepResult = await executor({
        order,
        transaction,
        gatewayResponse,
        consistency,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(supabase, {
        orderId: order.id,
        step,
        token: myToken,
        error: message,
        result: null,
      });
      result.failedSteps.push({ step, error: message });
      logger.error({
        message: 'payment_side_effects: step executor threw',
        orderId: order.id,
        step,
        actor,
        error: message,
      });
      continue;
    }

    try {
      const { rows } = await markCompleted(supabase, {
        orderId: order.id,
        step,
        token: myToken,
        result: stepResult ?? null,
      });
      if (rows.length === 0) {
        // Another worker took over while we were running — its `claim_token`
        // is in the row now. The boundary idempotency (FIRS via IRN, loyalty
        // unique source key, settlement Δ-14 partial unique, email DB claim
        // + ZeptoMail `client_reference` audit, deterministic ad-tracking
        // conversion id) catches the worst case.
        result.concurrentTakeoverSteps.push(step);
        logger.warn({
          message:
            'payment_side_effects: concurrent takeover — mark-completed UPDATE matched 0 rows',
          orderId: order.id,
          step,
          actor,
        });
      }
      result.ranSteps.push(step);
    } catch (markErr) {
      // Executor SUCCEEDED but the mark-completed UPDATE threw (transient
      // DB error, network blip, etc.). The external side effect already
      // ran. Best-effort markFailed so a replay re-takes the claim; the
      // boundary idempotency on each integration prevents duplicate
      // external execution.
      const message =
        markErr instanceof Error ? markErr.message : String(markErr);
      const trackedError = `mark_completed_threw: ${message}`;
      await markFailed(supabase, {
        orderId: order.id,
        step,
        token: myToken,
        error: trackedError,
        result: stepResult ?? null,
      });
      result.failedSteps.push({ step, error: trackedError });
      logger.error({
        message:
          'payment_side_effects: mark-completed UPDATE threw after executor succeeded — side effect ran but row not marked; replay-safe via integration idempotency',
        orderId: order.id,
        step,
        actor,
        error: message,
      });
    }
  }

  return result;
} // Internals (claimStep / markCompleted / markFailed) → ./apply-paid-order-side-effects-internals.ts
