import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgenticCheckoutBuyer,
  StoredDvaAccount,
} from '@/lib/agentic/checkout-completion-response';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

export function buildOrderFinalizationClaim({
  idempotencyKey,
  requestId,
  sessionId,
}: {
  idempotencyKey: string;
  requestId: string;
  sessionId: string;
}): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        session_id: sessionId,
        idempotency_key: idempotencyKey,
        request_id: requestId,
      })
    )
    .digest('hex');

  return `agentic_order_${digest}`;
}

export async function claimAgenticOrderFinalization({
  buyer,
  dvaAccount,
  finalizationClaim,
  merchantId,
  metadata,
  sessionId,
  supabase,
}: {
  buyer: AgenticCheckoutBuyer;
  dvaAccount: StoredDvaAccount;
  finalizationClaim: string;
  merchantId: string;
  metadata: AgenticMetadata;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: buildOrderFinalizationMetadata({
        buyer,
        dvaAccount,
        finalizationClaim,
        metadata,
        paymentState: 'order_finalizing',
      }),
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .eq('payment_reference', dvaAccount.account_number)
    .is('order_id', null)
    .in('status', ['pending', 'processing'])
    .contains('metadata', {
      agentic: {
        payment_state: 'payment_account_ready',
      },
    })
    .select('session_id')
    .maybeSingle();

  if (
    !error &&
    !data &&
    hasMatchingOrderFinalizationClaim({ finalizationClaim, metadata })
  ) {
    return reclaimExistingOrderFinalizationClaim({
      buyer,
      dvaAccount,
      finalizationClaim,
      merchantId,
      metadata,
      sessionId,
      supabase,
    });
  }

  return { claimed: !error && !!data, error };
}

function hasMatchingOrderFinalizationClaim({
  finalizationClaim,
  metadata,
}: {
  finalizationClaim: string;
  metadata: AgenticMetadata;
}) {
  return (
    metadata.agentic?.payment_state === 'order_finalizing' &&
    metadata.agentic?.finalization_claim === finalizationClaim
  );
}

export async function releaseAgenticOrderFinalizationClaim({
  finalizationClaim,
  merchantId,
  metadata,
  orderError,
  sessionId,
  supabase,
}: {
  finalizationClaim: string;
  merchantId: string;
  metadata: AgenticMetadata;
  orderError: unknown;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: buildOrderFinalizationMetadata({
        finalizationClaim,
        metadata,
        orderError,
        paymentState: 'payment_account_ready',
      }),
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .contains('metadata', {
      agentic: {
        finalization_claim: finalizationClaim,
        payment_state: 'order_finalizing',
      },
    })
    .select('session_id')
    .maybeSingle();

  if (error || !data) {
    logger.error({
      error: sanitizeForLog(error ?? 'No checkout session row matched'),
      message: 'Agentic checkout order finalization claim release failed',
      sessionId: sanitizeForLog(sessionId),
    });
  }
}

async function reclaimExistingOrderFinalizationClaim({
  buyer,
  dvaAccount,
  finalizationClaim,
  merchantId,
  metadata,
  sessionId,
  supabase,
}: {
  buyer: AgenticCheckoutBuyer;
  dvaAccount: StoredDvaAccount;
  finalizationClaim: string;
  merchantId: string;
  metadata: AgenticMetadata;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: buildOrderFinalizationMetadata({
        buyer,
        dvaAccount,
        finalizationClaim,
        metadata,
        paymentState: 'order_finalizing',
      }),
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .eq('payment_reference', dvaAccount.account_number)
    .is('order_id', null)
    .in('status', ['pending', 'processing'])
    .contains('metadata', {
      agentic: {
        finalization_claim: finalizationClaim,
        payment_state: 'order_finalizing',
      },
    })
    .select('session_id')
    .maybeSingle();

  if (error) {
    logger.error({
      error: sanitizeForLog(error),
      message: 'Agentic checkout order finalization claim reclaim failed',
      sessionId: sanitizeForLog(sessionId),
    });
  }

  return { claimed: !error && !!data, error };
}

function buildOrderFinalizationMetadata({
  buyer,
  dvaAccount,
  finalizationClaim,
  metadata,
  orderError,
  paymentState,
}: {
  buyer?: AgenticCheckoutBuyer;
  dvaAccount?: StoredDvaAccount;
  finalizationClaim: string;
  metadata: AgenticMetadata;
  orderError?: unknown;
  paymentState: 'order_finalizing' | 'payment_account_ready';
}) {
  return {
    ...metadata,
    agentic: {
      ...(metadata.agentic ?? {}),
      ...(buyer ? { buyer } : {}),
      ...(dvaAccount ? { dva_account: dvaAccount } : {}),
      ...(orderError === undefined
        ? {}
        : { finalization_error: sanitizeForLog(orderError) }),
      finalization_claim: finalizationClaim,
      finalization_updated_at: new Date().toISOString(),
      payment_state: paymentState,
    },
  };
}
