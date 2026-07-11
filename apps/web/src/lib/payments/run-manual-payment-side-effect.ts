import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export type ManualPaymentSideEffectStep = 'partial_receipt';

interface ManualPaymentSideEffectClaim {
  current_status: string;
  we_won: boolean;
}

async function finishClaim({
  claimToken,
  error,
  status,
  step,
  supabase,
  transactionId,
}: {
  claimToken: string;
  error: string | null;
  status: 'completed' | 'failed';
  step: ManualPaymentSideEffectStep;
  supabase: Pick<SupabaseClient, 'rpc'>;
  transactionId: string;
}): Promise<boolean> {
  try {
    const result = await supabase.rpc('finish_manual_payment_side_effect', {
      p_claim_token: claimToken,
      p_error: error,
      p_status: status,
      p_step: step,
      p_transaction_id: transactionId,
    });
    return !result.error && result.data === true;
  } catch (finishError) {
    logger.error({
      error: finishError,
      message: 'Manual payment side effect finalization threw',
      status,
      step,
      transactionId,
    });
    return false;
  }
}

export async function runManualPaymentSideEffect({
  actor,
  execute,
  orderId,
  step,
  supabase,
  transactionId,
}: {
  actor: string;
  execute: () => Promise<void>;
  orderId: string;
  step: ManualPaymentSideEffectStep;
  supabase: Pick<SupabaseClient, 'rpc'>;
  transactionId: string;
}): Promise<'completed' | 'deferred' | 'failed'> {
  const claimToken = crypto.randomUUID();
  let claim: ManualPaymentSideEffectClaim | null = null;
  let claimError: unknown = null;
  try {
    const result = await supabase
      .rpc('claim_manual_payment_side_effect', {
        p_claim_token: claimToken,
        p_claimed_by: actor,
        p_order_id: orderId,
        p_step: step,
        p_transaction_id: transactionId,
      })
      .single<ManualPaymentSideEffectClaim>();
    claim = result.data;
    claimError = result.error;
  } catch (error) {
    claimError = error;
  }

  if (claimError || !claim) {
    logger.error({
      error: claimError,
      message: 'Failed to claim manual payment side effect',
      orderId,
      step,
      transactionId,
    });
    return 'failed';
  }

  if (!claim.we_won) return 'deferred';

  try {
    await execute();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureRecorded = await finishClaim({
      claimToken,
      error: message,
      status: 'failed',
      step,
      supabase,
      transactionId,
    });
    logger.error({
      error,
      failureRecorded,
      message: 'Manual payment side effect failed',
      orderId,
      step,
      transactionId,
    });
    return 'failed';
  }

  const finished = await finishClaim({
    claimToken,
    error: null,
    status: 'completed',
    step,
    supabase,
    transactionId,
  });

  if (!finished) {
    logger.error({
      message: 'Failed to complete manual payment side effect claim',
      orderId,
      step,
      transactionId,
    });
    return 'failed';
  }

  return 'completed';
}
