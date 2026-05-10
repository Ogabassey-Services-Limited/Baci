// Internal helpers for `applyPaidOrderSideEffects` — extracted into this
// module so the main file stays under the 300-line per-file cap from
// `.ruler/07-testing.md` ("One component, hook, or utility per file with
// a maximum of 300 lines per file"). The three helpers (claimStep,
// markCompleted, markFailed) all wrap thin RPC/UPDATE calls against
// `payment_side_effects`; they are exported for the main module to
// re-import and intentionally not re-exported from any barrel.

import { logger } from '@/lib/logger';
import type { createServiceClient } from '@/lib/supabase/service';
import type { SideEffectStep } from './apply-paid-order-side-effects';

type ServiceRoleClient = ReturnType<typeof createServiceClient>;

export async function claimStep(
  supabase: ServiceRoleClient,
  args: {
    orderId: string;
    transactionId: string;
    step: SideEffectStep;
    token: string;
    claimedBy: string;
  }
): Promise<{ we_won: boolean; current_status: string }> {
  const { data, error } = await supabase
    .rpc('claim_payment_side_effect', {
      p_order_id: args.orderId,
      p_transaction_id: args.transactionId,
      p_step: args.step,
      p_claim_token: args.token,
      p_claimed_by: args.claimedBy,
    })
    .single();

  if (error || !data) {
    throw new Error(
      `claim_payment_side_effect failed for step ${args.step}: ${error?.message ?? 'no data'}`
    );
  }
  return data as { we_won: boolean; current_status: string };
}

export async function markCompleted(
  supabase: ServiceRoleClient,
  args: {
    orderId: string;
    step: SideEffectStep;
    token: string;
    result: Record<string, unknown> | null;
  }
): Promise<{ rows: Array<{ order_id: string }> }> {
  const { data, error } = await supabase
    .from('payment_side_effects')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: args.result,
      error: null,
    })
    .eq('order_id', args.orderId)
    .eq('step', args.step)
    .eq('claim_token', args.token)
    .select('order_id');

  if (error) {
    throw new Error(
      `mark_completed failed for step ${args.step}: ${error.message}`
    );
  }
  return { rows: (data ?? []) as Array<{ order_id: string }> };
}

export async function markFailed(
  supabase: ServiceRoleClient,
  args: {
    orderId: string;
    step: SideEffectStep;
    token: string;
    error: string;
    result: Record<string, unknown> | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('payment_side_effects')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: args.error,
      result: args.result,
    })
    .eq('order_id', args.orderId)
    .eq('step', args.step)
    .eq('claim_token', args.token)
    .select('order_id');

  if (error) {
    // Don't throw — the step is already failing; the table just couldn't
    // record it. The next replay will take over the stale claim.
    logger.error({
      message: 'payment_side_effects: mark_failed UPDATE errored',
      orderId: args.orderId,
      step: args.step,
      dbError: error.message,
      stepError: args.error,
    });
  }
}
