import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgenticCheckoutBuyer } from '@/lib/agentic/checkout-completion-response';
import { PAY_ON_DELIVERY_METHOD } from '@/lib/agentic/checkout-pay-on-delivery-payloads';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

const ORDER_FINALIZING_STATE = 'order_finalizing';
const PROCESSING_CHECKOUT_STATUS = 'processing';

export async function claimPayOnDeliveryFinalization({
  buyer,
  finalizationClaim,
  merchantId,
  metadata,
  sessionId,
  supabase,
}: {
  buyer: AgenticCheckoutBuyer;
  finalizationClaim: string;
  merchantId: string;
  metadata: AgenticMetadata;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const claimMetadata = {
    ...metadata,
    agentic: {
      ...(metadata.agentic ?? {}),
      buyer,
      finalization_claim: finalizationClaim,
      finalization_updated_at: new Date().toISOString(),
      payment_method: PAY_ON_DELIVERY_METHOD,
      payment_state: ORDER_FINALIZING_STATE,
    },
  };
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: claimMetadata,
      payment_reference: finalizationClaim,
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .is('order_id', null)
    .is('payment_reference', null)
    .eq('status', PROCESSING_CHECKOUT_STATUS)
    .not('shipping_address', 'is', null)
    .select('session_id')
    .maybeSingle();

  if (
    !error &&
    !data &&
    hasMatchingPayOnDeliveryFinalizationClaim({ finalizationClaim, metadata })
  ) {
    return { claimed: true, error: null };
  }

  return { claimed: !error && !!data, error };
}

export async function recordPayOnDeliveryOrderCreated({
  finalizationClaim,
  merchantId,
  metadata,
  orderId,
  sessionId,
  supabase,
}: {
  finalizationClaim: string;
  merchantId: string;
  metadata: AgenticMetadata;
  orderId: string;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: {
        ...metadata,
        agentic: {
          ...(metadata.agentic ?? {}),
          finalization_claim: finalizationClaim,
          finalization_order_id: orderId,
          finalization_updated_at: new Date().toISOString(),
          payment_method: PAY_ON_DELIVERY_METHOD,
          payment_state: ORDER_FINALIZING_STATE,
        },
      },
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .eq('payment_reference', finalizationClaim)
    .contains('metadata', {
      agentic: {
        finalization_claim: finalizationClaim,
        payment_method: PAY_ON_DELIVERY_METHOD,
        payment_state: ORDER_FINALIZING_STATE,
      },
    })
    .select('session_id')
    .maybeSingle();

  return { error, recorded: !error && !!data };
}

export async function releasePayOnDeliveryFinalizationClaim({
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
      metadata: buildReleasedPayOnDeliveryMetadata({ metadata, orderError }),
      payment_reference: null,
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .eq('payment_reference', finalizationClaim)
    .contains('metadata', {
      agentic: {
        finalization_claim: finalizationClaim,
        payment_method: PAY_ON_DELIVERY_METHOD,
        payment_state: ORDER_FINALIZING_STATE,
      },
    })
    .select('session_id')
    .maybeSingle();

  if (error || !data) {
    const releaseError = error ?? 'No checkout session row matched';
    logger.error({
      error: sanitizeForLog(releaseError),
      message: 'Pay-on-delivery finalization claim release failed',
      sessionId: sanitizeForLog(sessionId),
    });
    return { error: releaseError, released: false };
  }

  return { error: null, released: true };
}

export function getMarkedPayOnDeliveryFinalizationOrderId(
  metadata: AgenticMetadata
): string | null {
  const orderId = metadata.agentic?.finalization_order_id;
  return typeof orderId === 'string' && orderId.trim().length > 0
    ? orderId.trim()
    : null;
}

function hasMatchingPayOnDeliveryFinalizationClaim({
  finalizationClaim,
  metadata,
}: {
  finalizationClaim: string;
  metadata: AgenticMetadata;
}) {
  return (
    metadata.agentic?.finalization_claim === finalizationClaim &&
    metadata.agentic?.payment_method === PAY_ON_DELIVERY_METHOD &&
    metadata.agentic?.payment_state === ORDER_FINALIZING_STATE
  );
}

function buildReleasedPayOnDeliveryMetadata({
  metadata,
  orderError,
}: {
  metadata: AgenticMetadata;
  orderError: unknown;
}) {
  const agentic = { ...(metadata.agentic ?? {}) };
  delete agentic.finalization_claim;
  delete agentic.finalization_order_id;
  delete agentic.payment_method;
  delete agentic.payment_state;

  return {
    ...metadata,
    agentic: {
      ...agentic,
      finalization_error: sanitizeForLog(orderError),
      finalization_updated_at: new Date().toISOString(),
    },
  };
}
